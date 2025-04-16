import { CSPARQLWindow, ReportStrategy, Tick } from "../../operators/s2r";
import { RSPQLParser } from "../../util/parser/RSPQLParser";
import { lcm } from "../../util/Util";
// @ts-ignore
import { DataFactory, Quad } from "n3";
import { TemporalJoinOperator } from "../../operators/TemporalJoinOperator";
import { ChunkCreationOperator } from "../../operators/ChunkCreationOperator";
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

  const chunkCreationOperator = new ChunkCreationOperator(0, "width-and-slide");
  const joinedResults = chunkCreationOperator.temporalJoin(streamA, streamB);

  console.log(`Joined Results: ${joinedResults.length}`);


  for (const [window, quadContainer] of joinedResults) {
    console.log(`Window: ${window.open} - ${window.close}`);
    console.log(`Stream: ${quadContainer.elements.size}`);
    for (let quad of quadContainer.elements) {
      console.log(`Quad: ${quad.subject.value} ${quad.predicate.value} ${quad.object.value} ${quad.graph.value}`);
    }
  }

}
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
    console.log('Generated timestamp:', Date.now());
    console.log('Stream element:', stream_element);

  }
}



joinStreams();