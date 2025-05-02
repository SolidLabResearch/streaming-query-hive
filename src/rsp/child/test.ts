import { RSPChildAgent } from "./RSPChildAgent";

async function main() {
    const query = `
            PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX : <https://rsp.js/>
        REGISTER RStream <output> AS
        SELECT ?p
        FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:spo2 [RANGE 10000 STEP 4000]
        WHERE{
            WINDOW :w1 { ?s ?p ?o}
        }
    `;
    const rstream_topic = "fd"
    const child_agent = new RSPChildAgent(query, rstream_topic);
    child_agent.process_mqtt_streams();
}

main();