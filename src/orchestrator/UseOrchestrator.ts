import { Orchestrator } from "./Orchestrator";

async function main() {
    const orchestrator = new Orchestrator();
    // Add sub-queries
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
}
    `;
    const query2 = `
                PREFIX mqtt_broker: <mqtt://localhost:1883/>
    PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 
REGISTER RStream <output> AS
SELECT (AVG(?o2) AS ?avgY)
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:accY [RANGE 60000 STEP 60000]
WHERE {
    WINDOW :w2 {
        ?s saref:hasValue ?o2 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .
    }
}
    `;
    orchestrator.addSubQuery(query1);
    orchestrator.addSubQuery(query2);
    console.log("Sub-queries added:", orchestrator.getSubQueries());
    // Register a query
    const registeredQuery = `
                PREFIX mqtt_broker: <mqtt://localhost:1883/>
    PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js> 
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgX) (AVG(?o2) AS ?avgY)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 120000 STEP 30000]
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:accY [RANGE 120000 STEP 30000]
WHERE {
   { WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
}}
    UNION
    { WINDOW :w2 {
        ?s2 saref:hasValue ?o2 .
        ?s2 saref:relatesToProperty dahccsensors:wearable.acceleration.y .
    }}
}
    `;
    orchestrator.registerQuery(registeredQuery);
    console.log("Registered query:", orchestrator.getRegisteredQuery());
    // Run sub-queries
    // Run registered query
    orchestrator.runRegisteredQuery();
}

main().catch(error => {
    console.error("Error in orchestrator:", error);
});