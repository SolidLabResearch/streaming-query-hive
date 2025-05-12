const aggSubQuery = `
PREFIX ex: <http://example.org/>
REGISTER RStream <output> AS
SELECT (AVG(?age) AS ?averageAgeOfEmployees)
FROM NAMED WINDOW ex:w1 ON STREAM ex:stream1 [RANGE 10 STEP 5]
WHERE {
  WINDOW ex:w1 { 
    ?person a ex:Employee.
    ?person ex:hasAge ?age.
  }
}
`;

const aggSuperQuery = `
PREFIX ex: <http://example.org/>
REGISTER RStream <output> AS
SELECT (AVG(?age) AS ?averageAgeOfEveryone)
FROM NAMED WINDOW ex:w1 ON STREAM ex:stream1 [RANGE 20 STEP 10]
WHERE {
  WINDOW ex:w1 {
    ?person ex:hasAge ?age.
  }
}
`;
import { CSPARQLWindow, ReportStrategy, Tick } from "../../operators/s2r";
import { RSPQLParser } from "../../util/parser/RSPQLParser";
import { lcm } from "../../util/Util";
// @ts-ignore
import { DataFactory, Quad } from "n3";
import { TemporalJoinOperator } from "../../operators/TemporalJoinOperator";
import { ChunkCreationOperator } from "../../operators/ChunkCreationOperator";
import { R2ROperator } from "../../operators/r2r";
import { GreatestChunkOperator } from "../../operators/GreatestChunkOperator";
const { namedNode, literal, defaultGraph, quad } = DataFactory;

const selectQueryOne = `
PREFIX ex: <http://example.org/>
REGISTER RStream <output> AS
SELECT *
FROM NAMED WINDOW ex:w1 ON STREAM ex:stream1 [RANGE 10 STEP 5]
WHERE {
  WINDOW ex:w1 { 
    ?person a ex:Employee.
    ?person ex:hasAge ?age.
  }
}
`;

const selectQueryTwo = `
PREFIX ex: <http://example.org/>
REGISTER RStream <output> AS
SELECT *
FROM NAMED WINDOW ex:w1 ON STREAM ex:stream2 [RANGE 10 STEP 5]
WHERE {
  WINDOW ex:w1 { 
    ?person a ex:Employee.
    ?person ex:hasAge ?age.
  }
}
`


const selectSuperQuery = `
PREFIX ex: <http://example.org/>
REGISTER RStream <output> AS
SELECT *
FROM NAMED WINDOW ex:w1 ON STREAM ex:stream1 [RANGE 20 STEP 10]
WHERE {
  WINDOW ex:w1 {
    ?person ex:hasAge ?age.
  }
}
`;


/**
 *
 */
async function joinStreams() {
  const parser = new RSPQLParser();
  const parsedSubQuery = parser.parse(selectQueryOne);
  const parsedSuperQuery = parser.parse(selectQueryTwo);
  const windowSubQuery = parsedSubQuery.s2r[0];
  const windowSuperQuery = parsedSuperQuery.s2r[0];

  const slideSubQuery = windowSubQuery.slide;
  const slideSuperQuery = windowSuperQuery.slide;
  const widthSubQuery = windowSubQuery.width;
  const widthSuperQuery = windowSuperQuery.width;


  const joinWidth = Math.max(widthSubQuery, widthSuperQuery);
  const joinSlide = lcm(slideSubQuery, slideSuperQuery);
  const joinWindowName = `window-join-${windowSubQuery.window_name}-${windowSuperQuery.window_name}`;
  const joinStreamName = `stream-join-${windowSubQuery.stream_name}-${windowSuperQuery.stream_name}`;
  const joinWindow = {
    window_name: joinWindowName,
    stream_name: joinStreamName,
    width: joinWidth,
    slide: joinSlide,
  };

  const streamA: CSPARQLWindow = new CSPARQLWindow('streamA', 10, 5, ReportStrategy.OnWindowClose, Tick.TimeDriven, 0, 60000);
  const streamB: CSPARQLWindow = new CSPARQLWindow('streamB', 20, 10, ReportStrategy.OnWindowClose, Tick.TimeDriven, 0, 60000);

  generate_data(100, streamA);
  generate_data(100, streamB);

  // const temporalJoinOperator = new TemporalJoinOperator(10, 5, 0);
  // const joinedResults = temporalJoinOperator.temporalJoin(streamA, streamB);
  // console.log(joinedResults);

  // const chunkCreationOperator = new ChunkCreationOperator(0, "width-and-slide");
  // const joinedResults = chunkCreationOperator.temporalJoin(streamA, streamB);

  const greatestChunk = new GreatestChunkOperator(0, "width-and-slide");
  const joinedResults = greatestChunk.temporalJoin(streamA, streamB);


  const r2rOperator = new R2ROperator(`select (AVG(?o) as ?avg) where { ?s ?p ?o. }`);
  for (const [window, quadContainer] of joinedResults) {

    
    const evaluation = await r2rOperator.execute(quadContainer)

    evaluation.on('data', (bindings: any) => {
      console.log(`Bindings: ${bindings.toString()} - window: ${window.open} - ${window.close}`);
    });

    evaluation.on('error', (error: any) => {
      console.error('Error:', error);
    });
  }
}


/**
 *
 * @param num_events
 * @param csparqlWindow
 */
function generate_data(num_events: number, csparqlWindow: CSPARQLWindow) {
  for (let i = 0; i < num_events; i++) {
    const stream_element = quad(
      namedNode('https://rsp.js/test_subject_' + i),
      namedNode('http://rsp.js/test_property'),
      // literal(Date.now().toString()),
      literal(i),
      namedNode('http://rsp.js/test_graph' + csparqlWindow.name),
    );
    csparqlWindow.add(stream_element, i);
  }
}



joinStreams();


