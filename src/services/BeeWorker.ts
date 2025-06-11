import { QueryCombiner } from "hive-thought-rewriter";
import { ContainmentChecker } from "rspql-containment-checker";
import { ExtractedQuery, QueryMap } from "../util/Types";
import { generateQuery } from "../util/Util";
import { StreamingQueryChunkAggregatorOperator } from "./operators/StreamingQueryChunkAggregatorOperator";

export class BeeWorker {


    private query: string;
    private r2s_topic: string;
    private containmentChecker: ContainmentChecker;
    private queryCombiner: QueryCombiner;
    private queryFetchLocation: string;
    private streamingQueryChunkAggregatorOperator: StreamingQueryChunkAggregatorOperator;
    constructor() {
        this.containmentChecker = new ContainmentChecker();
        this.queryCombiner = new QueryCombiner();
        this.queryFetchLocation = "http://localhost:8080/fetchQueries";
        const query = process.env.QUERY;
        const r2s_topic = process.env.TOPIC;
        if (!query || !r2s_topic) {
            throw new Error("Missing required environment variables");
            process.exit(1);
        }
        this.query = query;
        this.r2s_topic = r2s_topic;
        this.streamingQueryChunkAggregatorOperator = new StreamingQueryChunkAggregatorOperator(this.query);
        console.log(`BeeWorker initialized with query: ${this.query} and topic: ${this.r2s_topic}`);
        this.process();
    }

    async process() {
        console.log(`proces() method is called`);

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
                    this.streamingQueryChunkAggregatorOperator.addSubQuery(containedQuery);
                }

                await this.streamingQueryChunkAggregatorOperator.init();
                this.streamingQueryChunkAggregatorOperator.handleAggregation();
            }
            else {
                console.log(`The subqueries are contained but however the combined query cannot be utilized to make the original registered query.`);
            }


        } else {
            console.log("There is no containment relationship between the query registered in the Bee and the existing queries run by the RSP Agents.");

        }

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

    removeAggregationFunctions(query: string): string {
        // This regex will match any aggregation function like AVG(?x) AS ?alias
        // Replace any function like AVG(?x) AS ?alias with just ?x
        return query.replace(/\(\s*\w+\s*\(\s*\?(\w+)\s*\)\s+AS\s+\?\w+\s*\)/g, '?$1');
    }





    stop() {

    }
}

const beeWorker = new BeeWorker();

process.on("SIGINT", () => {
    beeWorker.stop();
    process.exit(0);
});

process.on("SIGTERM", () => {
    beeWorker.stop();
    process.exit(0);
});

