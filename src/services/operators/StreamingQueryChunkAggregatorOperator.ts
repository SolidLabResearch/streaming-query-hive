import { RSPQLParser } from "../../util/parser/RSPQLParser";
import { RewriteChunkQuery } from "hive-thought-rewriter"
import { RSPQueryProcess } from "../../rsp/RSPQueryProcess";
import { hash_string_md5 } from "../../util/Util";
import mqtt from "mqtt/*";
import { computeWindowIfAbsent } from "./s2r";
/**
 *
 */
export class StreamingQueryChunkAggregatorOperator {

    public subQueries: string[];
    public outputQuery: string;
    private parser: RSPQLParser;
    private queryMQTTTopicMap: Map<string, string>;
    private chunkGCD: number;
    private mqttBroker: string = 'mqtt://localhost:1883'; // Default MQTT broker URL, can be changed if needed
    /**
     *
     */
    constructor() {
        this.subQueries = [];
        this.outputQuery = '';
        this.parser = new RSPQLParser();
        this.queryMQTTTopicMap = new Map<string, string>();
        this.chunkGCD = 0;
    }

    /**
     *
     */
    handleAggregation(): void {
        this.initializeSubQueryProcesses();
        console.log("SubQuery Processes initialized for aggregation.");
        if (this.subQueries.length === 0) {
            console.error("No subqueries available for aggregation.");
            return;
        }
        if (this.outputQuery === '') {
            console.error("Output query is not set for aggregation.");
            return;
        }

        if (this.chunkGCD <= 0) {
            console.error("Chunk GCD is not valid for aggregation.");
            return;
        }

        if (this.queryMQTTTopicMap.size === 0) {
            console.error("No MQTT topics mapped for subqueries.");
            return;
        }

        console.log("Starting aggregation of subqueries with GCD chunk size:", this.chunkGCD);

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
        rsp_client.on("connect", () => {
            console.log(`Connected to MQTT broker at ${this.mqttBroker}`);
            // Store partial results per hash_subQuery
            const partialResults: Map<string, any[]> = new Map<string, any[]>();
            // Calculate the chunk size for the output query based on the GCD
            const numbersOfChunksRequiredForOutputQuery = Math.ceil(outputQueryWidth / this.chunkGCD);
            // Set of expected subqueries with topics
            const expectedSubQueries = new Set(this.queryMQTTTopicMap.keys());

            // Mao to hold the final full data for each subquery after the chunks are received
            const finalResults: Map<string, any[]> = new Map<string, any[]>();

            for (const [hash_subQuery, mqttTopic] of this.queryMQTTTopicMap.entries()) {
                console.log(`SubQuery ${hash_subQuery} is mapped to MQTT Topic ${mqttTopic}`);
                rsp_client.subscribe(`chunked/${hash_subQuery}`, (err) => {
                    if (err) {
                        console.error(`Failed to subscribe to output query topic: chunked/${hash_subQuery}`, err);
                    } else {
                        console.log(`Subscribed to output query topic: chunked/${hash_subQuery}`);
                    }
                });

                rsp_client.on("message", async (topic, message) => {
                    const hash_subQuery = topic.split("/")[1];
                    console.log(`Received message for subquery ${hash_subQuery}:`, message.toString());
                    const payload = JSON.parse(message.toString());
                    if (!partialResults.has(hash_subQuery)) {
                        partialResults.set(hash_subQuery, []);
                    }

                    partialResults.get(hash_subQuery)?.push(payload);
                    console.log(`Partial results for subquery ${hash_subQuery}:`, partialResults.get(hash_subQuery));


                    const chunkArray = partialResults.get(hash_subQuery);

                    if (chunkArray?.length === numbersOfChunksRequiredForOutputQuery) {
                        console.log(`Most of the chunks are received for subquery ${hash_subQuery}. Processing aggregation...`);
                        finalResults.set(hash_subQuery, chunkArray);
                        partialResults.delete(hash_subQuery);
                    }

                    const allCompleted = [...expectedSubQueries].every(queries => finalResults.has(queries));

                    if (allCompleted) {
                        console.log(`All subqueries have completed. Aggregating final results...`);

                        const allResults: Record<string, any[]> = {};

                        for (const [subQueryHash, results] of finalResults.entries()) {
                            allResults[subQueryHash] = results;
                        }

                        await this.executeR2ROperator(allResults);

                        finalResults.clear();

                    }

                });

            }

        });


    }


    async executeR2ROperator(allResults: Record<string, any[]>): Promise<void> {
        console.log(`Executing the R2R Operator with results:`, allResults);        
    }

    async initializeSubQueryProcesses(): Promise<void> {
        const chunkSize = this.findGCDChunk(this.subQueries, this.outputQuery);
        console.log(`Calculated GCD Chunk Size: ${chunkSize}`);
        this.chunkGCD = chunkSize;
        let rewrittenChunkQueries: string[] = [];
        if (chunkSize > 0) {
            const rewriteChunkQuery = new RewriteChunkQuery(chunkSize, chunkSize);
            for (let i = 0; i < this.subQueries.length; i++) {
                const subQuery = this.subQueries[i];
                const rewrittenQuery = rewriteChunkQuery.rewriteQueryWithNewChunkSize(subQuery);
                console.log(`Rewritten SubQuery ${i}: ${rewrittenQuery}`);
                rewrittenChunkQueries.push(rewrittenQuery);
            }

            for (let i = 0; i < rewrittenChunkQueries.length; i++) {
                // Starting a RSP Query Process for each subwritten query
                // which will be combined to create the final output query
                const hash_subQuery = hash_string_md5(rewrittenChunkQueries[i]);
                this.queryMQTTTopicMap.set(hash_subQuery, `chunked/${hash_subQuery}`);
                const rspQueryProcess = new RSPQueryProcess(rewrittenChunkQueries[i], this.queryMQTTTopicMap.get(hash_subQuery)!);
                rspQueryProcess.stream_process().then(() => {
                    console.log(`RSP Query Process started for subquery ${i}: ${rewrittenChunkQueries[i]}`);
                }).catch((error) => {
                    console.error(`Error starting RSP Query Process for subquery ${i}: ${rewrittenChunkQueries[i]}`, error);
                });

            }


        } else {
            console.error("Failed to find a valid chunk size for the aggregation.");
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
    }

    /**
     *
     * @param query
     */
    setOutputQuery(query: string): void {
        this.outputQuery = query;
    }
    /**
     *
     */
    getOutputQuery(): string {
        return this.outputQuery;
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

}