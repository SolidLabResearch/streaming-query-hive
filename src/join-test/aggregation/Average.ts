import { RSPQLParser } from "../../util/parser/RSPQLParser";

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
FROM NAMED WINDOW ex:w1 ON STREAM ex:stream1 [RANGE 10 STEP 5]
WHERE {
  WINDOW ex:w1 {
    ?person ex:hasAge ?age.
  }
}
`;

async function main() {
  const parser = new RSPQLParser();
  const parsedSubQuery = parser.parse(aggSubQuery);
  const parsedSuperQuery = parser.parse(aggSuperQuery);

  const windowSubQuery = parsedSubQuery.s2r[0];
  const windowSuperQuery = parsedSuperQuery.s2r[0];

}

main();

