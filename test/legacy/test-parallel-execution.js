// Note: This is a CommonJS module, so we need to use require() instead of import
const { ExecutingSubQueriesAndSuperQueryApproach } = require('./dist/approaches/ExecutingSubQueriesAndSuperQueryApproach.js');

/**
 * Simple test to demonstrate parallel execution of subqueries and super query
 */
async function testParallelExecution() {
    console.log(' Starting Parallel Execution Test...');

    // Sample subqueries (replace with your actual queries)
    const subQueries = [
        `
        PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX saref: <https://saref.etsi.org/core/>
        PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
        REGISTER RStream <output1> AS
        SELECT (MAX(?value) AS ?maxWearableX)
        FROM NAMED WINDOW <mqtt://localhost:1883/wearableX> ON STREAM mqtt_broker:wearableX [RANGE 45000 STEP 30000]
        WHERE {
            WINDOW <mqtt://localhost:1883/wearableX> {
                ?s1 saref:hasValue ?value .
                ?s1 saref:relatesToProperty dahccsensors:wearableX .
            }
        }
        `,
        `
        PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX saref: <https://saref.etsi.org/core/>
        PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
        REGISTER RStream <output2> AS
        SELECT (MAX(?value) AS ?maxSmartphoneX)
        FROM NAMED WINDOW <mqtt://localhost:1883/smartphoneX> ON STREAM mqtt_broker:smartphoneX [RANGE 45000 STEP 30000]
        WHERE {
            WINDOW <mqtt://localhost:1883/smartphoneX> {
                ?s2 saref:hasValue ?value .
                ?s2 saref:relatesToProperty dahccsensors:smartphoneX .
            }
        }
        `
    ];

    // Sample super query (replace with your actual super query)
    const superQuery = `
    PREFIX mqtt_broker: <mqtt://localhost:1883/>
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    REGISTER RStream <sensor_averages> AS
    SELECT (MAX(?value) AS ?maxValue)
    FROM NAMED WINDOW <mqtt://localhost:1883/wearableX> ON STREAM mqtt_broker:wearableX [RANGE 90000 STEP 60000]
    FROM NAMED WINDOW <mqtt://localhost:1883/smartphoneX> ON STREAM mqtt_broker:smartphoneX [RANGE 90000 STEP 60000]
    WHERE {
        {
            WINDOW <mqtt://localhost:1883/wearableX> {
                ?s1 saref:hasValue ?value .
                ?s1 saref:relatesToProperty dahccsensors:wearableX .
            }
        } UNION {
            WINDOW <mqtt://localhost:1883/smartphoneX> {
                ?s2 saref:hasValue ?value .
                ?s2 saref:relatesToProperty dahccsensors:smartphoneX .
            }
        }
    }
    `;

    try {
        // Create instance
        const approach = new ExecutingSubQueriesAndSuperQueryApproach(subQueries, superQuery);
        console.log(' Approach instance created');

        // Track timing
        const startTime = Date.now();

        // Method 1: Initialize all agents in parallel (recommended)
        console.log('\n Starting parallel initialization...');
        const result = await approach.initializeAllAgentsInParallel();

        const endTime = Date.now();
        console.log(`  Parallel initialization completed in ${endTime - startTime}ms`);

        // Display results
        console.log(`\n Results:`);
        console.log(`   - Subquery agents created: ${result.subQueryAgents.length}`);
        console.log(`   - Super query agent created: ${result.superQueryAgent ? '1' : '0'}`);
        
        // Get agent count
        const agentCount = approach.getAgentCount();
        console.log(`   - Total agents: ${agentCount.total}`);

        // Let agents run for a few seconds
        console.log('\n Letting agents run for 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Stop all agents
        console.log('\n Stopping all agents...');
        approach.stopAllAgents();

        console.log(' Test completed successfully!');
        return true;

    } catch (error) {
        console.error(' Test failed:', error);
        return false;
    }
}

/**
 * Performance comparison test
 */
async function performanceTest() {
    console.log('\n‍ Performance Test: Parallel vs Sequential');

    const subQueries = ['query1', 'query2']; // Simplified for testing
    const superQuery = 'superQuery';

    try {
        // Test parallel execution
        console.log('\n--- Testing Parallel Execution ---');
        const approach1 = new ExecutingSubQueriesAndSuperQueryApproach(subQueries, superQuery);
        
        const parallelStart = Date.now();
        await approach1.initializeAllAgentsInParallel();
        const parallelTime = Date.now() - parallelStart;
        
        console.log(`Parallel execution time: ${parallelTime}ms`);
        approach1.stopAllAgents();

        // Test sequential execution
        console.log('\n--- Testing Sequential Execution ---');
        const approach2 = new ExecutingSubQueriesAndSuperQueryApproach(subQueries, superQuery);
        
        const sequentialStart = Date.now();
        await approach2.initializeAgentsSequentially();
        const sequentialTime = Date.now() - sequentialStart;
        
        console.log(`Sequential execution time: ${sequentialTime}ms`);
        approach2.stopAllAgents();

        // Compare results
        console.log('\n Performance Comparison:');
        console.log(`   Parallel:   ${parallelTime}ms`);
        console.log(`   Sequential: ${sequentialTime}ms`);
        console.log(`   Speedup:    ${(sequentialTime / parallelTime).toFixed(2)}x`);

    } catch (error) {
        console.error(' Performance test failed:', error);
    }
}

// Main execution
async function main() {
    console.log(' Running ExecutingSubQueriesAndSuperQueryApproach Tests\n');

    // Run basic test
    const testResult = await testParallelExecution();
    
    if (testResult) {
        // Run performance test
        await performanceTest();
    }

    console.log('\n All tests completed!');
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testParallelExecution, performanceTest };
