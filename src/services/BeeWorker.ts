import { QueryCombiner } from "hive-thought-rewriter";
import { ContainmentChecker } from "rspql-containment-checker";
import { ExtractedQuery, QueryMap } from "../util/Types";
import { generateQuery } from "../util/Util";
import { StreamingQueryChunkAggregatorOperator } from "./operators/StreamingQueryChunkAggregatorOperator";
import { ApproximationApproachOperator } from "./operators/ApproximationApproachOperator";
import { IQueryOperator } from "../util/Interfaces";

/**
 *
 */
export class BeeWorker {

    private query: string;
    private r2s_topic: string;
    private containmentChecker: ContainmentChecker;
    private operator: IQueryOperator;
    private queryCombiner: QueryCombiner;
    private queryFetchLocation: string;
    /**
     *
     */
    constructor() {
        this.containmentChecker = new ContainmentChecker();
        this.queryCombiner = new QueryCombiner();
        this.queryFetchLocation = "http://localhost:8080/fetchQueries";
        const query = process.env.QUERY;
        const queryOperator = process.env.QUERY_OPERATOR || "StreamingQueryChunkAggregatorOperator";
        const r2s_topic = process.env.TOPIC;
        if (!query || !r2s_topic) {
            throw new Error("Missing required environment variables");
        }
        if (queryOperator === "StreamingQueryChunkAggregatorOperator") {
            this.operator = new StreamingQueryChunkAggregatorOperator();
        }
        else if (queryOperator === "ApproximationApproachOperator") {
            this.operator = new ApproximationApproachOperator();
        }
        else {
            throw new Error(`Unsupported query operator: ${queryOperator}`);
        }
        this.query = query;
        this.r2s_topic = r2s_topic;
        console.log(`BeeWorker initialized with query: ${this.query} and topic: ${this.r2s_topic}`);
        this.process();
    }

    /**
     *
     */
    async process() {
        console.log(`process() method is called`);

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
                this.operator.addOutputQuery(this.query);
                for (const containedQuery of containedQueries) {
                    this.operator.addSubQuery(containedQuery);
                }
                this.operator.init();
                this.operator.handleAggregation();
            }
            else {
                console.log(`The subqueries are contained but however the combined query cannot be utilized to make the original registered query.`);
            }


        } else {
            console.log("There is no containment relationship between the query registered in the Bee and the existing queries run by the RSP Agents.");

        }

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

            const isContained = await this.containmentChecker.checkContainment(this.query, extractedQuery.rspql_query);

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
     * @param data
     */
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
     * @param query
     */
    removeAggregationFunctions(query: string): string {
        return query.replace(/\(\s*\w+\s*\(\s*\?(\w+)\s*\)\s+AS\s+\?\w+\s*\)/g, '?$1');
    }

    /**
     *
     */
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

