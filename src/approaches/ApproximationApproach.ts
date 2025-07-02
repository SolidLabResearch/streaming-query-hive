import { QueryCombiner } from "hive-thought-rewriter";
import { RSPQLParser } from "rsp-js";
import mqtt from "mqtt";
import { ContainmentChecker } from "rspql-containment-checker";
import { ExtractedQuery, QueryMap } from "../util/Types";
import { generateQuery } from "../util/Util";
import { CSVLogger } from "../util/logger/CSVLogger";
import fs from "fs";

/**
 *
 */
export class ApproximationApproach {
    public query: string;
    public r2s_topic: string;
    private queryFetchLocation: string;
    private queryMQTTTopicMap !: Map<string, string>;
    private containmentChecker: ContainmentChecker;
    private queryCombiner: QueryCombiner;
    private queryParser: RSPQLParser;
    private mqttBroker: string = 'mqtt://localhost:1883'; // Default MQTT broker URL, can be changed if needed
    private containedQueriesForApproximation: string[];
    private logger: CSVLogger;

    /**
     *
     * @param query
     * @param r2s_topic
     */
    constructor(query: string, r2s_topic: string) {
        this.containmentChecker = new ContainmentChecker();
        this.queryCombiner = new QueryCombiner();
        this.query = query;
        this.r2s_topic = r2s_topic;
        this.queryFetchLocation = "http://localhost:8080/fetchQueries";
        this.containedQueriesForApproximation = [];
        this.queryParser = new RSPQLParser();
        this.logger = new CSVLogger("approximation_log.csv");
        this.logger.log('approximation_query_registered');
        if (!query || !r2s_topic) {
            throw new Error("Missing required parameters: query and r2s_topic");
        }
    }

    /**
     *
     */
    public async process() {
        const existingQueries = await this.fetchExistingQueries(this.queryFetchLocation);
        if (!existingQueries) {
            console.log("No existing queries found at the specified location.");
            return;
        }
        console.log(`Fetched existing queries:`, existingQueries);
        const extractedQueries = await this.extractQueriesWithTopics(JSON.parse(existingQueries) as QueryMap);
        const topicWindowParams = buildTopicWindowParams(extractedQueries);
        // Buffer to store recent window results (window objects, not raw values)
        const windowBuffer: Array<{ start: number, end: number, value: number, agg: string, queryId?: string }> = [];
        const lastTriggerTime = Date.now();

        const containedQueries = await this.findContainedQueries(extractedQueries);

        console.log(`Extracted queries:`, extractedQueries);

        console.log(`Found ${containedQueries.length} contained queries.`);
        if (containedQueries.length > 0) {
            for (const containedQuery of containedQueries) {
                this.queryCombiner.addQuery(containedQuery);
            }
            this.queryCombiner.combine();
            console.log(`Combined query: ${this.queryCombiner.ParsedToString(this.queryCombiner.combine())}`);
            const combinedQuery = this.queryCombiner.ParsedToString(this.queryCombiner.combine());

            const isValid = await this.validateQueryContainment(this.query, combinedQuery);
            if (isValid) {
                for (const containedQuery of containedQueries) {
                    this.containedQueriesForApproximation.push(containedQuery);
                }
                await this.setMQTTTopicMap();
                this.processApproximationApproach(topicWindowParams);
            } else {
                console.log(`The subqueries are contained but however the combined query cannot be utilized to make the original registered query.`);
            }

        } else {
            console.log("No contained queries found.");
        }
    }


    /**
     *
     * @param topicWindowParams
     */
    async processApproximationApproach(topicWindowParams: any) {
        if (this.queryMQTTTopicMap.size === 0) {
            console.log("No MQTT topics found for the queries.");
            return;
        }

        const outputQueryParsed = this.queryParser.parse(this.query);
        const outputQueryWidth = outputQueryParsed.s2r[0].width;
        const outputQuerySlide = outputQueryParsed.s2r[0].slide;

        const existingQueries = await this.fetchExistingQueries(this.queryFetchLocation);

        if (!existingQueries) {
            console.log("No existing queries found at the specified location.");
            return;
        }

        const extractedQueries = await this.extractQueriesWithTopics(JSON.parse(existingQueries) as QueryMap);
        if (extractedQueries.length === 0) {
            console.log("No queries with topics found in the fetched data.");
            return;
        }

        const s2rQueries = extractedQueries.map(query => this.queryParser.parse(query.rspql_query).s2r[0]);
        if (s2rQueries.length === 0) {
            console.log("No S2R queries found in the extracted queries.");
            return;
        }



        if (outputQueryWidth <= 0 || outputQuerySlide <= 0) {
            console.log("Invalid output query width or slide. Cannot proceed with approximation.");
            return;
        }

        const rsp_client = mqtt.connect(this.mqttBroker);
        rsp_client.on("error", (err) => {
            console.error("MQTT connection error:", err);
        });
        rsp_client.on("offline", () => {
            console.error("MQTT client is offline. Please check the broker connection.");
        });
        rsp_client.on("reconnect", () => {
            console.log("Reconnecting to MQTT broker...");
        });

        const that = this;

        rsp_client.on('connect', () => {
            const topics = Array.from(this.queryMQTTTopicMap.values());
            if (topics.length === 0) {
                console.log("No MQTT topics found for the queries.");
                return;
            }


            // topics is an array of objects, so extract r2s_topic from each
            const r2sTopics = topics.map((item: any) => typeof item === 'object' && item !== null ? item.r2s_topic : item);
            if (r2sTopics.length === 0) {
                console.log("No r2s topics found for the queries.");
                return;
            }
            // Now r2sTopics is an array of topic strings to subscribe to

            for (const mqttTopic of r2sTopics) {
                rsp_client.subscribe(mqttTopic, (err) => {
                    if (err) {
                        console.error(`Failed to subscribe to topic ${mqttTopic}:`, err);
                    } else {
                        console.log(mqttTopic);

                        console.log(`Subscribed to topic ${mqttTopic}`);
                    }
                });
            }

            // Buffer to store recent window results
            const windowBuffer: Array<{ start: number, end: number, value: number, agg: string }> = [];
            let lastTriggerTime = Date.now();

            // Add the approximation logic for the queries to create result for the original query
            rsp_client.on("message", (topic: string, message: any) => {

                console.log(`Received message on topic ${topic}:`, message.toString());

                try {
                    const data = message.toString();
                    const value = parseFloat(data);
                    const now = Date.now();
                    const params = topicWindowParams[topic];
                    if (!params) {
                        console.warn(`No window parameters found for topic ${topic}`);
                        return;
                    }
                    const windowEnd = now;
                    const windowStart = windowEnd - params.width;
                    const result = {
                        start: windowStart,
                        end: windowEnd,
                        value,
                        agg: params.agg
                    };
                    windowBuffer.push(result);

                    // Remove old windows outside the output window width
                    const windowStartGlobal = now - outputQueryWidth;
                    while (windowBuffer.length && windowBuffer[0].end < windowStartGlobal) {
                        windowBuffer.shift();
                    }

                    console.log(`Current window buffer:`, windowBuffer);
                    console.log(`Current window buffer length:`, windowBuffer.length);

                    // Trigger every output window slide
                    if (Date.now() - lastTriggerTime >= outputQuerySlide) {
                        lastTriggerTime = Date.now();

                        // Find the subqueries length and their overlap
                        if (windowBuffer.length >= r2sTopics.length) {
                            const win1 = windowBuffer[windowBuffer.length - 2];
                            const win2 = windowBuffer[windowBuffer.length - 1];

                            console.log(`Processing windows:`, win1, win2);

                            // Calculate overlap window
                            const overlapStart = Math.max(win1.start, win2.start);
                            console.log(`Overlap start: ${overlapStart}`);
                            const overlapEnd = Math.min(win1.end, win2.end);
                            console.log(`Overlap end: ${overlapEnd}`);

                            const overlapDur = Math.max(0, overlapEnd - overlapStart);

                            // FIX : Calculate Overlap in a more robust way
                            // Estimate overlap value (simple average, or use actual if available)
                            const overlapValue = (win1.value + win2.value) / 2; 
                            console.log(`Overlap duration: ${overlapDur}`);

                            const overlap = { start: overlapStart, end: overlapEnd, value: overlapValue };
                            const target = { start: windowStartGlobal, end: now };
                            const agg = win2.agg as 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';

                            console.log(`Merging results for output window [${target.start}, ${target.end}] with overlap [${overlap.start}, ${overlap.end}]`);
                            console.log(`Window 1: [${win1.start}, ${win1.end}] with value ${win1.value}`);
                            console.log(`Window 2: [${win2.start}, ${win2.end}] with value ${win2.value}`);
                            console.log(`Overlap: [${overlap.start}, ${overlap.end}] with value ${overlap.value}`);

                            const merged = mergeMultipleSlidingWindowResults(windowBuffer, target, agg);
                            // const merged = mergeSlidingWindowResults(win1, win2, overlap, target, agg);

                            rsp_client.publish(this.r2s_topic, JSON.stringify(merged));
                            console.log(`Merged result for output window [${target.start}, ${target.end}]:`, merged);
                            this.logger.log(`received_result,${topic},${merged}`);
                        }
                    }

                } catch (error) {
                    console.log(`There is an error processing the message from topic ${topic}:`, error);
                }
            });

            // Start a timer to trigger aggregation every outputQuerySlide ms
            setInterval(() => {
                const now = Date.now();
                const windowStartGlobal = now - outputQueryWidth;
                // Remove old windows outside the output window width
                while (windowBuffer.length && windowBuffer[0].end < windowStartGlobal) {
                    windowBuffer.shift();
                }
                // Aggregate all windows in the buffer that overlap the output window
                if (windowBuffer.length > 0) {
                    const target = { start: windowStartGlobal, end: now };
                    const agg = windowBuffer[windowBuffer.length - 1].agg as 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
                    const merged = mergeMultipleSlidingWindowResults(windowBuffer, target, agg);
                    console.log(`Merged result for output window [${target.start}, ${target.end}]:`, merged);
                    this.logger.log(`interval ${JSON.stringify(merged)}`);
                }
            }, outputQuerySlide);

        });

    }

    /**
     *
     */
    async setMQTTTopicMap(): Promise<void> {
        this.queryMQTTTopicMap = new Map<string, string>();
        const response = await fetch(this.queryFetchLocation, {});
        if (!response.ok) {
            throw new Error(`Failed to fetch queries from ${this.queryFetchLocation}. Status: ${response.status}`);
        }

        const data = await response.json();

        for (const [queryHash, mqttTopic] of Object.entries(data)) {
            this.queryMQTTTopicMap.set(queryHash, mqttTopic as string);
        }
    }


    /**
     *
     * @param location
     */
    async fetchExistingQueries(location: string): Promise<string> {
        if (!location) {
            throw new Error("Location for fetching queries is not specified");
        }
        const response = await fetch(location, {
            'method': 'GET'
        });

        const queries = await response.text();

        if (!queries) {
            throw new Error("No queries found at the specified location");
        }

        return queries;
    }

    /**
     *
     * @param queryOne
     * @param queryTwo
     */
    async validateQueryContainment(queryOne: string, queryTwo: string): Promise<boolean> {
        // Completeness Check for query containment
        queryOne = this.removeAggregationFunctions(queryOne);
        queryTwo = this.removeAggregationFunctions(queryTwo);
        const isComplete = await this.containmentChecker.checkContainment(queryOne, queryTwo);
        // Soundness Check for query containment
        const isSound = await this.containmentChecker.checkContainment(queryTwo, queryOne);

        if (isComplete && isSound) {
            console.log(`Query "${queryOne}" is contained in "${queryTwo}" and vice versa.`);
            return true;
        }
        else if (isComplete) {
            console.log(`There is a completeness relationship between "${queryOne}" and "${queryTwo}"`);
            return false;
        }
        else if (isSound) {
            console.log(`There is a soundness relationship between "${queryOne}" and "${queryTwo}"`);
            return false;
        }
        else {
            console.log(`Query "${queryOne}" is not contained in "${queryTwo}" and vice versa.`);
            return true;
        }
    }


    /**
     *
     * @param data
     */
    async extractQueriesWithTopics(data: QueryMap): Promise<ExtractedQuery[]> {
        const extractedQueries: ExtractedQuery[] = [];
        console.log(`Extracting queries with topics from data:`, data);


        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const entry = data[key];
                if (entry.rspql_query && entry.r2s_topic) {
                    console.log(`Extracting query: ${entry.rspql_query} with topic: ${entry.r2s_topic}`);

                    extractedQueries.push({
                        rspql_query: entry.rspql_query,
                        r2s_topic: entry.r2s_topic
                    });
                }
            }
        }

        return extractedQueries;
    }


    /**
     *
     * @param extractedQueries
     */
    async findContainedQueries(extractedQueries: ExtractedQuery[]): Promise<string[]> {
        const containedQueries: string[] = [];
        for (const extractedQuery of extractedQueries) {
            this.query = this.removeAggregationFunctions(this.query);
            extractedQuery.rspql_query = this.removeAggregationFunctions(extractedQuery.rspql_query);
            const queryY = generateQuery(['y', 'x', 'z']);
            const queryZ = generateQuery(['z', 'y', 'x']);
            const isContainedX = await this.containmentChecker.checkContainment(this.query, extractedQuery.rspql_query);

            /**
             * Note: Normally, the order of the UNIONs should not matter.
             * However, there is a current bug in the containment checker that causes it to only consider
             * the first query in the UNION. The bug is in the underlying SPeCS Containment Solver,
             * which the RSPQL Containment Checker builds on.
             *
             * This is a workaround to check the containment for the other two queries in the UNION.
             * Remove this workaround when the bug is fixed in the SPeCS Containment Solver.
             *
             * Read more about the bug here:
             * https://kushbisen.top/assets/Working-Notes/Working-Note-001.
             */

            const isContainedY = await this.containmentChecker.checkContainment(queryY, extractedQuery.rspql_query);
            const isContainedZ = await this.containmentChecker.checkContainment(queryZ, extractedQuery.rspql_query);
            const isContained = isContainedX || isContainedY || isContainedZ;
            if (isContained) {
                console.log(`Query "${extractedQuery.rspql_query}" is contained in the main query.`);
                containedQueries.push(extractedQuery.rspql_query);
            }
            else {
                console.log(`Query "${extractedQuery.rspql_query}" is not contained in the main query.`);
            }
        }
        return containedQueries;
    }

    /**
     *
     * @param query
     */
    removeAggregationFunctions(query: string): string {
        // This regex will match any aggregation function like AVG(?x) AS ?alias
        // Replace any function like AVG(?x) AS ?alias with just ?x
        return query.replace(/\(\s*\w+\s*\(\s*\?(\w+)\s*\)\s+AS\s+\?\w+\s*\)/g, '?$1');
    }


}

/**
 * Merges two window results with overlap subtraction for sliding windows.
 * @param win1 - First window result {start, end, value}.
 * @param win2 - Second window result {start, end, value}.
 * @param overlap - Overlap window result {start, end, value}.
 * @param target - Target window {start, end}.
 * @param win1.start
 * @param win1.end
 * @param win1.value
 * @param agg - Aggregation function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'.
 * @param win2.start
 * @param win2.end
 * @param win2.value
 * @param overlap.start
 * @param overlap.end
 * @param overlap.value
 * @param target.start
 * @param target.end
 * @returns The approximate aggregation for the target window.
 */
export function mergeSlidingWindowResults(
    win1: { start: number, end: number, value: number },
    win2: { start: number, end: number, value: number },
    overlap: { start: number, end: number, value: number },
    target: { start: number, end: number },
    agg: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'
): number | string {
    const dur1 = win1.end - win1.start;
    const dur2 = win2.end - win2.start;
    const dur3 = target.end - target.start;
    const overlap_dur = Math.max(0, Math.min(win1.end, win2.end) - Math.max(win1.start, win2.start));

    if (agg === 'SUM' || agg === 'AVG') {
        const combined_sum = win1.value * dur1 + win2.value * dur2 - overlap.value * overlap_dur;
        return agg === 'AVG' ? combined_sum / dur3 : combined_sum;
    } else if (agg === 'COUNT') {
        const combined = win1.value + win2.value - overlap.value;
        return combined;
    } else if (agg === 'MIN') {
        return Math.min(win1.value, win2.value, overlap.value);
    } else if (agg === 'MAX') {
        return Math.max(win1.value, win2.value, overlap.value);
    } else {
        return 'Not Supported';
    }
}

/**
 * Merges N window results with overlap-aware logic for sliding windows.
 * @param windows - Array of window objects {start, end, value, agg}.
 * @param target - Target window {start, end}.
 * @param target.start
 * @param agg - Aggregation function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'.
 * @param target.end
 * @returns The approximate aggregation for the target window.
 */
export function mergeMultipleSlidingWindowResults(
    windows: Array<{ start: number, end: number, value: number }>,
    target: { start: number, end: number },
    agg: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'
): number | string {
    // Only consider windows that overlap with the target window
    const overlapping = windows.filter(w => w.end > target.start && w.start < target.end);
    if (overlapping.length === 0) return 0;

    if (agg === 'MIN') {
        return Math.min(...overlapping.map(w => w.value));
    } else if (agg === 'MAX') {
        return Math.max(...overlapping.map(w => w.value));
    } else if (agg === 'COUNT') {
        // For count, sum the values (assuming each window's value is a count for its interval)
        // If windows overlap, this will overcount; for exact, need to subtract overlaps
        // Here, we just sum for simplicity
        return overlapping.reduce((acc, w) => acc + w.value, 0);
    } else if (agg === 'SUM' || agg === 'AVG') {
        // For SUM/AVG, compute the weighted sum over the overlap with the target window
        let totalSum = 0;
        let totalDuration = 0;
        for (const w of overlapping) {
            const overlapStart = Math.max(w.start, target.start);
            const overlapEnd = Math.min(w.end, target.end);
            const overlapDur = Math.max(0, overlapEnd - overlapStart);
            totalSum += w.value * overlapDur;
            totalDuration += overlapDur;
        }
        if (agg === 'AVG') {
            return totalDuration > 0 ? totalSum / totalDuration : 0;
        } else {
            return totalSum;
        }
    } else {
        return 'Not Supported';
    }
}

/**
 * Sets up approximate sliding window merging for MQTT messages.
 * @param rsp_client - The MQTT client.
 * @param outputWindowWidth - The width of the output window in milliseconds.
 * @param outputWindowSlide - The slide of the output window in milliseconds.
 */
export function setupApproximateSlidingWindowMerging(rsp_client: any, outputWindowWidth: number, outputWindowSlide: number) {
    const windowBuffer: Array<{ start: number, end: number, value: number, queryId: string, agg: string }> = [];
    let lastTriggerTime = Date.now();

    rsp_client.on("message", (topic: string, message: any) => {
        const result = JSON.parse(message.toString());
        windowBuffer.push(result);

        // Remove old windows outside the output window width
        const now = Date.now();
        const windowStart = now - outputWindowWidth;
        while (windowBuffer.length && windowBuffer[0].end < windowStart) {
            windowBuffer.shift();
        }

        // Trigger every output window slide
        if (now - lastTriggerTime >= outputWindowSlide) {
            lastTriggerTime = now;

            // Find the two most recent windows and their overlap
            if (windowBuffer.length >= 2) {
                const win1 = windowBuffer[windowBuffer.length - 2];
                const win2 = windowBuffer[windowBuffer.length - 1];

                // Calculate overlap window
                const overlapStart = Math.max(win1.start, win2.start);
                const overlapEnd = Math.min(win1.end, win2.end);
                const overlapDur = Math.max(0, overlapEnd - overlapStart);

                // Estimate overlap value (simple average, or use actual if available)
                const overlapValue = (win1.value + win2.value) / 2; // Replace with actual if you have it

                const overlap = { start: overlapStart, end: overlapEnd, value: overlapValue };
                const target = { start: windowStart, end: now };

                // const agg = win2.agg as 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
                const agg = 'AVG'; // Replace with actual aggregation function if available

                const merged = mergeSlidingWindowResults(win1, win2, overlap, target, agg);

                console.log(`Merged result for output window [${target.start}, ${target.end}]:`, merged);
                // You can now publish or use this merged result as needed
            }
        }
    });
}

/**
 * Starts a sliding window approximation merge loop that triggers every outputWindowSlide ms,
 * using all window results from the last outputWindowWidth ms.
 * @param getAllChunks - Function that returns all chunks as { data: string, timestamp: number }.
 * @param outputWindowWidth - Window width in ms.
 * @param outputWindowSlide - Slide in ms.
 */
export function startApproximationSlidingWindowLoop(
    getAllChunks: () => Array<{ data: string, timestamp: number }>,
    outputWindowWidth: number,
    outputWindowSlide: number
) {
    setInterval(() => {
        const now = Date.now();
        const windowStart = now - outputWindowWidth;
        // Get all window results within the current output window
        const parsedChunks = getAllChunks()
            .filter(chunk => chunk.timestamp >= windowStart)
            .map(chunk => {
                try {
                    return JSON.parse(chunk.data);
                } catch (e) {
                    console.error("Failed to parse chunk data as JSON:", chunk.data);
                    return null;
                }
            })
            .filter(Boolean);
        if (parsedChunks.length > 1) {
            const win1 = parsedChunks[parsedChunks.length - 2];
            const win2 = parsedChunks[parsedChunks.length - 1];
            const overlapStart = Math.max(win1.start, win2.start);
            const overlapEnd = Math.min(win1.end, win2.end);
            const overlapDur = Math.max(0, overlapEnd - overlapStart);
            const overlapValue = (win1.value + win2.value) / 2; // Replace with actual if available
            const overlap = { start: overlapStart, end: overlapEnd, value: overlapValue };
            const target = { start: windowStart, end: now };
            const agg = win2.agg as 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
            const merged = mergeSlidingWindowResults(win1, win2, overlap, target, agg);
            console.log(`Merged result for output window [${target.start}, ${target.end}]:`, merged);
            // You can now publish or use this merged result as needed
        } else if (parsedChunks.length > 0) {
            console.log("Sliding window evaluation (single chunk):", parsedChunks[0].value);
        } else {
            console.log("Sliding window: no chunks to aggregate.");
        }
    }, outputWindowSlide);
}

/**
 * Handles incoming window result messages and performs approximation merging on each new message.
 * Call this function in your rsp_client.on('message') handler.
 * @param windowBuffer - Array to store window results.
 * @param outputWindowWidth - Output window width in ms.
 * @param outputWindowSlide - Output window slide in ms.
 * @param chunk - the new chunk/message received (should be { data: string, timestamp: number }).
 * @param chunk.data
 * @param chunk.timestamp
 */
export function handleApproximationChunk(
    windowBuffer: Array<{ data: string, timestamp: number }>,
    outputWindowWidth: number,
    outputWindowSlide: number,
    chunk: { data: string, timestamp: number }
) {
    windowBuffer.push(chunk);
    const now = Date.now();
    const windowStart = now - outputWindowWidth;
    // Remove old windows outside the output window width
    while (windowBuffer.length && windowBuffer[0].timestamp < windowStart) {
        windowBuffer.shift();
    }
    // Get all window results within the current output window
    const parsedChunks = windowBuffer
        .filter(c => c.timestamp >= windowStart)
        .map(c => {
            try {
                return JSON.parse(c.data);
            } catch (e) {
                console.error("Failed to parse chunk data as JSON:", c.data);
                return null;
            }
        })
        .filter(Boolean);
    if (parsedChunks.length > 1) {
        const win1 = parsedChunks[parsedChunks.length - 2];
        const win2 = parsedChunks[parsedChunks.length - 1];
        const overlapStart = Math.max(win1.start, win2.start);
        const overlapEnd = Math.min(win1.end, win2.end);
        const overlapDur = Math.max(0, overlapEnd - overlapStart);
        const overlapValue = (win1.value + win2.value) / 2; // Replace with actual if available
        const overlap = { start: overlapStart, end: overlapEnd, value: overlapValue };
        const target = { start: windowStart, end: now };
        const agg = win2.agg as 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
        const merged = mergeSlidingWindowResults(win1, win2, overlap, target, agg);
        console.log(`Merged result for output window [${target.start}, ${target.end}]:`, merged);
        // You can now publish or use this merged result as needed
    } else if (parsedChunks.length > 0) {
        console.log("Sliding window evaluation (single chunk):", parsedChunks[0].value);
    } else {
        console.log("Sliding window: no chunks to aggregate.");
    }
}

/**
 * Build a topic-to-window-params mapping from an array of topic/query objects.
 * @param topics - Array of { r2s_topic, rspql_query }.
 * @returns Record mapping r2s_topic to { width, agg }.
 */
export function buildTopicWindowParams(topics: Array<{ r2s_topic: string, rspql_query: string }>) {
    const parser = new RSPQLParser();
    const topicWindowParams: Record<string, { width: number, agg: string }> = {};

    for (const t of topics) {
        try {
            const parsed = parser.parse(t.rspql_query);
            // Assume first s2r entry is the window
            const width = parsed.s2r[0]?.width;
            // Find the aggregation function in the SELECT clause
            const aggMatch = t.rspql_query.match(/SELECT\s*\((\w+)\(/i);
            const agg = aggMatch ? aggMatch[1].toUpperCase() : "AVG";
            if (t.r2s_topic && width) {
                topicWindowParams[t.r2s_topic] = { width, agg };
            }
        } catch (e) {
            console.warn("Failed to parse query for topic", t.r2s_topic, e);
        }
    }
    return topicWindowParams;
}

const topicWindowParams: Record<string, { width: number, agg: string }> = {
};


// Buffer to store window results
const windowBuffer: Array<{ start: number, end: number, value: number, agg: string }> = [];

/**
 *
 * @param topic
 * @param message
 */
export function handleApproximationMessage(topic: string, message: any) {
    const value = parseFloat(message.toString());
    const now = Date.now();
    const params = topicWindowParams[topic];
    if (!params) {
        console.warn(`No window parameters found for topic ${topic}`);
        return;
    }
    const windowEnd = now;
    const windowStart = windowEnd - params.width;
    const result = {
        start: windowStart,
        end: windowEnd,
        value,
        agg: params.agg
    };
    windowBuffer.push(result);
}

