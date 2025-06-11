export class ApproximationApproach {
    public query: string;
    public r2s_topic: string;

    constructor(query: string, r2s_topic: string) {
        this.query = query;
        this.r2s_topic = r2s_topic;
    }

    public process() {

    }

    async fetchExistingQueries(location: string) : Promise<string> {
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

    

}