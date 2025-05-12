const mqtt = require('mqtt');
const { DataFactory } = require('n3');
import { EventEmitter } from "events";
import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
import { hash_string_md5, turtleStringToStore } from "../../util/Util";

export class RSPChildAgent {
    public child_query: string;
    public rstream_topic: string;
    public rsp_engine: RSPEngine;
    public rstream_emitter: EventEmitter;
    public rspql_parser: RSPQLParser = new RSPQLParser();

    constructor(query: string, rstream_topic: string) {
        this.child_query = query;
        this.rstream_topic = rstream_topic;
        this.rsp_engine = new RSPEngine(query);
        this.rstream_emitter = this.rsp_engine.register();
        this.subscribeRStream();
    }

    // This method handles the processing of incoming MQTT streams
    public async process_mqtt_streams() {
        const streams = this.returnStreams();
        for (const stream of streams) {
            const stream_name = stream.stream_name;
            const mqtt_broker: string = this.returnMQTTBroker(stream_name);
            const rsp_client = mqtt.connect(mqtt_broker);
            const rsp_stream_object = this.rsp_engine.getStream(stream_name);
            
            const topic = new URL(stream_name).pathname.slice(1);

            // MQTT client connection and subscription
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

            // Handle incoming messages
            rsp_client.on("message", async (topic: any, message: any) => {
                try {
                    const message_string = message.toString();
                    const latest_event_store = await turtleStringToStore(message_string);
                    const timestamp = latest_event_store.getQuads(null, DataFactory.namedNode("https://saref.etsi.org/core/hasTimestamp"), null, null)[0].object.value;
                    const timestamp_epoch = Date.parse(timestamp);
                    if (rsp_stream_object) {
                        await this.add_event_store_to_rsp_engine(latest_event_store, [rsp_stream_object], timestamp_epoch);
                    }
                } catch (error) {
                    console.log('Error parsing the topic sent from the MQTT broker.');
                }
            });

            // Handle connection errors
            rsp_client.on("error", (error: any) => {
                console.log(error);
            });
        }
    }

    // Parse the streams in the query
    public returnStreams() {
        const parsed_query = this.rspql_parser.parse(this.child_query);
        const streams: any[] = [...parsed_query.s2r];
        return streams;
    }

    // Get the MQTT broker URL from the stream name
    public returnMQTTBroker(stream_name: string): string {
        const url = new URL(stream_name);
        return `${url.protocol}//${url.hostname}:${url.port}/`;
    }

    // Add event store to the RSP engine stream
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

    // Subscribe to RStream and publish events to MQTT broker
    public async subscribeRStream() {
        const mqtt_broker = 'mqtt://localhost:1883/';
        const rstream_publisher = mqtt.connect(mqtt_broker);
        const query_hash = hash_string_md5(this.child_query);

        // Log the query hash for debugging
        console.log("Query hash:", query_hash);

        // Listen for the "RStream" event and publish to MQTT
        this.rstream_emitter.on("RStream", async (object: any) => {
            if (!object || !object.bindings) {
                console.log("No bindings found in RStream object:", object);
                return;
            }

            const iterables = object.bindings.values();
            console.log("Received RStream object:", iterables);
            // Loop through each iterable and publish the aggregated event to the MQTT broker
            for (const item of iterables) {
                const aggregation_event_timestamp = new Date().getTime();
                const data = item.value;

                // Generate the aggregation event
                const aggregation_event = this.generate_aggregation_event(data, aggregation_event_timestamp);
                console.log("Generated aggregation event:", aggregation_event);

                // Convert the aggregation event to a string and publish to the MQTT topic
                const aggregation_object_string = JSON.stringify(aggregation_event);
                rstream_publisher.publish(this.rstream_topic, aggregation_object_string);
            }
        });
    }

    // Generate the aggregation event structure
    public generate_aggregation_event(data: any, timestamp: number) {
        return {
            timestamp: timestamp, // Format the timestamp as an ISO string
            data: data,  // Add additional fields as necessary
        };
    }
}
