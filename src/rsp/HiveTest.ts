import { RSPChildAgent } from "../rsp/child/RSPChildAgent";
import { RSPParentAgent } from "../rsp/parent/RSPParentAgent";

async function ChildQuery1() {
    const query = `
            PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX saref: <https://saref.etsi.org/core/>
PREFIX func: <http://extension.org/functions#> 
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
        REGISTER RStream <output> AS
        SELECT ?o
        FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:spo2 [RANGE 10000 STEP 4000]
        WHERE {
            WINDOW :w1 { 
            ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
            }
        }
    `;
    const child_agent = new RSPChildAgent(query, "topic1");
    child_agent.process_mqtt_streams();
}

async function ChildQuery2() {
    const query = `
            PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX saref: <https://saref.etsi.org/core/>
PREFIX func: <http://extension.org/functions#> 
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
        REGISTER RStream <output> AS
        SELECT ?o
        FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:spo2 [RANGE 10000 STEP 4000]
        WHERE {
            WINDOW :w1 { ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .}
        }
    `;
    const child_agent = new RSPChildAgent(query, "topic2");
    child_agent.process_mqtt_streams();
}


async function ParentQuery() {
    const query = ``;

    const parent_agent = new RSPParentAgent(query, "rstream3");
    parent_agent.process_child_rstreams(["topic1", "topic2"]);
}


async function main() {
    ChildQuery1();
    ChildQuery2();
    ParentQuery()
}

main();