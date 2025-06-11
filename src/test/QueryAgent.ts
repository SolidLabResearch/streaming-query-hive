import { RSPAgent } from "../agent/RSPAgent";

async function main() {
    const query1 = `
            PREFIX mqtt_broker: <mqtt://localhost:1883/>
    PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgX)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 60000 STEP 60000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
}`;

    const query2 = `
    PREFIX mqtt_broker: <mqtt://localhost:1883/>
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT *
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 60000 STEP 60000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
}`;

    const agent = new RSPAgent(query1, "testStream");
    await agent.process_streams();
}

main().catch((error) => {
    console.error("Error in main function:", error);
});

// Executing Queries: {"76dea1600c5b222fdcfb3c2f53d46903":{"rspql_query":"\n            PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o) AS ?avgX)\nFROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 60000 STEP 60000]\nWHERE {\n    WINDOW :w1 {\n        ?s saref:hasValue ?o .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .\n    }\n}\n    ","r2s_topic":"chunked/76dea1600c5b222fdcfb3c2f53d46903","data_topic":"chunked/76dea1600c5b222fdcfb3c2f53d46903","id":"76dea1600c5b222fdcfb3c2f53d46903"},"b306e048d00733f457e4a5f0c483b24d":{"rspql_query":"\n                PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o2) AS ?avgY)\nFROM NAMED WINDOW :w2 ON STREAM mqtt_broker:accY [RANGE 60000 STEP 60000]\nWHERE {\n    WINDOW :w2 {\n        ?s saref:hasValue ?o2 .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .\n    }\n}\n    ","r2s_topic":"chunked/b306e048d00733f457e4a5f0c483b24d","data_topic":"chunked/b306e048d00733f457e4a5f0c483b24d","id":"b306e048d00733f457e4a5f0c483b24d"},"792b6c1e965757f96964ddc1aad6cfd6":{"rspql_query":"\n                    PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o3) AS ?avgZ)\nFROM NAMED WINDOW :w3 ON STREAM mqtt_broker:accZ [RANGE 60000 STEP 60000]\nWHERE {\n    WINDOW :w3 {\n        ?s saref:hasValue ?o3 .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.z .\n    }\n}\n    ","r2s_topic":"chunked/792b6c1e965757f96964ddc1aad6cfd6","data_topic":"chunked/792b6c1e965757f96964ddc1aad6cfd6","id":"792b6c1e965757f96964ddc1aad6cfd6"}}
