import { RSPChildAgent } from "./RSPChildAgent";

async function main() {
    const query = `
            PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX : <https://rsp.js/>
        REGISTER RStream <output> AS
        SELECT *
        FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:spo2 [RANGE 10000 STEP 4000]
        WHERE {
            WINDOW :w1 { ?s ?p ?o .}
        }
    `;
    const child_agent = new RSPChildAgent(query, "topic1");
    child_agent.process_mqtt_streams();
}

main();