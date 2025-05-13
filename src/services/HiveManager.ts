import { hash_string_md5 } from "../util/Util";
import { HiveQueryBee } from "./HiveQueryBee";

export class HiveManager {
    private bees: Map<string, any> = new Map();

    public executeQuery(query: string, r2s_topic: string) {
        const query_hash = hash_string_md5(query);
        const worker = new HiveQueryBee(query, r2s_topic, query_hash);
        this.bees.set(query_hash, worker);
    }


    stopQuery(query: string) {
        const query_hash = hash_string_md5(query);
        const worker = this.bees.get(query_hash);
        if (worker) {
            worker.stop();
            this.bees.delete(query_hash);
        }
    }
}