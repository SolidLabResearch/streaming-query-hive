import { EventEmitter } from "events";
import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
import { turtleStringToStore } from "../util/Util";
import { v4 as uuidv4 } from 'uuid';
const mqtt = require('mqtt');
const { DataFactory } = require("n3");


export class FetchingAllDataClientSide {
    public query: string;
    public r2s_topic: string;
    public rspql_parser: RSPQLParser;
    public rsp_engine: RSPEngine;
    public rstream_emitter: EventEmitter;

    constructor(query: string, r2s_topic: string) {
        this.query = query;
        this.r2s_topic = r2s_topic;
        this.rspql_parser = new RSPQLParser();
        this.rsp_engine = new RSPEngine(query);
        this.rstream_emitter = this.rsp_engine.register();
        this.subscribeRStream();

    }

    process_streams() {
        const streams = this.returnStreams();
        for (const stream of streams) {
            const stream_name = stream.stream_name;
            const mqtt_broker = this.returnMQTTBroker(stream_name);
            const rsp_client = mqtt.connect(mqtt_broker);
            const rsp_stream_object = this.rsp_engine.getStream(stream_name);
            const topic = new URL(stream_name).pathname.slice(1);

            rsp_client.on('connect', () => {
                console.log(`Connected to MQTT broker at ${mqtt_broker}`);
                rsp_client.subscribe(topic, (err: any) => {
                    if (err) {
                        console.error(`Failed to subscribe to topic ${topic}:`, err);
                    } else {
                        console.log(`Subscribed to topic ${topic}`);
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
                } catch (error) {
                    console.error("Error processing message:", error);
                }
            });
        }

    }

    returnStreams() {
        const parsedQuery = this.rspql_parser.parse(this.query);
        const streams: any[] = [...parsedQuery.s2r];
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

    public async subscribeRStream() {
        this.rstream_emitter.on("RStream", (object: any) => {
            if (!object || !object.bindings) {
                console.error("Received invalid RStream object:", object);
                return;
            }

            const iterables = object.bindings.values();

            for (const item of iterables) {
                const aggregation_event_timestamp = new Date().getTime();
                const data = item.value;

                const aggregation_event = this.generate_aggregation_event(data, aggregation_event_timestamp);
                const aggregation_object_string = JSON.stringify(aggregation_event);

                console.log(`Aggregation event generated: ${aggregation_object_string}`);
                process.exit(0); // Exit after processing the aggregation event
            }
        });

    }

    public generate_aggregation_event(data: any, timestamp: number) {
        const uuid_random = uuidv4();

        const aggregation_event = `
    <https://rsp.js/aggregation_event/${uuid_random}> <https://saref.etsi.org/core/hasValue> "${data}"^^<http://www.w3.org/2001/XMLSchema#float> .
    `;
        return aggregation_event.trim();

    }

}


async function clientSideProcessing() {
    const query = `
PREFIX mqtt_broker: <mqtt://localhost:1883/>
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgX) (AVG(?o2) AS ?avgY) (AVG(?o3) AS ?avgZ)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 120000 STEP 30000]
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:accY [RANGE 120000 STEP 30000]
FROM NAMED WINDOW :w3 ON STREAM mqtt_broker:accZ [RANGE 120000 STEP 30000]
WHERE {
   { 
WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:x .
}}
    UNION
    { 
WINDOW :w2 {
        ?s saref:hasValue ?o2 .
        ?s saref:relatesToProperty dahccsensors:y .
    }}
    UNION
    { 
WINDOW :w3 {
        ?s saref:hasValue ?o3 .
        ?s saref:relatesToProperty dahccsensors:z .
    }}
}
`;
console.log(new RSPQLParser().parse(query).sparql);

    const r2s_topic = "client_operation_output";
    const client = new FetchingAllDataClientSide(query, r2s_topic);
    client.process_streams();
}

clientSideProcessing().catch((error) => {
    console.error("Error during client-side processing:", error);
});