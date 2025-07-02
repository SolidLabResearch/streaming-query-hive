import { QueryCombiner } from "hive-thought-rewriter";
import { ContainmentChecker } from "rspql-containment-checker";

/**
 *
 */
async function main() {
    const query1 = `
PREFIX mqtt_broker: <mqtt://localhost:1883/>
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgSmartphoneX)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:SmartphoneAccelerationX [RANGE 60000 STEP 60000]
WHERE {
WINDOW :w1 {
	?s saref:hasValue ?o .
	?s saref:relatesToProperty dahccsensors:smartphone.acceleration.x .
	}
}
    `;
    const query2 = `
PREFIX mqtt_broker: <mqtt://localhost:1883/>
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT (AVG(?o2) AS ?avgWearableX)
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:WearableAccelerationX [RANGE 60000 STEP 30000]
WHERE {
WINDOW :w2 {
	?s saref:hasValue ?o2 .
	?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
	}
}
    `;

    const queryCombiner = new QueryCombiner();
    queryCombiner.addQuery(query1);
    queryCombiner.addQuery(query2);
    const combinedQuery = queryCombiner.combine();
    console.log(`Combined Query: ${queryCombiner.ParsedToString(combinedQuery)}`);
}

// main();

/**
 *
 */
async function containment() {
    const query3 = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahcc: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT *
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:SmartphoneAccelerationX [RANGE 60000 STEP 60000]
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:WearableAccelerationX [RANGE 60000 STEP 30000]
WHERE {
{ WINDOW :w1 { ?s saref:hasValue ?o .
?s saref:relatesToProperty dahcc:smartphone . } } UNION { WINDOW :w2 { ?s2 saref:hasValue ?o2 .
?s2 saref:relatesToProperty dahcc:wearable . } }
}
`;

const query4 = `
PREFIX mqtt_broker: <mqtt://localhost:1883/>
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahcc: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT *
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:SmartphoneAccelerationX [RANGE 12000 STEP 30000]
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:WearableAccelerationX [RANGE 12000 STEP 30000]
WHERE {
{
WINDOW :w1 {
		?s saref:hasValue ?o .
		 ?s saref:relatesToProperty dahcc:smartphone .
	}
}
UNION
{
WINDOW :w2 {
		 ?s2 saref:hasValue ?o2 .
		 ?s2 saref:relatesToProperty dahcc:wearable .
	}
}
}
`;

const containmentChecker = new ContainmentChecker();
const containmentResult = await containmentChecker.checkContainment(query3, query4);
console.log(`Containment Result: ${containmentResult}`);

}

containment().catch(console.error);

const query3 = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgSmartphoneX) (AVG(?o2) AS ?avgWearableX)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:SmartphoneAccelerationX [RANGE 60000 STEP 60000]
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:WearableAccelerationX [RANGE 60000 STEP 30000]
WHERE {
{ WINDOW :w1 { ?s saref:hasValue ?o .
?s saref:relatesToProperty dahccsensors:smartphone.acceleration.x . } } UNION { WINDOW :w2 { ?s saref:hasValue ?o2 .
?s saref:relatesToProperty dahccsensors:wearable.acceleration.x . } }
}
`;