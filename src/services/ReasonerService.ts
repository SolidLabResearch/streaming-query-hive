import { n3reasoner } from "eyereasoner/dist";
import { storeToString } from "../util/Util";
const N3 = require('n3');

export class ReasonerService {
    public rules: string;
    constructor(rules: string) {
        this.rules = rules;
    }

    public get Rules(): string {
        return this.rules;
    }
    public set Rules(value: string) {
        this.rules = value;
    }

    public async reason(data: string): Promise<string> {
        let n3_parser = new N3.Parser({
            format: 'text/n3',
        });

        const store = new N3.Store();
        let rules = n3_parser.parse(this.rules);
        let triples = n3_parser.parse(data);

        for (let rule of rules) {
            store.addQuad(rule.subject, rule.predicate, rule.object, rule.graph);
        }

        for (let triple of triples) {
            store.addQuad(triple.subject, triple.predicate, triple.object, triple.graph);
        }

        const inferredStore = new N3.Store(
            await n3reasoner(store.getQuads(), undefined, {
                output: 'derivations',
                outputType: 'quads'
            })
        );

        return storeToString(inferredStore)
    }
}