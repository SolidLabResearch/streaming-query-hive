import { EventEmitter } from 'events';
import { RDFStream, RSPEngine } from 'rsp-js';
const mqtt = require('mqtt');
const { DataFactory } = require('n3');
import { v4 as uuidv4 } from 'uuid';
import { RSPQLParser } from '../util/parser/RSPQLParser';
import { turtleStringToStore } from '../util/Util';

export class RSPQueryProcess {
    public query: string;
    public rstream_topic: string;
    public rstream_emitter: EventEmitter;
    public rsp_engine: RSPEngine;
    public rspql_parser: RSPQLParser;

    constructor(query: string, rstream_topic: string) {
        this.query = query;
        this.rstream_topic = rstream_topic;
        this.rsp_engine = new RSPEngine(query);
        this.rstream_emitter = this.rsp_engine.register();
        this.rspql_parser = new RSPQLParser();
        this.subscribeToResultStream();
    }

    public async stream_process() {
        const parsed_query = this.rspql_parser.parse(this.query);
        if (parsed_query) {
            const streams: any[] = [...parsed_query.s2r];
            for (const stream of streams) {
                const stream_name = stream.stream_name;
                const stream_url = new URL(stream_name);
                const mqtt_broker: string = `${stream_url.protocol}//${stream_url.hostname}:${stream_url.port}/`;
                const rsp_client = mqtt.connect(mqtt_broker);
                const rsp_stream_object = this.rsp_engine.getStream(stream_name);
                const topic = stream_url.pathname.slice(1);
                rsp_client.on("connect", () => {
                    console.log(`Connected to MQTT broker`);
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
                        const timestamp = latest_event_store.getQuads(null, DataFactory.namedNode('https://saref.etsi.org/core/hasTimestamp'), null, null)[0]?.object.value;
                        if (!timestamp) {
                            console.error(`No timestamp found in the message for stream ${stream_name}`);
                            return;
                        }
                        const timestamp_epoch = Date.parse(timestamp);
                        if (rsp_stream_object) {
                            await this.add_event_store_to_rsp_engine(latest_event_store, [rsp_stream_object], timestamp_epoch);
                        }
                        else {
                            console.error(`Stream object not found for stream ${stream_name}`);
                            return;
                        }
                    } catch (error) {
                        console.error(`Error processing message for stream ${stream_name}:`, error);
                        return;
                    }
                });

                rsp_client.on("error", (err: any) => {
                    console.error(`Error in MQTT client for stream ${stream_name}:`, err);
                });
                rsp_client.on("close", () => {
                    console.log(`Connection closed for stream ${stream_name}`);
                });


            }
        }
        else {
            console.log(`Failed to parse query: ${this.query}`);

        }


    }


    public async subscribeToResultStream() {
        const mqtt_broker = "mqtt://localhost:1883";
        const rstream_publisher = mqtt.connect(mqtt_broker);

        this.rstream_emitter.on("RStream", async (object: any) => {
            if (!object || object.bindings) {
                console.log(`No bindings found in the RStream object.`);
                return;
            }

            const iterables = object.bindings.values();
            for await (const iterable of iterables) {
                const event_timestamp = new Date().getTime();
                const data = iterable.value;

                const aggregation_event = this.generate_aggregation_event(data, event_timestamp);
                const aggregation_object_string = JSON.stringify(aggregation_event);
                rstream_publisher.publish(this.rstream_topic, aggregation_object_string);
                console.log(`Published aggregation event: ${aggregation_object_string}`);
            }
        });
    }


    public generate_aggregation_event(data: any, timestamp: number) {
        const uuid_random = uuidv4();

        const aggregation_event = `
    <https://rsp.js/aggregation_event/${uuid_random}> <https://saref.etsi.org/core/hasTimestamp> "${timestamp}"^^<http://www.w3.org/2001/XMLSchema#long> .
    <https://rsp.js/aggregation_event/${uuid_random}> <https://saref.etsi.org/core/hasValue> "${data}"^^<http://www.w3.org/2001/XMLSchema#float> .
    `;
        return aggregation_event.trim();

    }

    public async add_event_store_to_rsp_engine(event_store: any, stream_name: RDFStream[], timestamp: number) {
        stream_name.forEach(async (stream: RDFStream) => {
            const quads = event_store.getQuads(null, null, null, null);
            for (const quad of quads) {
                const quadWithGraph = DataFactory.quad(
                    quad.subject,
                    quad.predicate,
                    quad.object,
                    DataFactory.namedNode(stream_name)
                );                
                stream.add(quadWithGraph, timestamp);
            }
        });
    }
}