import config from "../config/config.json"

export class BeeWorker {

    private query: string | undefined;
    private r2s_topic: string | undefined;
    private interval: NodeJS.Timeout | null = null;

    constructor() {

        const query = process.env.QUERY;
        const r2s_topic = process.env.TOPIC;

        if (!query || !r2s_topic) {
            console.error(`Missing the Query or the R2S topic where the results should be published.`);
            process.exit(1);
        }

        this.query = query;
        this.r2s_topic = r2s_topic;

        console.log(`Started a Bee Worker for the Query`);
    }

    async fetchExistingQueries(fetchLocation: string) {
        const response = await fetch(fetchLocation, {
            'method': 'GET',
        });

        const executingQueries = await response.text();
        return executingQueries;
    }


    async validateQueryContainment() {
        // First Rewrite the SubQueries
        
        // Check for Completeness and Soundness
    }


    async findContainedQueries(executingQueries: string, query: string) {
        const contained_queries: Map<string, string> = new Map();
        const executing_queries = JSON.parse(executingQueries);

        const queryList = Object.values(executing_queries).map((entry: any) => ({
            id: entry.id,
            rspql_query: entry.rspql_query,
        }));

        for (const { id, rspql_query } of queryList) {
            console.log(`Checking Query Containment of Existing Queries to the Newly Registered Query`);

            const containment_check_body = {
                "subQuery": rspql_query,
                "superQuery": query
            }

            const response = await fetch(config["containment-checker"], {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(containment_check_body)
            });

            const containment_check_response = await response.json();


            if (containment_check_response.containment) {
                contained_queries.set(id, rspql_query);
                console.log(`SubQuery with ${id} is contained in the Query`);
            }
            else {
                console.log(`SubQuery with ${id} is not contained in the Query`);
            }
        }

        return contained_queries;
    }


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