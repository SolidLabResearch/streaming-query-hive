import { StreamingQueryChunkAggregatorOperator } from "./StreamingQueryChunkAggregatorOperator";

describe("StreamingQueryChunkAggregatorOperator", () => {
    it("should find the LCM of window parameters from subqueries and output query", () => {
        const operator = new StreamingQueryChunkAggregatorOperator(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        operator.addSubQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        operator.addSubQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        operator.setOutputQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        const gcd = operator.findGCDChunk(operator.getSubQueries(), operator.getOutputQuery());
        console.log(`GCD of window parameters: ${gcd}`);
        expect(gcd).toBeGreaterThan(0); // Assuming GCD should be a positive number
        expect(gcd).toBeDefined(); // Ensure GCD is defined
        expect(gcd).not.toBeNaN(); // Ensure GCD is not NaN
        expect(gcd).not.toBe(Infinity); // Ensure GCD is not Infinity
    });

    it("should handle empty subqueries and output query", () => {
        const operator = new StreamingQueryChunkAggregatorOperator(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        operator.setOutputQuery("");
        const gcd = operator.findGCDChunk(operator.getSubQueries(), operator.getOutputQuery());
        expect(gcd).toBe(0); // Assuming GCD of empty input is 0
    });

    it("should handle single subquery with valid window parameters", () => {
        const operator = new StreamingQueryChunkAggregatorOperator(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        operator.addSubQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
    }
        `);
        operator.setOutputQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)                
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
    }
        `);
        const gcd = operator.findGCDChunk(operator.getSubQueries(), operator.getOutputQuery());
        console.log(`GCD of window parameters: ${gcd}`);
    });

    it("should handle multiple subqueries with different window parameters", () => {
        const operator = new StreamingQueryChunkAggregatorOperator(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        operator.addSubQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
    }
        `);
        operator.addSubQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS    
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 20 STEP 5]
    WHERE{
            
        ?sensor a :TempSensor.
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
        `);
        operator.setOutputQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 20 STEP 5]
    WHERE{
            
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
        `);
        const gcd = operator.findGCDChunk(operator.getSubQueries(), operator.getOutputQuery());
        console.log(`GCD of window parameters: ${gcd}`);
    }
    );

    it("should add subqueries and output query correctly", () => {
        const operator = new StreamingQueryChunkAggregatorOperator(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        operator.addSubQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
    }
        `);
        operator.setOutputQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
    }
        `);
        expect(operator.getSubQueries().length).toBe(1);
        expect(operator.getOutputQuery()).toContain("AVG(?v) AS ?avgTemp");
    }
    );

    it("should clear subqueries correctly", () => {
        const operator = new StreamingQueryChunkAggregatorOperator(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    FROM NAMED WINDOW :w2 ON STREAM :stream2 [RANGE 10 STEP 2]

    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
        WINDOW :w2 { ?sensor :value ?v ; :measurement: ?m }
    }
            `);
        operator.addSubQuery(`
            PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?v) AS ?avgTemp)
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    WHERE{
        ?sensor a :TempSensor.
        WINDOW :w1 { ?sensor :value ?v ; :measurement: ?m }
    }
        `);
        expect(operator.getSubQueries().length).toBe(1);
        operator.clearSubQueries();
        expect(operator.getSubQueries().length).toBe(0);
    }
    );
});
