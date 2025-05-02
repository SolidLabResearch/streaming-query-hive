const mqtt = require('mqtt');
const { DataFactory } = require('n3');
import { EventEmitter } from "events";
import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
import { hash_string_md5, turtleStringToStore } from "../../util/Util";

export class RSPChildAgent {
    public child_query: string;
    public rsp_engine: RSPEngine;
    public rstream_emitter: EventEmitter;
    public rspql_parser: RSPQLParser = new RSPQLParser();
    constructor(query: string) {
        this.child_query = query;

        this.rsp_engine = new RSPEngine(query);
        this.rstream_emitter = this.rsp_engine.register();
    }


    public async process_mqtt_streams() {
        const streams = this.returnStreams();
        for (const stream of streams) {
            const stream_name = stream.stream_name;
            const mqtt_broker: string = this.returnMQTTBroker(stream_name);
            const rsp_client = mqtt.connect(mqtt_broker);
            const rsp_stream_object = this.rsp_engine.getStream(stream_name);
            const topic = new URL(stream_name).pathname.slice(1);
            rsp_client.on("connect", () => {
                console.log(`Connected to MQTT broker at ${mqtt_broker}`);
                this.subscribeRStream();
                rsp_client.subscribe(topic, (err: any) => {
                    if (err) {
                        console.error(`Failed to subscribe to stream ${stream_name}:`, err);
                    } else {
                        console.log(`Subscribed to stream ${stream_name}`);
                    }
                });
            });

            rsp_client.on("message", async (topic: any, message: any) => {
                try {
                    const message_string = message.toString();
                    const latest_event_store = await turtleStringToStore(message_string);
                    const timestamp = latest_event_store.getQuads(null, DataFactory.namedNode("https://saref.etsi.org/core/hasTimestamp"), null, null)[0].object.value;
                    const timestamp_epoch = Date.parse(timestamp);
                    if (rsp_stream_object) {
                        await this.add_event_store_to_rsp_engine(latest_event_store, [rsp_stream_object], timestamp_epoch);
                    }

                }
                catch (error) {
                    console.log('Error parsing the topic sent from the MQTT broker.');
                }

            });

            rsp_client.on("error", (error: any) => {
                console.log(error);
            })

        }

    }

    public returnStreams() {
        const parsed_query = this.rspql_parser.parse(this.child_query);
        const streams: any[] = [...parsed_query.s2r];
        return streams;
    }
    public returnMQTTBroker(stream_name: string): string {
        const url = new URL(stream_name);
        return `${url.protocol}//${url.hostname}:${url.port}/`;
    }

    public async add_event_store_to_rsp_engine(event_store: any, stream_name: RDFStream[], timestamp: number) {

        stream_name.forEach(async (stream: RDFStream) => {
            const quads = event_store.getQuads(null, null, null, null);
            for (const quad of quads) {
                stream.add(quad, timestamp)
            }
        });
    }

    public async subscribeRStream() {
        const mqtt_broker = 'mqtt://localhost:1883/';
        const rstream_publisher = mqtt.connect(mqtt_broker);
        const query_hash = hash_string_md5(this.child_query);
        console.log(query_hash);

        this.rstream_emitter.on("RStream", async (object: any) => {
            const iterables = object.bindings.values();
            console.log(iterables.toString());
            for (const item of iterables) {
                const aggregation_event_timestamp = new Date().getTime();
                const data = item.value;
                const aggregation_event = this.generate_aggregation_event(data, aggregation_event_timestamp);
                console.log(data.toString());
                const aggregation_object_string = JSON.stringify(aggregation_event);
                rstream_publisher.publish(query_hash, aggregation_object_string);
            }
        })
    }

    public generate_aggregation_event(data: any, timestamp: number) {
        return {
            timestamp,
            data
        };
    }
}