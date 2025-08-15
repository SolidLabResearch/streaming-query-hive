import { IStreamQueryOperator } from "../../util/Interfaces";
import CONFIG from "../../config/httpServerConfig.json"
import { RSPQLParser } from "rsp-js";
import { ExtractedQuery, QueryMap } from "../../util/Types";
import { CSVLogger } from "../../util/logger/CSVLogger";
import mqtt from "mqtt";
/**
 *
 */
export class ApproximationApproachOperator implements IStreamQueryOperator {
    private logger: CSVLogger = new CSVLogger('approximation_approach_log.csv');
    private subQueries: string[] = [];
    private outputQuery: string = "";
    private queryMQTTTopicMap: Map<string, string> = new Map<string, string>();
    private queryFetchLocation: string = CONFIG.queryFetchLocation;
    private extractedQueries: ExtractedQuery[] = [];
    private parser: RSPQLParser = new RSPQLParser();

    /**
     *
     */
    constructor() {
        // Remove automatic init() call - let BeeWorker control the initialization timing
    }

    addSubQuery(query: string): void {
        this.subQueries.push(query);
        console.log(`Sub-query added: ${query}`);
    }

    getSubQueries(): string[] {
        return this.subQueries;
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
    async init(): Promise<void> {
        this.queryMQTTTopicMap = new Map<string, string>();
        // Don't clear subQueries here - they should be preserved from addSubQuery() calls
        // this.subQueries = [];
        this.extractedQueries = [];
        await this.setMQTTTopicMap();
        console.log(`Init completed. Current subqueries count: ${this.subQueries.length}`);
    }

    /**
     *
     * @param topics
     */
    async createTopicWindowParameters(topics: Array<{ r2s_topic: string, rspql_query: string }>) {
        const topicWindowParameters: Record<string, { width: number, aggregation: string }> = {};

        for (const topic of topics) {
            try {
                const parsed = this.parser.parse(topic.rspql_query);

                const width = parsed.s2r[0]?.width;
                const aggregationMatch = topic.rspql_query.match(/SELECT\s*\((\w+)\(/i);
                const aggregation = aggregationMatch ? aggregationMatch[1].toUpperCase() : "AVG";
                if (topic.r2s_topic && width) {
                    topicWindowParameters[topic.r2s_topic] = {
                        width: width,
                        aggregation: aggregation
                    };
                }
            } catch (error) {
                console.log('Failed to parse query:', topic.rspql_query, error);
            }
        }

        return topicWindowParameters;
    }

    /**
     *
     */
    async setMQTTTopicMap(): Promise<void> {
        const response = await fetch(this.queryFetchLocation);
        if (!response.ok) {
            throw new Error("Failed to fetch subqueries");
        }

        const data = await response.json();

        for (const [queryHash, mqttTopic] of Object.entries(data)) {
            this.queryMQTTTopicMap.set(queryHash, mqttTopic as string);
        }

        this.extractedQueries = await this.extractQueriesWithTopics(data as QueryMap);
        console.log(`Extracted ${this.extractedQueries.length} queries with topics.`);
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
     */
    async handleAggregation(): Promise<void> {
        console.log(`handleAggregation called. Subqueries count: ${this.subQueries.length}`);
        console.log(`Subqueries:`, this.subQueries);

        if (this.subQueries.length === 0) {
            throw new Error("No subqueries to aggregate.");
        }
        console.log("Aggregating subqueries:", this.subQueries);
        const window_parameters = await this.createTopicWindowParameters(this.extractedQueries);

        if (this.queryMQTTTopicMap.size === 0) {
            console.log("No MQTT topics found for the subqueries.");
            return;
        }

        const outputQueryParsed = this.parser.parse(this.outputQuery);
        const outputQueryWidth = outputQueryParsed.s2r[0].width;
        const outputQuerySlide = outputQueryParsed.s2r[0].slide;

        if (!this.extractedQueries) {
            throw new Error("No extracted queries found for aggregation.");
        }

        const s2rQueries = this.extractedQueries.map(query => this.parser.parse(query.rspql_query).s2r[0]);
        if (s2rQueries.length === 0) {
            throw new Error("No valid s2r queries found for aggregation.");
        }

        if (outputQuerySlide <= 0 || outputQueryWidth <= 0) {
            throw new Error("Invalid output query parameters: slide and width must be greater than zero. Cannot proceed with approximation approach.");
        }

        const rsp_client = mqtt.connect(CONFIG.mqttBroker, {
            clientId: 'approximation-operator-' + Math.random().toString(16).substr(2, 8),
            clean: true,
            keepalive: 60,
            reconnectPeriod: 1000
        });

        rsp_client.on('error', (error: any) => {
            console.error("MQTT Client Error:", error);
            this.logger.log(`MQTT Client Error: ${error}`);
        });

        rsp_client.on("offline", () => {
            console.log("MQTT Client Offline. Please check the connection of the broker.");
            this.logger.log("MQTT Client Offline. Please check the connection of the broker.");
        });

        rsp_client.on("reconnect", () => {
            console.log("Reconnecting to MQTT broker");
            this.logger.log("Reconnecting to MQTT broker");
        });

        const that = this;

        rsp_client.on('connect', () => {
            console.log("MQTT Client Connected for Approximation Operator");
            this.logger.log("MQTT Client Connected for Approximation Operator");

            const topics = Array.from(this.queryMQTTTopicMap.values());
            if (topics.length === 0) {
                console.log("No topics to subscribe to for the values.");
                return;
            }

            const r2sTopics = topics.map((item: any) => typeof item === 'object' && item !== null ? item.r2s_topic : item);
            if (r2sTopics.length === 0) {
                console.log("No valid r2s topics found for the values.");
                return;
            }
            
            console.log(`About to subscribe to ${r2sTopics.length} topics:`, r2sTopics);
            this.logger.log(`About to subscribe to ${r2sTopics.length} topics: ${JSON.stringify(r2sTopics)}`);

            for (const mqttTopic of r2sTopics) {
                rsp_client.subscribe(mqttTopic, (err: any) => {
                    if (err) {
                        console.error(`Failed to subscribe to topic ${mqttTopic}:`, err);
                    } else {
                        console.log(`Successfully subscribed to topic ${mqttTopic}`);
                    }
                });
            }

            // Use separate buffers for each topic/variable
            const windowBuffers: Map<string, Array<{ start: number, end: number, value: number, agg: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' }>> = new Map();

            // Global tracking of latest values from all topics - this persists across windows
            const globalLatestValues: Map<string, { value: number, timestamp: number }> = new Map();

            let lastTriggerTime = Date.now();

            rsp_client.on("message", (topic: string, message: any) => {
                console.log(`[DEBUG] Received message on topic ${topic}: ${message.toString().substring(0, 100)}...`);
                this.logger.log(`Received message on topic ${topic}: ${message.toString()}`);

                try {
                    const data = message.toString();
                    this.logger.log(`Raw message data: ${data}`);
                    
                    // Parse the RDF triple to extract the numeric value
                    // Look for patterns like: hasValue> "number"^^<type>
                    const valueMatch = data.match(/saref:hasValue>\s*"([^"]*)"(?:\^\^<[^>]*>)?/);
                    let value: number;
                    
                    if (valueMatch && valueMatch[1]) {
                        value = parseFloat(valueMatch[1]);
                        this.logger.log(`Extracted value from RDF: ${valueMatch[1]} -> ${value}`);
                    } else {
                        // Fallback: try to parse as direct number
                        value = parseFloat(data);
                        this.logger.log(`Fallback parse as float: ${data} -> ${value}`);
                    }
                    
                    if (isNaN(value)) {
                        this.logger.log(`Failed to parse numeric value from: ${data}`);
                        return;
                    }

                    const now = Date.now();

                    const params = window_parameters[topic];

                    if (!params) {
                        console.log(`[DEBUG] No window parameters found for topic ${topic}. Available topics in window_parameters:`, Object.keys(window_parameters));
                        this.logger.log(`No window parameters found for topic ${topic}. Available topics: ${JSON.stringify(Object.keys(window_parameters))}`);
                        console.error(`No window parameters found for topic ${topic}`);
                        return;
                    }

                    const windowEnd = now;
                    const windowStart = windowEnd - params.width;

                    const result = {
                        start: windowStart,
                        end: windowEnd,
                        value: value,
                        agg: params.aggregation as 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'
                    };

                    this.logger.log(`Pushed window result to buffer: ${JSON.stringify(result)}`);
                    if (!result.value && result.value !== 0) {
                        this.logger.log(`Received null or undefined value for topic ${topic}. Skipping.`);
                        // Still add to buffer for this topic
                        if (!windowBuffers.has(topic)) {
                            windowBuffers.set(topic, []);
                        }
                        windowBuffers.get(topic)!.push(result);
                        return;
                    }

                    // Get or create buffer for this specific topic
                    if (!windowBuffers.has(topic)) {
                        windowBuffers.set(topic, []);
                    }
                    windowBuffers.get(topic)!.push(result);

                    // ALWAYS update global latest values for ALL topics receiving data
                    globalLatestValues.set(topic, { value: value, timestamp: now });
                    this.logger.log(`Updated global latest value for topic ${topic}: ${value} at ${now}`);

                    // Log current buffer state for all topics
                    this.logger.log(`After adding result - Topic ${topic} buffer size: ${windowBuffers.get(topic)!.length}`);
                    const allTopicBufferSizes: Record<string, number> = {};
                    windowBuffers.forEach((buffer, topicKey) => {
                        allTopicBufferSizes[topicKey] = buffer.length;
                    });
                    this.logger.log(`All topic buffer sizes after message: ${JSON.stringify(allTopicBufferSizes)}`);
                    
                    // Log all global latest values
                    const globalLatestValuesObj: Record<string, any> = {};
                    globalLatestValues.forEach((valData, topicKey) => {
                        globalLatestValuesObj[topicKey] = { value: valData.value, timestamp: valData.timestamp };
                    });
                    this.logger.log(`Global latest values: ${JSON.stringify(globalLatestValuesObj)}`);

                    if (Date.now() - lastTriggerTime >= outputQuerySlide) {
                        const windowStartGlobal = now - outputQueryWidth;
                        
                        // Check how many topics have valid data in the current window BEFORE cleanup
                        let topicsWithValidData = 0;
                        windowBuffers.forEach((buffer, topicKey) => {
                            const validWindowData = buffer.filter(w => w.end >= windowStartGlobal);
                            if (validWindowData.length > 0) {
                                topicsWithValidData++;
                            }
                        });
                        
                        // More flexible waiting strategy - wait a bit longer for all topics
                        const bufferTimeMs = 3000; // 3 second buffer to allow for timing differences
                        const shouldWaitForMoreTopics = (topicsWithValidData < r2sTopics.length) && 
                                                       (Date.now() - lastTriggerTime < outputQuerySlide + bufferTimeMs);
                        
                        if (shouldWaitForMoreTopics) {
                            this.logger.log(`Waiting for more topics. Topics with valid data: ${topicsWithValidData}, Expected: ${r2sTopics.length}, Time since trigger: ${Date.now() - lastTriggerTime}ms`);
                            return; // Wait a bit more for other topics
                        }
                        
                        this.logger.log(`Triggering aggregation for window [${windowStartGlobal}, ${now}]`);
                        
                        // Log buffer sizes before cleanup for each topic
                        const topicBufferSizes: Record<string, number> = {};
                        windowBuffers.forEach((buffer, topicKey) => {
                            topicBufferSizes[topicKey] = buffer.length;
                        });
                        this.logger.log(`Current window buffer sizes before cleanup: ${JSON.stringify(topicBufferSizes)}`);
                        
                        // Clean up old windows for each topic buffer and collect latest values
                        const aggregationResults: Record<string, number | string> = {};
                        const latestValues: Record<string, number> = {}; // Keep track of latest values from each topic
                        let totalValidBuffers = 0;
                        
                        windowBuffers.forEach((buffer, topicKey) => {
                            // Clean up old entries for this topic
                            while (buffer.length && buffer[0].end < windowStartGlobal) {
                                buffer.shift();
                            }
                            
                            this.logger.log(`Topic ${topicKey} buffer size after cleanup: ${buffer.length}`);
                            this.logger.log(`Topic ${topicKey} buffer contents after cleanup: ${JSON.stringify(buffer)}`);
                            
                            if (buffer.length > 0) {
                                totalValidBuffers++;
                                // Calculate aggregation for this specific topic
                                const target = { start: windowStartGlobal, end: now };
                                const aggregation = buffer[buffer.length - 1].agg;
                                
                                this.logger.log(`DEBUG: About to call mergeMultipleSlidingWindowResults for topic ${topicKey}`);
                                this.logger.log(`DEBUG: Buffer for ${topicKey}: ${JSON.stringify(buffer)}`);
                                this.logger.log(`DEBUG: Target window: ${JSON.stringify(target)}`);
                                this.logger.log(`DEBUG: Aggregation type: ${aggregation}`);
                                
                                const topicResult = mergeMultipleSlidingWindowResults(buffer, target, aggregation);
                                aggregationResults[topicKey] = topicResult;
                                
                                // Store the latest value for cross-sensor averaging
                                if (typeof topicResult === 'number') {
                                    latestValues[topicKey] = topicResult;
                                }
                                
                                this.logger.log(`Aggregation result for topic ${topicKey}: ${topicResult}`);
                            } else {
                                // If no current window data, try to use the most recent value from this topic
                                // Look through all buffered data for this topic to find the most recent value
                                const allTopicData = windowBuffers.get(topicKey);
                                if (allTopicData && allTopicData.length > 0) {
                                    // Get the most recent value regardless of window
                                    const mostRecentValue = allTopicData[allTopicData.length - 1].value;
                                    latestValues[topicKey] = mostRecentValue;
                                    this.logger.log(`Using most recent value for topic ${topicKey}: ${mostRecentValue} (outside current window)`);
                                }
                            }
                        });
                        
                        // Also check if we have any recent data for expected topics that might not be in windowBuffers yet
                        r2sTopics.forEach(expectedTopic => {
                            if (!latestValues[expectedTopic] && windowBuffers.has(expectedTopic)) {
                                const buffer = windowBuffers.get(expectedTopic)!;
                                if (buffer.length > 0) {
                                    const mostRecentValue = buffer[buffer.length - 1].value;
                                    latestValues[expectedTopic] = mostRecentValue;
                                    this.logger.log(`Added latest value for expected topic ${expectedTopic}: ${mostRecentValue}`);
                                }
                            }
                        });
                        
                        lastTriggerTime = Date.now();
                        
                        // Log detailed information about the aggregation decision
                        this.logger.log(`Aggregation decision: totalValidBuffers=${totalValidBuffers}, r2sTopics.length=${r2sTopics.length}, r2sTopics=${JSON.stringify(r2sTopics)}`);
                        this.logger.log(`Current aggregation results: ${JSON.stringify(aggregationResults)}`);
                        this.logger.log(`Latest values from all topics: ${JSON.stringify(latestValues)}`);
                        
                        // Publish results if we have at least one valid buffer or latest values from multiple topics
                        const hasMultipleTopicData = Object.keys(latestValues).length >= 2;
                        const hasAnyValidData = totalValidBuffers > 0 || Object.keys(latestValues).length > 0;
                        
                        if (hasAnyValidData) {
                        // Calculate unified cross-sensor average using latest values from all available topics
                        // First priority: use the latest global values from all topics that have ever sent data
                        const allAvailableValuesFromGlobal: number[] = [];
                        const allTopicsWithData: string[] = [];
                        
                        globalLatestValues.forEach((valData, topicKey) => {
                            allAvailableValuesFromGlobal.push(valData.value);
                            allTopicsWithData.push(topicKey);
                        });
                        
                        // If we don't have global data, fallback to latestValues from windowing
                        const allAvailableValues = allAvailableValuesFromGlobal.length >= 2 ? 
                            allAvailableValuesFromGlobal : Object.values(latestValues);
                            
                        const topicsUsedForAverage = allAvailableValuesFromGlobal.length >= 2 ?
                            allTopicsWithData : Object.keys(latestValues);
                        
                        const unifiedAverage = allAvailableValues.length > 0 ? 
                            allAvailableValues.reduce((sum, val) => sum + val, 0) / allAvailableValues.length : 0;
                        
                        this.logger.log(`Computing unified cross-sensor average using ${allAvailableValuesFromGlobal.length >= 2 ? 'global' : 'windowed'} values: ${JSON.stringify(allAvailableValues)} from topics: ${JSON.stringify(topicsUsedForAverage)} -> ${unifiedAverage}`);                            // Prepare individual topics results - prefer aggregation results, fallback to latest values, then global values
                            const individualTopicsResults: Record<string, number | string> = { ...aggregationResults };
                            Object.keys(latestValues).forEach(topic => {
                                if (!individualTopicsResults[topic]) {
                                    individualTopicsResults[topic] = latestValues[topic];
                                }
                            });
                            
                            // Also add global values if they're not already included
                            globalLatestValues.forEach((valData, topic) => {
                                if (!individualTopicsResults[topic]) {
                                    individualTopicsResults[topic] = valData.value;
                                }
                            });
                            
                            // Publish unified result similar to other approaches
                            const finalResult = {
                                timestamp: now,
                                window: { start: windowStartGlobal, end: now },
                                unifiedAverage: unifiedAverage,
                                individualTopics: individualTopicsResults,
                                metadata: {
                                    validBuffers: totalValidBuffers,
                                    expectedTopics: r2sTopics.length,
                                    availableTopics: Object.keys(individualTopicsResults),
                                    topicCount: allAvailableValues.length,
                                    hasMultipleTopics: allAvailableValues.length >= 2,
                                    latestValuesUsed: topicsUsedForAverage,
                                    globalValuesAvailable: globalLatestValues.size,
                                    usingGlobalValues: allAvailableValuesFromGlobal.length >= 2
                                }
                            };

                            this.logger.log(`Final aggregation results: ${JSON.stringify(finalResult)}`);

                            // Check if client is connected before publishing
                            if (rsp_client.connected) {
                                // Publish with QoS 1 and error handling

                                rsp_client.publish('approximation/output', JSON.stringify(finalResult), { qos: 1 }, (error) => {
                                    if (error) {
                                        console.error('Failed to publish aggregated results:', error);
                                        this.logger.log(`Failed to publish aggregated results: ${error}`);
                                    } else {
                                        console.log(`Successfully published unified cross-sensor average: ${unifiedAverage} (from ${allAvailableValues.length} topics)`);
                                        this.logger.log(`Successfully published unified cross-sensor average: ${unifiedAverage} (from ${allAvailableValues.length} topics)`);
                                    }
                                });
                            } else {
                                console.warn('MQTT client not connected, cannot publish results');
                                this.logger.log('MQTT client not connected, cannot publish results');
                            }
                        } else {
                            this.logger.log(`No valid data available for publishing. ValidBuffers: ${totalValidBuffers}, LatestValues: ${Object.keys(latestValues).length}`);
                        }
                    }
                } catch (error) {
                    this.logger.log(`Error processing message from topic ${topic}: ${error}`);
                }
            })
        });
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



export function mergeMultipleSlidingWindowResults(
    windows: Array<{ start: number; end: number; value: number }>,
    target: { start: number; end: number },
    agg: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'
): number | string {
    console.log(`DEBUG: mergeMultipleSlidingWindowResults called with:`);
    console.log(`  - windows:`, JSON.stringify(windows));
    console.log(`  - target:`, JSON.stringify(target));
    console.log(`  - aggregation:`, agg);

    // Filter windows that overlap target
    const overlapping = windows.filter(w => w.end > target.start && w.start < target.end);
    console.log(`DEBUG: Found ${overlapping.length} overlapping windows:`, JSON.stringify(overlapping));
    
    if (overlapping.length === 0) return 0;

    // MIN/MAX aggregation - straightforward from overlapping window values
    if (agg === 'MIN') {
        const result = Math.min(...overlapping.map(w => w.value));
        console.log(`DEBUG: MIN result:`, result);
        return result;
    }
    if (agg === 'MAX') {
        const result = Math.max(...overlapping.map(w => w.value));
        console.log(`DEBUG: MAX result:`, result);
        return result;
    }

    // For AVG: Calculate weighted average based on overlap duration with target window
    if (agg === 'AVG') {
        let weightedSum = 0;
        let totalWeight = 0;

        console.log(`DEBUG: Calculating weighted average:`);
        overlapping.forEach((w, idx) => {
            // Calculate overlap duration between window and target
            const overlapStart = Math.max(w.start, target.start);
            const overlapEnd = Math.min(w.end, target.end);
            const overlapDuration = overlapEnd - overlapStart;
            
            console.log(`DEBUG: Window ${idx}: value=${w.value}, overlapDuration=${overlapDuration}`);
            
            if (overlapDuration > 0) {
                // For averages, weight by overlap duration
                const contribution = w.value * overlapDuration;
                weightedSum += contribution;
                totalWeight += overlapDuration;
                console.log(`DEBUG: Added contribution=${contribution}, totalWeight=${totalWeight}, weightedSum=${weightedSum}`);
            }
        });

        const result = totalWeight > 0 ? weightedSum / totalWeight : 0;
        console.log(`DEBUG: Final AVG calculation: weightedSum=${weightedSum} / totalWeight=${totalWeight} = ${result}`);
        return result;
    }

    // For SUM and COUNT: partition target window by all unique boundaries from overlapping windows
    const boundaries = new Set<number>();
    boundaries.add(target.start);
    boundaries.add(target.end);
    overlapping.forEach(w => {
        if (w.start > target.start && w.start < target.end) boundaries.add(w.start);
        if (w.end > target.start && w.end < target.end) boundaries.add(w.end);
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

    let totalSum = 0;

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
        const subStart = sortedBoundaries[i];
        const subEnd = sortedBoundaries[i + 1];
        const subDuration = subEnd - subStart;
        if (subDuration <= 0) continue;

        // Identify windows covering this subinterval
        const coveringWindows = overlapping.filter(w => w.start <= subStart && w.end >= subEnd);
        if (coveringWindows.length === 0) continue;

        if (agg === 'SUM') {
            // For SUM: treat values as rates and integrate over time
            const subValueRateSum = coveringWindows.reduce((acc, w) => {
                const windowDuration = w.end - w.start;
                if (windowDuration <= 0) return acc;
                const rate = w.value / windowDuration;
                return acc + rate;
            }, 0);
            totalSum += subValueRateSum * subDuration;
        } else if (agg === 'COUNT') {
            // For COUNT: sum the values directly
            const subValueSum = coveringWindows.reduce((acc, w) => acc + w.value, 0);
            totalSum += subValueSum;
        }
    }

    return totalSum;
}
