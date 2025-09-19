import { RSPAgent } from "../agent/RSPAgent";
import { BeeKeeper } from "../services/BeeKeeper";
import { HTTPServer } from "../services/server/HTTPServer";
import config from '../config/httpServerConfig.json';
import { hash_string_md5 } from "../util/Util";

/**
 * The orchestrator class is responsible for managing and executing the 
 * registered query and its associated sub-queries. It maintains a list of the 
 * sub-queries which are to be re-used by the registered query. 
 */
export class Orchestrator {
    private subQueriesToRun: string[];
    private registeredQuery: string;
    private beeKeeper: BeeKeeper;
    private operatorType: string;
    private http_server: HTTPServer;

    /**
     * Constructor for the Orchestrator class.
     * @param operatorType The type of operator to be used in the orchestrator.
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
     * Adds a sub-query to the orchestrator.
     * @param {string} query - The sub-query to add.
     * @return {void} - No return value.
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
     * Deletes a sub-query from the orchestrator.
     * @param {string} query - The sub-query to delete.
     * @returns {void} - No return value.
     */
    deleteSubQuery(query: string): void {
        this.subQueriesToRun = this.subQueriesToRun.filter(q => q !== query);
    }

    /**
     * Gets the list of sub-queries.
     * @returns {string[]} - The list of sub-queries.
     */
    getSubQueries(): string[] {
        return this.subQueriesToRun;
    }

    /**
     * Registers a query with the orchestrator.
     * @param {string} query - The query to register with the orchestrator.
     * @return {void} - No return value.
     */
    registerQuery(query: string): void {
        this.registeredQuery = query;
        console.log(`Registered query: ${query}`);
    }

    /**
     * Gets the registered query.
     * @returns {string} - The registered query.
     */
    getRegisteredQuery(): string {
        return this.registeredQuery;
    }

    /**
     * Clears all sub-queries from the orchestrator.
     * @returns {void} - No return value.
     */
    clearSubQueries(): void {
        this.subQueriesToRun = [];
    }

    /**
     * Runs all sub-queries managed by the orchestrator.
     * @returns {void} - No return value.
     */
    runSubQueries(): void {
        if (this.subQueriesToRun.length === 0) {
            console.log("No queries to run.");
            return;
        }
        this.subQueriesToRun.forEach(query => {
            const hash = hash_string_md5(query);
            const queryAgent = new RSPAgent(query, `chunked/${hash}`);
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
     * Runs the registered query managed by the orchestrator.
     * Executes the registered query using the BeeKeeper service.
     * @returns {void} - No return value.
     */
    runRegisteredQuery(): void {
        if (this.registeredQuery === "") {
            console.log("No registered query to run.");
            return;
        }

        this.beeKeeper.executeQuery(this.registeredQuery, "output", this.operatorType, this.subQueriesToRun)
        console.log(`Running registered query: ${this.registeredQuery}`);
    }
}