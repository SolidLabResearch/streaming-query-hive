import { ContainmentChecker } from "rspql-containment-checker";
import { QueryCombiner } from "hive-thought-rewriter"
import { StreamingQueryChunkAggregatorOperator } from "./operators/StreamingQueryChunkAggregatorOperator";
import { hash_string_md5 } from "../util/Util";

/**
 */
export class BeeWorker {

    private query: string;
    private r2s_topic: string | undefined;
    private interval: NodeJS.Timeout | null = null;
    private containmentChecker: ContainmentChecker;
    private queryCombiner: QueryCombiner;
    private streamingQueryChunkAggregatorOperator: StreamingQueryChunkAggregatorOperator;

    /**
     *
     */
    constructor() {
        this.containmentChecker = new ContainmentChecker();
        this.queryCombiner = new QueryCombiner();
        this.streamingQueryChunkAggregatorOperator = new StreamingQueryChunkAgregatorOperator();
        const query = process.env.QUERY;
        const r2s_topic = process.env.TOPIC;

        if (!query || !r2s_topic) {
            console.error(`Missing the Query or the R2S topic where the results should be published.`);
            process.exit(1);
        }

        this.query = query;
        this.r2s_topic = r2s_topic;

        console.log(`Started a Bee Worker for the Query`);
        // this.processAgentStreams();
        this.process();
    }


    async process() {
        const fetchLocation = "http://localhost:8080/fetchQueries";
        const executingQueries = await this.fetchExistingQueries(fetchLocation);
        let rspql_queries: string[] = [];
        console.log(`Executing Queries: ${executingQueries}`);

        let parsed_queries = JSON.parse(executingQueries);
        if (!parsed_queries || Object.keys(parsed_queries).length === 0) {
            console.error(`No executing queries found or the fetch operation failed.`);
            return;
        }
        for (const [id, rspql_query] of Object.entries(parsed_queries)) {
            console.log(`Found executing query with ID: ${id}`);
            if (typeof rspql_query === "string") {
                rspql_queries.push(rspql_query);
                console.log(`RSPQL Query: ${rspql_query}`);
            } else {
                console.warn(`Skipping non-string rspql_query for ID: ${id}`);
            }
        }
        console.log(`Executing Queries: ${executingQueries}`);
        if (!executingQueries) {
            console.error(`No executing queries found or the fetch operation failed.`);
            return;
        }

        this.streamingQueryChunkAggregatorOperator.setOutputQuery(this.query);
        this.streamingQueryChunkAggregatorOperator.handleAggregation();

    }

    /**
     *
     */
    async processAgentStreams() {
        console.log(`Finding if there are existing queries with RSP Agents being processed which are contained in the query of the Bee Worker`);
        // Fetch the existing queries from the server
        const fetchLocation = "http://localhost:8080/fetchQueries";
        const executingQueries = await this.fetchExistingQueries(fetchLocation);
        let rspql_queries: string[] = [];
        console.log(`Executing Queries: ${executingQueries}`);

        let parsed_queries = JSON.parse(executingQueries);
        if (!parsed_queries || Object.keys(parsed_queries).length === 0) {
            console.error(`No executing queries found or the fetch operation failed.`);
            return;
        }
        for (const [id, rspql_query] of Object.entries(parsed_queries)) {
            console.log(`Found executing query with ID: ${id}`);
            if (typeof rspql_query === "string") {
                rspql_queries.push(rspql_query);
                console.log(`RSPQL Query: ${rspql_query}`);
            } else {
                console.warn(`Skipping non-string rspql_query for ID: ${id}`);
            }
        }
        console.log(`Executing Queries: ${executingQueries}`);
        if (!executingQueries) {
            console.error(`No executing queries found or the fetch operation failed.`);
            return;
        }

        // Check for containment of the existing queries with the new query
        const containedQueries = await this.findContainedQueries(rspql_queries, this.query);

        if (containedQueries) {
            // Check which queries can be reused
            // Rewriting and combining the queries
            // for (const [id, rspql_query] of containedQueries) {
            //     this.queryCombiner.addQuery(rspql_query);
            // }
            // const combined_query = this.queryCombiner.combine();
            // const combined_query_string = combined_query.toString();

            // Now we have a combined query that can be used to process the streams
            // Time to do a completeness and soundness check

            // const is_complete = await this.completenessCheck(combined_query_string, this.query);
            // const is_sound = await this.soundnessCheck(combined_query_string, this.query);
            // if (is_complete && is_sound) {
            console.log('The combined query is complete and sound');
            const registeredQuery = `
                PREFIX mqtt_broker: <mqtt://localhost:1883/>
    PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgX) (AVG(?o) AS ?avgY)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 120000 STEP 30000]
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accY [RANGE 120000 STEP 30000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
    UNION
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .
    }
}
    `;
            // this.streamingQueryChunkAggregatorOperator.setOutputQuery(combined_query_string);
            this.streamingQueryChunkAggregatorOperator.setOutputQuery(registeredQuery);
            this.streamingQueryChunkAggregatorOperator.handleAggregation();
            // Handle the case where the combined query is complete and sound
            // This means that the Bee Worker can start processing the combined query
            // and reuse the existing queries from the RSP Agents
            // console.log(`Combined Query: ${combined_query_string}`);
            // }
            // else {
            // console.log('There was partial containment of the queries, however the combined query is not complete or sound');
            // Handle the case where the combined query is not complete or sound
            // }

        }
        else {
            console.log(`There are no existing queries by the RSP Agents that are contained in the query of the Bee Worker`);
            // Handle the case where there are no contained queries 
            // Therefore the Bee Worker can start processing the entire query by itself rather than reusing the existing queries
        }
    }


    /**
     *
     * @param fetchLocation
     */
    async fetchExistingQueries(fetchLocation: string) {
        const response = await fetch(fetchLocation, {
            'method': 'GET',
        });

        const executingQueries = await response.text();
        console.log(`Fetched existing queries from ${fetchLocation}: ${executingQueries}`);
        if (!executingQueries) {
            console.error(`No executing queries found or the fetch operation failed.`);
            return '';
        }
        console.log(`Executing Queries: ${executingQueries}`);

        return executingQueries;
    }


    /**
     *
     */
    async validateQueryContainment() {
        // First Rewrite the SubQueries
        console.log(`Rewriting the different subQueries to check for containment`);
        if (!this.query) {
            console.error(`Query is not defined`);
            return;
        }
        const query_to_check = this.query;
        console.log(`Query to check for containment: ${query_to_check}`);

        this.rewriteSubQueries();

        // Check for Completeness and Soundness


    }

    /**
     *
     */
    async rewriteSubQueries() {
        console.log(`Rewriting SubQueries for the Query: ${this.query}`);


    }


    /**
     *
     * @param queryOne
     * @param queryTwo
     */
    async completenessCheck(queryOne: string, queryTwo: string) {
        return true; // Placeholder for completeness check logic
        // Uncomment the following lines when the containment checker is implemented
        // console.log(`Completeness Check between ${queryOne} and ${queryTwo}`);
        // const is_complete = await this.containmentChecker.checkContainment(queryTwo, queryOne);
        // if (is_complete) {
        //     console.log(`Completeness Check passed`);
        //     return true;
        // } else {
        //     console.log(`Completeness Check failed`);
        //     return false;
        // }
    }

    /**
     *
     * @param queryOne
     * @param queryTwo
     */
    async soundnessCheck(queryOne: string, queryTwo: string) {
        return true; // Placeholder for soundness check logic
        // Uncomment the following lines when the containment checker is implemented
        // console.log(`Soundness Check between ${queryOne} and ${queryTwo}`);
        // const is_sound = await this.containmentChecker.checkContainment(queryOne, queryTwo);
        // if (is_sound) {
        //     console.log(`Soundness Check passed`);
        //     return true;
        // } else {
        //     console.log(`Soundness Check failed`);
        //     return false;
        // }
    }

    /**
     *
     */
    async checkWindowParametersForQueries() {
        // Check for Window Parameters of each Query with the new Query
        const existingQueries = await this.fetchExistingQueries("http://localhost:8080/fetchQueries");
        console.log(`Existing Queries: ${existingQueries}`);
        // const containedQueries = await this.findContainedQueries(existingQueries, this.query);

        // if (containedQueries) {
        // Handle contained queries
        // }
    }


    /**
     *
     * @param executingQueries
     * @param query
     */
    async findContainedQueries(executingQueries: string[], query: string | undefined): Promise<Map<string, string> | undefined> {
        const test_map = new Map<string, string>();
        const query1 = `
            PREFIX mqtt_broker: <mqtt://localhost:1883/>
    PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgX)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 60000 STEP 60000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
}
    `;
        const query2 = `
                PREFIX mqtt_broker: <mqtt://localhost:1883/>
    PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgX)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accY [RANGE 60000 STEP 60000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .
    }
}
    `;
        test_map.set(hash_string_md5(query1), query1);
        test_map.set(hash_string_md5(query2), query2);
        return test_map; // Placeholder for contained queries logic


        // if (!query) {
        //     console.error(`Query is not defined`);
        //     return;
        // }
        // if (!executingQueries) {
        //     console.error(`Executing Queries are not defined`);
        //     return;
        // }
        // console.log(`Finding Contained Queries`);
        // console.log(`Executing Queries: ${executingQueries}`);
        // console.log(`Query: ${query}`);
        // const contained_queries: Map<string, string> = new Map();
        // console.log(executingQueries);

        // const executing_queries = JSON.parse(executingQueries);

        // const queryList = Object.values(executing_queries).map((entry: any) => ({
        //     id: entry.id,
        //     rspql_query: entry.rspql_query,
        // }));

        // for (const { id, rspql_query } of queryList) {
        //     console.log(`Checking Query Containment of Existing Queries to the Newly Registered Query`);
        //     const containment_check = await this.containmentChecker.checkContainment(id, rspql_query);

        //     if (containment_check) {
        //         contained_queries.set(id, rspql_query);
        //         console.log(`SubQuery with ${id} is contained in the Query`);
        //     }
        //     else {
        //         console.log(`SubQuery with ${id} is not contained in the Query`);
        //     }
        // }
        // return contained_queries;
    }


    /**
     *
     */
    stop() {

    }

}

const worker = new BeeWorker();

process.on("SIGINT", () => {
    worker.stop();
    process.exit(0);
});

process.on("SIGTERM", () => {
    worker.stop();
    process.exit(0);
});