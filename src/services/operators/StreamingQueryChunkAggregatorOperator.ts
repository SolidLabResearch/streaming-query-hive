import { RSPQLParser } from "rsp-js";
import { RewriteChunkQuery } from "hive-thought-rewriter"
import { RSPQueryProcess } from "../../rsp/RSPQueryProcess";
import { hash_string_md5, storeToString } from "../../util/Util";
import { R2ROperator } from "./r2r";
import mqtt from "mqtt";
import { CSVLogger } from "../../util/logger/CSVLogger";
import { IQueryOperator } from "../../util/Interfaces";
const N3 = require('n3');

/**
 *
 */
export class StreamingQueryChunkAggregatorOperator implements IQueryOperator {

    public subQueries: string[];
    public outputQuery: string = '';
    private parser: RSPQLParser;
    private queryMQTTTopicMap !: Map<string, string>;
    private subQueryMQTTTopicMap: Map<string, string> = new Map<string, string>();
    private chunkGCD: number;
    private logger: CSVLogger;
    private mqttBroker: string = 'mqtt://localhost:1883'; // Default MQTT broker URL, can be changed if needed
    /**
     *
     */
    constructor() {
        this.subQueries = [];
        this.parser = new RSPQLParser();
        this.chunkGCD = 0;
        this.logger = new CSVLogger("streaming_query_chunk_aggregator_log.csv");
    }

    /**
     *
     */
    public async init() {
        this.logger.log("init() called");
        await this.setMQTTTopicMap();
        this.logger.log("StreamingQueryChunkAggregatorOperator initialized.");
    }

    /**
     *
     * @param query
     */
    addOutputQuery(query: string): void {
        this.outputQuery = query;
    }

    /**
     *
     */
    async setMQTTTopicMap(): Promise<void> {
        this.logger.log("setMQTTTopicMap() called");
        this.queryMQTTTopicMap = new Map<string, string>();
        this.logger.log(`MQTT Topic Map set for subqueries: ${JSON.stringify(this.queryMQTTTopicMap)}`);
        const response = await fetch("http://localhost:8080/fetchQueries");
        if (!response.ok) {
            console.error("Failed to fetch queries from the server.");
            return;
        }
        const data = await response.json();
        // Log the full structure for debugging
        this.logger.log(`Fetched data from server (full JSON): ${JSON.stringify(data, null, 2)}`);

        for (const [queryHash, mqttTopic] of Object.entries(data)) {
            const topicString = mqttTopic;

            this.queryMQTTTopicMap.set(queryHash as string, topicString as string);
            this.logger.log(`DEBUG: queryMQTTTopicMap after set: ${JSON.stringify(Array.from(this.queryMQTTTopicMap.entries()))}`);
            this.logger.log(`Subquery ${queryHash} mapped to MQTT Topic ${topicString}`);
        }
    }


    /**
     *
     */
    async handleAggregation(): Promise<void> {
        this.logger.log("Starting aggregation process for subqueries.");
        await this.initializeSubQueryProcesses();
        this.logger.log("SubQuery Processes initialized for aggregation.");

        if (this.subQueries.length === 0) {
            this.logger.log("No subqueries available for aggregation.");
            console.error("No subqueries available for aggregation.");
            return;
        }
        if (this.outputQuery === '') {
            this.logger.log("Output query is not set for aggregation.");
            console.error("Output query is not set for aggregation.");
            return;
        }
        if (this.chunkGCD <= 0) {
            this.logger.log("Chunk GCD is not valid for aggregation."); 
            console.error("Chunk GCD is not valid for aggregation.");
            return;
        }
        if (this.queryMQTTTopicMap.size === 0) {
            this.logger.log("No MQTT topics mapped for subqueries.");
            return;
        }

        this.logger.log(`Starting aggregation of subqueries with GCD chunk size: ${this.chunkGCD}`);

        if (!this.outputQuery) {
            console.error("Output query is not set or is undefined.");
            return;
        }
        const outputQueryParsed = this.parser.parse(this.outputQuery);
        if (!outputQueryParsed) {
            console.error(`Failed to parse output query: ${this.outputQuery}`);
            return;
        }

        const outputQueryWidth = outputQueryParsed.s2r[0].width;
        const outputQuerySlide = outputQueryParsed.s2r[0].slide;
        if (outputQueryWidth <= 0 || outputQuerySlide <= 0) {
            console.error(`Invalid width or slide in output query: ${this.outputQuery}`);
            return;
        }

        const rsp_client = mqtt.connect(this.mqttBroker);
        this.logger.log(`Connecting to MQTT broker at ${this.mqttBroker}...`);
        rsp_client.on("error", (err) => {
            console.error("MQTT connection error:", err);
        });
        rsp_client.on("offline", () => {
            console.error("MQTT client is offline. Please check the broker connection.");
        });
        rsp_client.on("reconnect", () => {
            this.logger.log("Reconnecting to MQTT broker...");
        });

        const that = this;

        rsp_client.on("connect", () => {

            this.logger.log(`subQueryTopicMap : ${JSON.stringify(that.subQueryMQTTTopicMap)}`);
            const topics = Array.from(that.subQueryMQTTTopicMap.values());
            this.logger.log(`topics to subscribe: ${topics}`);
            // TODO : Remove hardcoded topics, use the topics from subQueryMQTTTopicMap but currently there is a bug in the subQueryMQTTTopicMap that prevents it from being used correctly.
            // TODO : Such that only one topic is subscribed to at a time.
            let topicsOfProcesses: string[] = ["chunked/f8eec45a01e39e93d117673df8915525", "chunked/b22681cadced9975b3b35cb47f82bb40"];

            topicsOfProcesses = topics;

            this.logger.log(`DEBUG: topicsOfProcesses after loop: ${topicsOfProcesses}, length: ${topicsOfProcesses.length}`);
            if (topicsOfProcesses.length === 0) {
                this.logger.log('No valid MQTT topics to subscribe to. Please check the subQueryMQTTTopicMap.');
                return;
            }
            for (const mqttTopic of topicsOfProcesses) {
                rsp_client.subscribe(`${mqttTopic}`, (err) => {
                    if (err) {
                        this.logger.log(`Failed to subscribe to topic ${mqttTopic}: ${err}`);
                    } else {
                        this.logger.log(`Subscribed to topic: ${mqttTopic}`);
                    }
                });
            }

            // Data structure to collect all chunks with timestamps
            let allChunks: { data: string, timestamp: number }[] = [];
            const chunksRequired = Math.ceil(outputQueryWidth / this.chunkGCD) * this.subQueries.length;
            this.logger.log(`Chunks required for aggregation: ${chunksRequired}`);
            this.logger.log(`Output Query Width: ${outputQueryWidth}, Chunk GCD: ${this.chunkGCD}, SubQueries Length: ${this.subQueries.length}`);

            rsp_client.on("message", (topic, message) => {
                this.logger.log(`Received message on topic ${topic}: ${message.toString()}`);
                allChunks.push({ data: message.toString(), timestamp: Date.now() });
                
            });

            // Sliding window: evaluate every outputQuerySlide ms, using last outputQueryWidth ms of data
            setInterval(async () => {
                const now = Date.now();
                const windowStart = now - outputQueryWidth;
                const windowChunks = allChunks.filter(chunk => chunk.timestamp >= windowStart);
                if (windowChunks.length > 0) {
                    this.logger.log(`Sliding window evaluation. Number of chunks in the window: ${windowChunks.length}`);
                    this.logger.log(`Window start timestamp: ${windowStart}, Current time: ${now}`);
                    this.logger.log(`Window chunks: ${JSON.stringify(windowChunks)}`);
                    this.logger.log("Sliding window evaluation. Aggregating and triggering R2R...");
                    await this.executeR2ROperator(windowChunks.map(chunk => chunk.data));
                } else {
                    this.logger.log("Sliding window: no chunks to aggregate.");
                }
                // Optionally, remove old chunks to keep buffer small
                allChunks = allChunks.filter(chunk => chunk.timestamp >= windowStart);
            }, outputQuerySlide);

        });
    }



    /**
     *
     * @param chunks
     */
    async executeR2ROperator(chunks: string[]): Promise<void> {
        this.logger.log(`Executing the R2R Operator with results: ${chunks}`);

        /*
For example, the allResults object might look like this:
          chunks: [
    '"<https://rsp.js/aggregation_event/89302616-a8d1-4a99-8b97-1f7efac51d88> <https://saref.etsi.org/core/hasTimestamp> \\"1749592410235\\"^^<http://www.w3.org/2001/XMLSchema#long> .\\n    <https://rsp.js/aggregation_event/89302616-a8d1-4a99-8b97-1f7efac51d88> <https://saref.etsi.org/core/hasValue> \\"-22.666666666666668\\"^^<http://www.w3.org/2001/XMLSchema#float> ."',
    '"<https://rsp.js/aggregation_event/b31b1867-f310-4c39-8379-893044ab517d> <https://saref.etsi.org/core/hasTimestamp> \\"1749592410517\\"^^<http://www.w3.org/2001/XMLSchema#long> .\\n    <https://rsp.js/aggregation_event/b31b1867-f310-4c39-8379-893044ab517d> <https://saref.etsi.org/core/hasValue> \\"-4.2\\"^^<http://www.w3.org/2001/XMLSchema#float> ."',
    '"<https://rsp.js/aggregation_event/65223e5b-711e-4c8a-95ab-878df02fec83> <https://saref.etsi.org/core/hasTimestamp> \\"1749592710780\\"^^<http://www.w3.org/2001/XMLSchema#long> .\\n    <https://rsp.js/aggregation_event/65223e5b-711e-4c8a-95ab-878df02fec83> <https://saref.etsi.org/core/hasValue> \\"-22.857142857142858\\"^^<http://www.w3.org/2001/XMLSchema#float> ."',
    '"<https://rsp.js/aggregation_event/6848a43f-b852-4914-81d0-c40c3f3840bc> <https://saref.etsi.org/core/hasTimestamp> \\"1749592710869\\"^^<http://www.w3.org/2001/XMLSchema#long> .\\n    <https://rsp.js/aggregation_event/6848a43f-b852-4914-81d0-c40c3f3840bc> <https://saref.etsi.org/core/hasValue> \\"-4.285714285714286\\"^^<http://www.w3.org/2001/XMLSchema#float> ."',
    '"<https://rsp.js/aggregation_event/6e9d0962-02ac-4424-8211-e0e44c609a12> <https://saref.etsi.org/core/hasTimestamp> \\"1749592740597\\"^^<http://www.w3.org/2001/XMLSchema#long> .\\n    <https://rsp.js/aggregation_event/6e9d0962-02ac-4424-8211-e0e44c609a12> <https://saref.etsi.org/core/hasValue> \\"-22.7\\"^^<http://www.w3.org/2001/XMLSchema#float> ."',
    '"<https://rsp.js/aggregation_event/0d4e9551-fe52-4bb1-a186-c342c091fe6d> <https://saref.etsi.org/core/hasTimestamp> \\"1749592740995\\"^^<http://www.w3.org/2001/XMLSchema#long> .\\n    <https://rsp.js/aggregation_event/0d4e9551-fe52-4bb1-a186-c342c091fe6d> <https://saref.etsi.org/core/hasValue> \\"-4.2\\"^^<http://www.w3.org/2001/XMLSchema#float> ."',
    '"<https://rsp.js/aggregation_event/0a3bcc3b-acb8-4d52-985b-185a2db9b4dd> <https://saref.etsi.org/core/hasTimestamp> \\"1749592770111\\"^^<http://www.w3.org/2001/XMLSchema#long> .\\n    <https://rsp.js/aggregation_event/0a3bcc3b-acb8-4d52-985b-185a2db9b4dd> <https://saref.etsi.org/core/hasValue> \\"-4.103448275862069\\"^^<http://www.w3.org/2001/XMLSchema#float> ."',
    '"<https://rsp.js/aggregation_event/327ae8b1-52a1-48f8-9749-324000a75a45> <https://saref.etsi.org/core/hasTimestamp> \\"1749592770747\\"^^<http://www.w3.org/2001/XMLSchema#long> .\\n    <https://rsp.js/aggregation_event/327ae8b1-52a1-48f8-9749-324000a75a45> <https://saref.etsi.org/core/hasValue> \\"-23\\"^^<http://www.w3.org/2001/XMLSchema#float> ."'
  ]
        */
        const store = new N3.Store();
        const parser = new N3.Parser();
        for (const chunk of chunks) {
            let chunkString = chunk;
            // If chunk is a JSON string, parse it
            try {
                if (chunkString.startsWith('"') && chunkString.endsWith('"')) {
                    chunkString = JSON.parse(chunkString);
                }
            } catch (e) {
                this.logger.log(`DEBUG: Could not JSON.parse chunk: ${chunkString}`);
            }
            try {
                const quads = parser.parse(chunkString);
                store.addQuads(quads);
            } catch (e) {
                this.logger.log(`DEBUG: Could not parse chunk as Turtle: ${chunkString}`);
            }
        }
        this.logger.log(storeToString(store));
        const detectAggregationFunction = this.detectAggregationFunction(this.outputQuery);
        if (!detectAggregationFunction) {
            console.error("No aggregation function detected in the output query.");
            return;
        }
        const aggregationSPARQLQuery = this.getAggregationSPARQLQuery(detectAggregationFunction, 'o');
        if (!aggregationSPARQLQuery) {
            console.error("Failed to generate aggregation SPARQL query.");
            return;
        }
        this.logger.log(`Generated Aggregation SPARQL Query: ${aggregationSPARQLQuery}`);
        const r2rOperator = new R2ROperator(aggregationSPARQLQuery);
        const bindingStream = await r2rOperator.execute(store);
        if (!bindingStream) {
            console.error("Failed to execute R2R Operator.");
            return;
        }
        bindingStream.on('data', (data: any) => {
            this.logger.log(`R2R Operator Data Received: ${data}`);
            const outputQueryEvent = this.generateOutputQueryEvent(data.get('result').value);
            this.logger.log(`Generated Output Query Event: ${outputQueryEvent}`);
            // Publish the output query event to the MQTT broker
            const rsp_client = mqtt.connect(this.mqttBroker);
            rsp_client.on("connect", () => {
                const outputTopic = `output`;
                this.logger.log(`calculated result ${outputQueryEvent}`);

                rsp_client.publish(outputTopic, outputQueryEvent, (err: any) => {
                    if (err) {
                        console.error(`Error publishing output query event to topic ${outputTopic}:`, err);
                    } else {
                        this.logger.log(`Output query event published to topic ${outputTopic}`);
                    }
                });
            });
            rsp_client.on("error", (err) => {
                console.error("MQTT connection error:", err);
            });
            rsp_client.on("offline", () => {
                console.error("MQTT client is offline. Please check the broker connection.");
            }
            );
            rsp_client.on("reconnect", () => {
                this.logger.log("Reconnecting to MQTT broker...");
            }
            );
        });
    }

    /**
     *
     * @param data
     */
    generateOutputQueryEvent(data: any): string {
        const uuid_random = uuidv4();
        return ` <https://rsp.js/outputQueryEvent/${uuid_random}> <https://saref.etsi.org/core/hasValue> "${data}"^^<http://www.w3.org/2001/XMLSchema#float> .`
    }

    /**
     *
     */
    async initializeSubQueryProcesses(): Promise<void> {
        this.logger.log(`Initializing subquery processes.`);
        this.logger.log(`DEBUG: subQueries length: ${this.subQueries.length}`);
        this.logger.log(`DEBUG: subQueries: ${JSON.stringify(this.subQueries)}`);
        this.logger.log(`DEBUG: outputQuery: ${this.outputQuery}`);
        const chunkSize = this.findGCDChunk(this.subQueries, this.outputQuery);
        this.logger.log(`Calculated GCD Chunk Size: ${chunkSize}`);
        this.chunkGCD = chunkSize;
        const rewrittenChunkQueries: string[] = [];
        if (chunkSize > 0) {
            const rewriteChunkQuery = new RewriteChunkQuery(chunkSize, chunkSize);
            for (let i = 0; i < this.subQueries.length; i++) {
                const subQuery = this.subQueries[i];
                this.logger.log(`DEBUG: Rewriting subQuery ${i}: ${subQuery}`);
                const rewrittenQuery = rewriteChunkQuery.rewriteQueryWithNewChunkSize(subQuery);
                this.logger.log(`Rewritten SubQuery ${i}: ${rewrittenQuery}`);
                rewrittenChunkQueries.push(rewrittenQuery);
            }

            // Collect all promises
            const allPromises: Promise<void>[] = [];
            for (let i = 0; i < rewrittenChunkQueries.length; i++) {
                const hash_subQuery = hash_string_md5(rewrittenChunkQueries[i]);
                this.logger.log(`DEBUG: Setting subQueryMQTTTopicMap[${hash_subQuery}] = chunked/${hash_subQuery}`);
                this.subQueryMQTTTopicMap.set(hash_subQuery, `chunked/${hash_subQuery}`);
                this.logger.log(`DEBUG: subQueryMQTTTopicMap after set: ${JSON.stringify(Array.from(this.subQueryMQTTTopicMap.entries()))}`);
                const rspQueryProcess = new RSPQueryProcess(rewrittenChunkQueries[i], `chunked/${hash_subQuery}`);
                this.logger.log(`chunked/${hash_subQuery} topic created for rewrittenChunkQueries: ${rewrittenChunkQueries[i]}: ${rewrittenChunkQueries[i]}`);
                const p = rspQueryProcess.stream_process().then(() => {
                    this.logger.log(`Topic chunked/${hash_subQuery} created for subquery ${i}`);
                    this.logger.log(`RSP Query Process started for subquery ${i}: ${rewrittenChunkQueries[i]}`);
                }).catch((error) => {
                    console.error(`Error starting RSP Query Process for subquery ${i}: ${rewrittenChunkQueries[i]}`, error);
                });
                allPromises.push(p);
            }
            // Wait for all subquery processes to finish initializing
            await Promise.all(allPromises);
            this.logger.log(`DEBUG: Final subQueryMQTTTopicMap: ${JSON.stringify(Array.from(this.subQueryMQTTTopicMap.entries()))}`);
        } else {
            console.error("Failed to find a valid chunk size for the aggregation.");
            this.logger.log("Failed to find a valid chunk size for the aggregation.");
        }
    }

    /**
     *
     * @param subQueries
     * @param outputQuery
     */
    findGCDChunk(subQueries: string[], outputQuery: string): number {
        const window_parameters: number[] = [];
        for (let i = 0; i < subQueries.length; i++) {
            const subQueryParsed = this.parser.parse(subQueries[i]);
            this.logger.log(`Parsed subquery ${i}: ${JSON.stringify(subQueryParsed)}`);

            if (subQueryParsed) {
                for (const s2r of subQueryParsed.s2r) {
                    window_parameters.push(s2r.width);
                    window_parameters.push(s2r.slide);
                }
            }
            else {
                console.error(`Failed to parse subquery: ${subQueries[i]}`);
            }
        }

        const outputQueryParsed = this.parser.parse(outputQuery);
        this.logger.log(`Parsed output query: ${JSON.stringify(outputQueryParsed)}`);

        if (outputQueryParsed) {
            for (const s2r of outputQueryParsed.s2r) {
                window_parameters.push(s2r.width);
                window_parameters.push(s2r.slide);
            }
        } else {
            console.error(`Failed to parse output query: ${outputQuery}`);
        }
        // Find the GCD of the window parameters
        return this.findGCD(window_parameters);
    }

    /**
     *
     * @param arr
     */
    findGCD(arr: number[]): number {
        if (arr.length === 0) {
            return 1;
        }
        const gcd = (a: number, b: number): number => {
            return b === 0 ? a : gcd(b, a % b);
        };

        return arr.reduce((acc, val) => gcd(acc, val), arr[0]);
    }

    /**
     *
     * @param arr
     */
    findLCM(arr: number[]): number {
        const lcm = (a: number, b: number): number => {
            return (a * b) / this.findGCD([a, b]);
        };

        return arr.reduce((acc, val) => lcm(acc, val), 1);
    }

    /**
     *
     * @param query
     */
    addSubQuery(query: string): void {
        this.subQueries.push(query);
        if (this.logger) {
            this.logger.log(`addSubQuery called. Current subQueries length: ${this.subQueries.length}`);
            this.logger.log(`addSubQuery called. Current subQueries: ${JSON.stringify(this.subQueries)}`);
        }
    }

    /**
     *
     * @param query
     */
    setOutputQuery(query: string): void {
        this.outputQuery = query;
        this.logger.log(`Output query set: ${this.outputQuery}`);
        if (this.outputQuery === '') {
            console.error("Output query is empty. Please set a valid output query.");
        }
    }
    /**
     *
     */
    getOutputQuery(): string {
        return this.outputQuery ?? "";
    }
    /**
     *
     */
    getSubQueries(): string[] {
        return this.subQueries;
    }
    /**
     *
     */
    clearSubQueries(): void {
        this.subQueries = [];
    }

    /**
     *
     * @param query
     */
    detectAggregationFunction(query: string): string | null {
        const aggregationFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
        for (const func of aggregationFunctions) {
            if (query.includes(func)) {
                return func;
            }
        }
        return null;
    }

    /**
     *
     * @param aggregationFunction
     * @param variable
     */
    getAggregationSPARQLQuery(aggregationFunction: string, variable: string): string {
        const allowedFunctions = ['AVG', 'SUM', 'COUNT', 'MIN', 'MAX'];

        if (!aggregationFunction || !variable) {
            console.error("Missing aggregation function or variable.");
            return '';
        }

        aggregationFunction = aggregationFunction.toUpperCase();
        if (!allowedFunctions.includes(aggregationFunction)) {
            console.error("Invalid aggregation function.");
            return '';
        }

        if (!variable.startsWith('?')) {
            variable = '?' + variable;
        }

        return `SELECT (${aggregationFunction}(${variable}) AS ?result) WHERE { ?s ?p ${variable} }`;
    }

    /**
     *
     * @param ms
     */
    sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


}

/**
 *
 */
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
