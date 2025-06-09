import { fork, ChildProcess } from "child_process";
import * as path from "path";

/**
 * 
 */
export class HiveQueryBee {

    private process: ChildProcess;
    private query: string

    /**
     *
     * @param query
     * @param topic
     * @param queryHash
     */
    constructor(query: string, topic: string) {
        const beeWorkerPath = path.resolve(__dirname, "BeeWorker.js");

        this.query = query;
        this.process = fork(beeWorkerPath, [], {
            env: {
                QUERY: query,
                TOPIC: topic
            }
        });

        this.process.on("message", (msg) => {
            console.log(`Query: ${this.query}`, msg);
        });

        this.process.on("exit", () => {
            console.log(`Query: ${this.query} exited`);
        })
    }


    /**
     *
     */
    stop() {
        this.process.kill();
    }
}