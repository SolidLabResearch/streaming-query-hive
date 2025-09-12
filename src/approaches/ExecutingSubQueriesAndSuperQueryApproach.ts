import { RSPAgent } from "../agent/RSPAgent";

export class ExecutingSubQueriesAndSuperQueryApproach {
    public subQueries: string[];
    public superQuery: string;
    public promises: Promise<unknown>[];
    
    constructor(subQueries: string[], superQuery: string) {
        this.subQueries = subQueries;
        this.superQuery = superQuery;
        this.promises = [];


    }

    private createAgentPromise(query: string, topic: string): Promise<void> {

        const agentPromise = new Promise((resolve, reject) => {
            try {
                const agent = new RSPAgent(query, topic);
            } catch (error) {
                reject(error);
            }
        });

        this.promises.push(agentPromise);
    }

    public initializeAgents(){
        Promise.all(
            this.promises 
        ).then(() => {
            console.log("All agents initialized and queries registered.");
        }).catch((error) => {
            console.error("Error initializing agents:", error);
        });
    }
}