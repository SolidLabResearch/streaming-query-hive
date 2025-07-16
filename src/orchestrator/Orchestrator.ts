import { RSPAgent } from "../agent/RSPAgent";
import { BeeKeeper } from "../services/BeeKeeper";
import { HTTPServer } from "../services/server/HTTPServer";
import config from '../config/httpServerConfig.json';
import { hash_string_md5 } from "../util/Util";

/**
 *
 */
export class Orchestrator {
    private subQueriesToRun: string[];
    private registeredQuery: string;
    private beeKeeper: BeeKeeper;
    private operatorType: string;
    private http_server: HTTPServer;

    /**
     *
     */
    constructor(operatorType: string) {
        this.subQueriesToRun = [];
        this.registeredQuery = "";
        this.beeKeeper = new BeeKeeper();
        this.http_server = new HTTPServer(config.port, console);
        this.operatorType = operatorType;
        console.log(`HTTP server has started on port ${config.port}`);
    }

    /**
     *
     * @param query
     */
    addSubQuery(query: string): void {
        this.subQueriesToRun.push(query);
        const query_hash = hash_string_md5(query);
        const queryAgent = new RSPAgent(query, `chunked/${query_hash}`);
        queryAgent.process_streams()
            .then(() => {
                console.log(`Added sub-query: ${query}`);
            }
            )
            .catch((error: Error) => {
                console.error(`Error processing sub-query "${query}":`, error);
            }
        );
        console.log(`Sub-query added: ${query}`);
    }

    /**
     *
     * @param query
     */
    deleteSubQuery(query: string): void {
        this.subQueriesToRun = this.subQueriesToRun.filter(q => q !== query);
    }

    /**
     *
     */
    getSubQueries(): string[] {
        return this.subQueriesToRun;
    }

    /**
     *
     * @param query
     */
    registerQuery(query: string): void {
        this.registeredQuery = query;
        console.log(`Registered query: ${query}`);
    }

    /**
     *
     */
    getRegisteredQuery(): string {
        return this.registeredQuery;
    }

    /**
     *
     */
    clearSubQueries(): void {
        this.subQueriesToRun = [];
        console.log("Cleared all sub-queries.");
    }

    /**
     *
     */
    runSubQueries(): void {
        if (this.subQueriesToRun.length === 0) {
            console.log("No queries to run.");
            return;
        }
        this.subQueriesToRun.forEach(query => {
            const queryAgent = new RSPAgent(query, "");
            queryAgent.process_streams()
                .then(() => {
                    console.log(`Starting query: ${query}`);
                })
                .catch((error: Error) => {
                    console.error(`Error processing query "${query}":`, error);
                });
        });
    }

    /**
     *
     */
    runRegisteredQuery(): void {
        if (this.registeredQuery === "") {
            console.log("No registered query to run.");
            return;
        }

        this.beeKeeper.executeQuery(this.registeredQuery, "output", this.operatorType)
        console.log(`Running registered query: ${this.registeredQuery}`);

    }
}