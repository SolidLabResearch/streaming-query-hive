import { IQueryOperator } from "../../util/Interfaces";
import CONFIG from "../../config/httpServerConfig.json"
import { RSPQLParser } from "rsp-js";
import { ExtractedQuery, QueryMap } from "../../util/Types";
import mqtt from "mqtt";
/**
 *
 */
export class ApproximationApproachOperator implements IQueryOperator {
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
        this.init();
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
    addOutputQuery(query: string): void {
        this.outputQuery = query;
    }



    /**
     *
     */
    async init(): Promise<void> {
        this.queryMQTTTopicMap = new Map<string, string>();
        this.subQueries = [];
        this.extractedQueries = [];
        await this.setMQTTTopicMap();

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

        const rsp_client = mqtt.connect(CONFIG.mqttBroker);

        rsp_client.on('error', (error: any) => {
            console.error("MQTT Client Error:", error);
        });

        rsp_client.on("offline", () => {
            console.log("MQTT Client Offline. Please check the connection of the broker.");
        });

        rsp_client.on("reconnect", () => {
            console.log("Reconnecting to MQTT broker");
        });

        const that = this;

        rsp_client.on('connect', () => {
            console.log("MQTT Client Connected");

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

            for (const mqttTopic of r2sTopics) {
                rsp_client.subscribe(mqttTopic, (err: any) => {
                    if (err) {
                        console.error(`Failed to subscribe to topic ${mqttTopic}:`, err);
                    } else {
                        console.log(`Successfully subscribed to topic ${mqttTopic}`);
                    }
                });
            }

            const windowBuffer: Array<{ start: number, end: number, value: number, agg: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' }> = [];

            let lastTriggerTime = Date.now();

            rsp_client.on("message", (topic: string, message: any) => {
                console.log(`Received message on topic ${topic}:`, message.toString());

                try {
                    const data = message.toString();
                    const value = parseFloat(data);
                    const now = Date.now();

                    const params = window_parameters[topic];

                    if (!params) {
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
                    windowBuffer.push(result);

                    const windowStartGlobal = now - outputQueryWidth;
                    while (windowBuffer.length && windowBuffer[0].end < windowStartGlobal) {
                        windowBuffer.shift();
                    }

                    if (Date.now() - lastTriggerTime >= outputQuerySlide) {
                        lastTriggerTime = Date.now();
                        if (windowBuffer.length > r2sTopics.length) {
                            const target = { start: windowStartGlobal, end: now };
                            const aggregation = windowBuffer[windowBuffer.length - 1].agg;
                            const merged = mergeMultipleSlidingWindowResults(windowBuffer, target, aggregation);

                            windowBuffer.forEach((win, idx) => {
                                console.log(`Window ${idx + 1}: [${win.start}, ${win.end}] with value ${win.value}`);
                            });

                            console.log(`Merged result for window [${target.start}, ${target.end}]:`, merged);

                            rsp_client.publish('approximation/output', JSON.stringify(merged));
                            console.log(`Published merged result to 'approximation/output' topic:`, merged);
                        }
                    }
                } catch (error) {
                    console.log(`Error processing message from topic ${topic}:`, error);
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
    // Filter windows that overlap target
    const overlapping = windows.filter(w => w.end > target.start && w.start < target.end);
    if (overlapping.length === 0) return 0;

    // MIN/MAX aggregation - straightforward from overlapping window values
    if (agg === 'MIN') {
        return Math.min(...overlapping.map(w => w.value));
    }
    if (agg === 'MAX') {
        return Math.max(...overlapping.map(w => w.value));
    }

    // For SUM, AVG, COUNT: partition target window by all unique boundaries from overlapping windows
    const boundaries = new Set<number>();
    boundaries.add(target.start);
    boundaries.add(target.end);
    overlapping.forEach(w => {
        if (w.start > target.start && w.start < target.end) boundaries.add(w.start);
        if (w.end > target.start && w.end < target.end) boundaries.add(w.end);
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

    let totalSum = 0;
    let totalDuration = 0;

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
        const subStart = sortedBoundaries[i];
        const subEnd = sortedBoundaries[i + 1];
        const subDuration = subEnd - subStart;
        if (subDuration <= 0) continue;

        // Identify windows covering this subinterval
        const coveringWindows = overlapping.filter(w => w.start <= subStart && w.end >= subEnd);
        if (coveringWindows.length === 0) continue;

        // Compute sum of rates (value / duration) for windows covering subinterval
        const subValueRateSum = coveringWindows.reduce((acc, w) => {
            const windowDuration = w.end - w.start;
            if (windowDuration <= 0) return acc;
            const rate = w.value / windowDuration;
            return acc + rate;
        }, 0);

        // Add weighted contribution for this subinterval
        totalSum += subValueRateSum * subDuration;
        totalDuration += subDuration;
    }

    if (agg === 'COUNT') {
        // COUNT treated similar to SUM of rates over time
        return totalSum;
    }
    if (agg === 'SUM') {
        return totalSum;
    }
    if (agg === 'AVG') {
        return totalDuration > 0 ? totalSum / totalDuration : 0;
    }

    return 'Not Supported';
}
