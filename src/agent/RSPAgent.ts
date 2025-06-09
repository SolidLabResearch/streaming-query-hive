import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
import { EventEmitter } from "events";
import { DataFactory } from "n3";
import { v4 as uuidv4 } from 'uuid';
import { hash_string_md5, turtleStringToStore } from "../util/Util";
const mqtt = require('mqtt');


/**
 *
 */
export class RSPAgent {

    public query: string;
    public rstream_topic: string;
    public rstream_emitter: EventEmitter;
    public rsp_engine: RSPEngine;
    public rspql_parser: RSPQLParser;

    /**
     *
     * @param query
     * @param rstream_topic
     */
    constructor(query: string, rstream_topic: string) {
        this.query = query;
        this.rstream_topic = rstream_topic;
        this.rspql_parser = new RSPQLParser();
        this.rsp_engine = new RSPEngine(query);
        this.rstream_emitter = this.rsp_engine.register();

    }

    /**
     *
     */
    public async process_streams() {
        const streams = this.returnStreams();
        for (const stream of streams) {
            const stream_name = stream.stream_name;
            const mqtt_broker: string = this.returnMQTTBroker(stream_name);
            const rsp_client = mqtt.connect(mqtt_broker);
            const rsp_stream_object = this.rsp_engine.getStream(stream_name);
            const topic = new URL(stream_name).pathname.slice(1);

            rsp_client.on("connect", () => {
                console.log(`Connected to MQTT broker at ${mqtt_broker}`);

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

                    }
                } catch (error) {
                    console.error(`Error processing message from stream ${stream_name}:`, error);
                }
            });

            rsp_client.on("error", (error: any) => {
                console.error(`Error with MQTT client for stream ${stream_name}:`, error);
            });
        }
    }

    /**
     *
     * @param stream_name
     */
    public returnMQTTBroker(stream_name: string): string {
        const url = new URL(stream_name);
        return `${url.protocol}//${url.hostname}:${url.port}/`;
    }

    /**
     *
     */
    public returnStreams() {
        const parsed_query = this.rspql_parser.parse(this.query);
        const streams: any[] = [...parsed_query.s2r];
        return streams;
    }

    /**
     *
     */
    public async subscribeRStream() {
        const mqtt_broker = "mqtt://localhost:1883";
        const rstream_publisher = mqtt.connect(mqtt_broker);
        const query_hash = hash_string_md5(this.query);

        this.rstream_emitter.on("RStream", async (object: any) => {
            if (!object || object.bindings) {
                console.log(`No bindings found in the RStream object.`);
                return;
            }

            const iterables = object.bindings.values();

            for (const item of iterables) {
                const aggregation_event_timestamp = new Date().getTime();
                const data = item.value;

                const aggregation_event = this.generate_aggregation_event(data, aggregation_event_timestamp);

                const aggregation_object_string = JSON.stringify(aggregation_event);
                rstream_publisher.publish(this.rstream_topic, aggregation_object_string);
            }
        });
    }

    /**
     *
     * @param data
     * @param timestamp
     */
    public generate_aggregation_event(data: any, timestamp: number) {
        const uuid_random = uuidv4();

        const aggregation_event = `
    <https://rsp.js/aggregation_event/${uuid_random}> <https://saref.etsi.org/core/hasTimestamp> "${timestamp}"^^<http://www.w3.org/2001/XMLSchema#long> .
    <https://rsp.js/aggregation_event/${uuid_random}> <https://saref.etsi.org/core/hasValue> "${data}"^^<http://www.w3.org/2001/XMLSchema#float> .
    `;
        return aggregation_event.trim();

    }


}