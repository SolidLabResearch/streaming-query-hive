import { EventEmitter } from "events";
import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
import { hash_string_md5, turtleStringToStore } from "../util/Util";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
const N3 = require('n3');
const mqtt = require('mqtt');
const { DataFactory } = N3;

/**
 *
 */
export class FetchingAllDataClientSide {
    public query: string;
    public r2s_topic: string;
    public rspql_parser: RSPQLParser;
    public rsp_engine: RSPEngine;
    public rstream_emitter: EventEmitter;
    private windowStreamMap: { [key: string]: string } = {
        "mqtt://localhost:1883/wearableX": "https://rsp.jsw1",
        "mqtt://localhost:1883/smartphoneX": "https://rsp.jsw1",
    }
    private expectedWindowInterval: number = 60000; // 60 seconds based on STEP 60000
    private tolerance: number = 5000; // 5 second tolerance
    private startTime: number = 0; // Track when processing started
    private lastValidResultTime: number = 0; // Track last valid result timing


    /**
     *
     * @param query
     * @param r2s_topic
     */
    constructor(query: string, r2s_topic: string) {
        this.query = query;
        this.r2s_topic = r2s_topic;
        this.rspql_parser = new RSPQLParser();
        this.rsp_engine = new RSPEngine(query);
        this.rstream_emitter = this.rsp_engine.register();
        this.startTime = Date.now(); // Initialize start time for filtering
        this.subscribeRStream();
        this.startResourceUsageLogging();

    }

    /**
     *
     */
    process_streams() {
        const streams = this.returnStreams();
        console.log("Processing streams:", streams);
        for (const stream of streams) {
            const stream_name = stream.stream_name;
            const mqtt_broker = this.returnMQTTBroker(stream_name);
            // Generate a unique clientId for persistent session
            const clientId = 'client-' + Math.random().toString(16).substr(2, 8);
            const rsp_client = mqtt.connect(mqtt_broker, { clean: false, clientId });
            const rsp_stream_object = this.rsp_engine.getStream(stream_name);
            const topic = new URL(stream_name).pathname.slice(1);

            rsp_client.on('connect', () => {
                console.log(`Connected to MQTT broker at ${mqtt_broker}`);
                rsp_client.subscribe(topic, { qos: 1 }, (err: any) => {
                    if (err) {
                        console.error(`Failed to subscribe to topic ${topic}:`, err);
                    } else {
                        console.log(`Subscribed to topic ${topic} with QoS 1`);
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
                        await this.add_event_store_to_rsp_engine(latest_event_store, rsp_stream_object, timestamp_epoch);
                    }
                } catch (error) {
                    console.error("Error processing message:", error);
                }
            });
        }

    }

    /**
     *
     */
    returnStreams() {
        const parsedQuery = this.rspql_parser.parse(this.query);
        const streams: any[] = [...parsedQuery.s2r];
        return streams;
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
     * @param event_store
     * @param stream_name
     * @param timestamp
     */
    public async add_event_store_to_rsp_engine(event_store: any, stream_name: RDFStream, timestamp: number) {
        const quads = event_store.getQuads(null, null, null, null);
        const graph = DataFactory.namedNode(stream_name.name);
        // Add each quad to the stream with the correct graph node
        for (const q of quads) {
            // Set the graph node
            const quadWithGraph = DataFactory.quad(q.subject, q.predicate, q.object, graph);
            // Debug: print every quad being added
            console.log(`DEBUG: Adding quad to stream ${stream_name.name} at ${timestamp}:`, quadWithGraph.subject.value, quadWithGraph.predicate.value, quadWithGraph.object.value, quadWithGraph.graph.value);
            stream_name.add(quadWithGraph, timestamp);
        }
    }

    /**
     * Filter results based on expected RSP-QL window timing to ignore extra dynamic windows
     * @param timestamp Current timestamp
     * @returns true if result should be processed, false if it should be ignored
     */
    private isWithinExpectedWindowTiming(timestamp: number): boolean {
        if (this.startTime === 0) {
            this.startTime = timestamp;
            this.lastValidResultTime = timestamp;
            return true; // Always accept first result
        }

        const timeSinceStart = timestamp - this.startTime;
        const timeSinceLastValid = timestamp - this.lastValidResultTime;

        // Check if this result aligns with expected window intervals (60 seconds)
        const expectedResultNumber = Math.floor(timeSinceStart / this.expectedWindowInterval);
        const expectedTime = this.startTime + (expectedResultNumber * this.expectedWindowInterval);
        const timeDeviation = Math.abs(timestamp - expectedTime);

        // Also check if enough time has passed since last valid result
        const isIntervalValid = timeSinceLastValid >= (this.expectedWindowInterval - this.tolerance);

        const isValid = timeDeviation <= this.tolerance && isIntervalValid;
        
        if (isValid) {
            console.log(`FILTER: VALID result at ${timestamp}, deviation: ${timeDeviation}ms, interval: ${timeSinceLastValid}ms`);
            this.lastValidResultTime = timestamp;
        } else {
            console.log(`FILTER: IGNORING extra window result at ${timestamp}, deviation: ${timeDeviation}ms, interval: ${timeSinceLastValid}ms`);
        }

        return isValid;
    }

    /**
     *
     */
    public async subscribeRStream() {
        console.log("Subscribing to RStream...");
        if (!this.rstream_emitter) {
            console.error("RStream emitter is not initialized.");
            return;
        }
        this.rstream_emitter.on("error", (err: any) => {
            console.error("Error in RStream emitter:", err);
        });
        this.rstream_emitter.on("RStream", (object: any) => {
            if (!object || !object.bindings) {
                console.error("Received invalid RStream object:", object);
                return;
            }

            const iterables = object.bindings.values();

            for (const item of iterables) {
                const data = item.value;
                const currentTimestamp = Date.now();
                
                // Apply timing filter to ignore extra dynamic windows
                if (!this.isWithinExpectedWindowTiming(currentTimestamp)) {
                    // Skip this result - it's from an extra dynamic window
                    continue;
                }
                
                // Debug: print the full binding object
                console.log("DEBUG: RStream binding:", item);
                const aggregation_event = this.generate_aggregation_event(data);
                const aggregation_object_string = JSON.stringify(aggregation_event);
                console.log(`Aggregation event generated: ${aggregation_object_string}`);
                // Generate a unique clientId for persistent session
                const clientId = hash_string_md5(aggregation_object_string);
                // const clientId = 'pub-' + Math.random().toString(16).substr(2, 8);
                const pubClient = mqtt.connect("mqtt://localhost:1883", { clean: false, clientId });
                pubClient.on('connect', () => {
                    pubClient.publish(this.r2s_topic, aggregation_object_string, { qos: 2 }, (err: any) => {
                        if (err) {
                            console.error("Error publishing aggregation event with QoS 2:", err);
                        } else {
                            console.log("Aggregation event published with QoS 2");
                        }
                        pubClient.end();
                    });
                });
            }
        });

    }

    /**
     *
     * @param data
     */
    public generate_aggregation_event(data: any): string {
        const uuid_random = uuidv4();

        const aggregation_event = `
    <https://rsp.js/aggregation_event/${uuid_random}> <https://saref.etsi.org/core/hasValue> "${data}"^^<http://www.w3.org/2001/XMLSchema#float> .
    `;
        return aggregation_event.trim();

    }

    /**
     *
     * @param filePath
     * @param intervalMs
     */
    startResourceUsageLogging(filePath = 'fetching_data_client_side.csv', intervalMs = 100) {
        const writeHeader = !fs.existsSync(filePath);
        const logStream = fs.createWriteStream(filePath, { flags: 'a' });
        if (writeHeader) {
            logStream.write('timestamp,cpu_user,cpu_system,rss,heapTotal,heapUsed,heapUsedMB,external\n');
        }
        setInterval(() => {
            const mem = process.memoryUsage();
            const cpu = process.cpuUsage();
            const now = Date.now();
            const line = [
                now,
                (cpu.user / 1000).toFixed(2),
                (cpu.system / 1000).toFixed(2),
                mem.rss,
                mem.heapTotal,
                mem.heapUsed,
                (mem.heapUsed / 1024 / 1024).toFixed(2),
                mem.external
            ].join(',') + '\n';
            logStream.write(line);
        }, intervalMs);
    }

}


/**
 *
 */
async function clientSideProcessing() {

  const query = `
PREFIX mqtt_broker: <mqtt://localhost:1883/>
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 

REGISTER RStream <sensor_averages> AS
SELECT (AVG(?value) AS ?avgValue)
FROM NAMED WINDOW <mqtt://localhost:1883/wearableX> ON STREAM mqtt_broker:wearableX [RANGE 120000 STEP 60000]
FROM NAMED WINDOW <mqtt://localhost:1883/smartphoneX> ON STREAM mqtt_broker:smartphoneX [RANGE 120000 STEP 60000]
WHERE {
    {
        WINDOW <mqtt://localhost:1883/wearableX> {
            ?s1 saref:hasValue ?value .
            ?s1 saref:relatesToProperty dahccsensors:wearableX .
        }
    } UNION {
        WINDOW <mqtt://localhost:1883/smartphoneX> {
            ?s2 saref:hasValue ?value .
            ?s2 saref:relatesToProperty dahccsensors:smartphoneX .
        }
    }
}
  `

    console.log(new RSPQLParser().parse(query).sparql);

    const r2s_topic = "client_operation_output";
    const client = new FetchingAllDataClientSide(query, r2s_topic);
    client.process_streams();
}

clientSideProcessing().catch((error) => {
    console.error("Error during client-side processing:", error);
});
