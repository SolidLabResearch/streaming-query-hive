import { QueryCombiner } from "hive-thought-rewriter";
import { RSPQLParser } from "rsp-js";
import mqtt from "mqtt";
import { ContainmentChecker } from "rspql-containment-checker";
import { ExtractedQuery, QueryMap } from "../util/Types";
import { generateQuery } from "../util/Util";

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

    constructor(query: string, r2s_topic: string) {
        this.containmentChecker = new ContainmentChecker();
        this.queryCombiner = new QueryCombiner();
        this.query = query;
        this.r2s_topic = r2s_topic;
        this.queryFetchLocation = "http://localhost:8080/fetchQueries";
        this.containedQueriesForApproximation = [];
        this.queryParser = new RSPQLParser();
        if (!query || !r2s_topic) {
            throw new Error("Missing required parameters: query and r2s_topic");
        }
    }

    public async process() {
        const existingQueries = await this.fetchExistingQueries(this.queryFetchLocation);
        const extractedQueries = await this.extractQueriesWithTopics(JSON.parse(existingQueries) as QueryMap);
        const containedQueries = await this.findContainedQueries(extractedQueries);

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
                this.processApproximationApproach();
            } else {
                console.log(`The subqueries are contained but however the combined query cannot be utilized to make the original registered query.`);
            }

        } else {
            console.log("No contained queries found.");
        }
    }


    processApproximationApproach() {
        if (this.queryMQTTTopicMap.size === 0) {
            console.log("No MQTT topics found for the queries.");
            return;
        }
        const outputQueryParsed = this.queryParser.parse(this.query);
        const outputQueryWidth = outputQueryParsed.s2r[0].width;
        const outputQuerySlide = outputQueryParsed.s2r[0].slide;

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

            for (const mqttTopic of topics) {
                rsp_client.subscribe(mqttTopic, (err) => {
                    if (err) {
                        console.error(`Failed to subscribe to topic ${mqttTopic}:`, err);
                    } else {
                        console.log(`Subscribed to topic ${mqttTopic}`);
                    }
                });
            }

            // Add the approximation logic for the queries to create result for the original query

        });

    }

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


    async extractQueriesWithTopics(data: QueryMap): Promise<ExtractedQuery[]> {
        const extractedQueries: ExtractedQuery[] = [];

        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const entry = data[key];
                if (entry.rspql_query && entry.r2s_topic) {
                    extractedQueries.push({
                        rspql_query: entry.rspql_query,
                        r2s_topic: entry.r2s_topic
                    });
                }
            }
        }

        return extractedQueries;
    }


    async findContainedQueries(extractedQueries: ExtractedQuery[]): Promise<string[]> {
        const containedQueries: string[] = [];
        for (const extractedQuery of extractedQueries) {
            this.query = this.removeAggregationFunctions(this.query);
            extractedQuery.rspql_query = this.removeAggregationFunctions(extractedQuery.rspql_query);
            let queryY = generateQuery(['y', 'x', 'z']);
            let queryZ = generateQuery(['z', 'y', 'x']);
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
             * https://kushbisen.top/assets/Working-Notes/Working-Note-001
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

    removeAggregationFunctions(query: string): string {
        // This regex will match any aggregation function like AVG(?x) AS ?alias
        // Replace any function like AVG(?x) AS ?alias with just ?x
        return query.replace(/\(\s*\w+\s*\(\s*\?(\w+)\s*\)\s+AS\s+\?\w+\s*\)/g, '?$1');
    }


}