import { RSPEngine, RSPQLParser, WindowDefinition } from "rsp-js";
import { EventEmitter } from "events";
import fs from "fs";

export class ExecutingSubQueriesAndSuperQueryApproach {
    public superQuery: string;
    public subQueries: string[];
    public rspql_parser: RSPQLParser;
    public superQueryEngine: RSPEngine;
    public subQueryEngines: Map<string, RSPEngine>;
    public rstream_emitter: EventEmitter;
    private logStream!: fs.WriteStream;
    
    constructor(superQuery: string, subQueries: string[]) {
        this.superQuery = superQuery;
        this.subQueries = subQueries;
        this.rspql_parser = new RSPQLParser();
        this.superQueryEngine = new RSPEngine(superQuery);
        this.subQueryEngines = new Map();
        this.initializeSubQueryEngines();
        
        this.rstream_emitter = new EventEmitter();
    }


    private initializeSubQueryEngines(): void {
        this.subQueries.forEach((subQuery, index) => {
            const subQueryEngine = new RSPEngine(subQuery);
            const queryKey = `subquery_${index}`;
            this.subQueryEngines.set(queryKey, subQueryEngine);
            console.log(`Initialized RSP engine for sub-query ${index + 1}`);
        });
    }

    private initializeLogging(filePath: string): void {
        const writeHeader = !fs.existsSync(filePath);
        this.logStream = fs.createWriteStream(filePath, { flags: 'a' });

        if (writeHeader) {
            this.logStream.write('timestamp,message\n');
        }
    }

    public log(message: string){
        const timestamp = Date.now();
        if (this.logStream) {
            this.logStream.write(`${timestamp},"${message.replace(/"/g, '""')}"\n`);
        }
        console.log(`[${new Date(timestamp).toISOString()}] ${message}`);
    }

    process_streams(){
        const streams = this.returnStreams();
    }

    returnStreams(): WindowDefinition[] {
        const allQueries = [this.superQuery, ...this.subQueries];
        const streamSet: Set<WindowDefinition> = new Set();
        
        for (const query of allQueries) {
            const parsedQuery = this.rspql_parser.parse(query);
            if (parsedQuery){
                parsedQuery.s2r.forEach(windowDef => streamSet.add(windowDef));
            }
        }
        return Array.from(streamSet);
    }
}