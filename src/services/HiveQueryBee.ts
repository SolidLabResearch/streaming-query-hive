import { fork, ChildProcess } from "child_process";
import * as path from "path";

export class HiveQueryBee {

    private process: ChildProcess;
    private queryHash: string;
    private query: string

    constructor(query: string, topic: string, queryHash: string) {
        const beeWorkerPath = path.resolve(__dirname, "BeeWorker.js");

        this.queryHash = queryHash;
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


    stop() {
        this.process.kill();
    }
}