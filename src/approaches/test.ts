import { Literal } from "n3";
import { RSPEngine, RDFStream } from "rsp-js";

const N3 = require("n3");
const { DataFactory } = N3;
const { namedNode, defaultGraph, quad, literal } = DataFactory;
async function RSP() {
    let query = `
PREFIX mqtt_broker: <mqtt://localhost:1883/>
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT (AVG(?o) AS ?avgCombinedX) (AVG(?o2) AS ?avgCombinedX2)
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:wearableX [RANGE 10 STEP 2]
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:smartphoneX [RANGE 10 STEP 2]
WHERE {
   {
WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearableX .
}}
    UNION
    {
WINDOW :w2 {
        ?s2 saref:hasValue ?o2 .
        ?s2 saref:relatesToProperty dahccsensors:smartphoneX .
    }}
}
        `;

        let query1 = `
PREFIX mqtt_broker: <mqtt://localhost:1883/>
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT ?avgCombinedX ?avgCombinedX2
FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:wearableX [RANGE 10 STEP 2]
FROM NAMED WINDOW :w2 ON STREAM mqtt_broker:smartphoneX [RANGE 10 STEP 2]
WHERE {
    {
        SELECT (AVG(?o) AS ?avgCombinedX)
        WHERE {
            WINDOW :w1 {
                ?s saref:hasValue ?o .
                ?s saref:relatesToProperty dahccsensors:wearableX .
            }
        }
    }
    {
        SELECT (AVG(?o2) AS ?avgCombinedX2)
        WHERE {
            WINDOW :w2 {
                ?s2 saref:hasValue ?o2 .
                ?s2 saref:relatesToProperty dahccsensors:smartphoneX .
            }
        }
    }
}
`;
    let rspEngine = new RSPEngine(query1);
    let streamWearable = rspEngine.getStream("mqtt://localhost:1883/wearableX");
    let streamSmartphone = rspEngine.getStream("mqtt://localhost:1883/smartphoneX");
    let emitter = rspEngine.register();
    let results = new Array<string>();
    emitter.on("RStream", (object: any) => {
        console.log("received results");
        console.log(object.bindings.toString());

        results.push(object.bindings.toString());
    });
    if (streamSmartphone && streamWearable) {
        generate_data_smartphone(10, [streamSmartphone]);
        generate_data_wearable(10, [streamWearable]);
    }

    console.log(results);
}

RSP();



async function generate_data_wearable(num_events: number, rdfStreams: RDFStream[]) {
    for (let i = 0; i < num_events; i++) {
        rdfStreams.forEach((stream: any) => {
            const stream_element = quad(
                namedNode("https://rsp.js/test_subject_" + i),
                namedNode("https://saref.etsi.org/core/hasValue"),
                literal(Math.random() * 100),
                defaultGraph()
            );
            const stream_element2 = quad(
                namedNode("https://rsp.js/test_subject_" + i),
                namedNode("https://saref.etsi.org/core/relatesToProperty"),
                namedNode("https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearableX"),
                defaultGraph()
            );
            stream.add(stream_element, i);
            stream.add(stream_element2, i);
        });
    }
}

async function generate_data_smartphone(num_events: number, rdfStreams: RDFStream[]) {
    for (let i = 0; i < num_events; i++) {
        rdfStreams.forEach((stream: any) => {
            const stream_element = quad(
                namedNode("https://rsp.js/test_subject_" + i),
                namedNode("https://saref.etsi.org/core/hasValue"),
                literal(Math.random() * 100),
                defaultGraph()
            );
            const stream_element2 = quad(
                namedNode("https://rsp.js/test_subject_" + i),
                namedNode("https://saref.etsi.org/core/relatesToProperty"),
                namedNode("https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/smartphoneX"),
                defaultGraph()
            );
            stream.add(stream_element, i);
            stream.add(stream_element2, i);
        });
    }
}