#!/usr/bin/env node

/**
 * Run rate comparison experiments for ONLY exponential growth and decay patterns
 * across all rates for both approximation and fetching approaches
 */

const { spawn } = require('child_process');

const RATES = [0.001, 0.01, 0.1, 1, 10, 100];
const PATTERNS = ['exponential_growth', 'exponential_decay'];

async function runSingleTest(approach, pattern, rate) {
    return new Promise((resolve, reject) => {
        console.log(`\n🧪 Running ${approach} for ${pattern} with rate ${rate}`);
        
        const scriptName = approach === 'approximation' ? 
            'experiment-rate-comparison-approximation.js' : 
            'experiment-rate-comparison-fetching.js';
        
        const child = spawn('node', [scriptName, 'test', pattern, rate.toString()], {
            stdio: 'inherit',
            shell: true
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Completed: ${approach} ${pattern} rate ${rate}`);
                resolve();
            } else {
                console.error(`❌ Failed: ${approach} ${pattern} rate ${rate} (exit code: ${code})`);
                reject(new Error(`Test failed with exit code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            console.error(`❌ Error: ${error.message}`);
            reject(error);
        });
    });
}

async function runExponentialRateTests() {
    console.log('🚀 Starting Exponential Rate Comparison Tests');
    console.log(`Testing ${RATES.length} rates × ${PATTERNS.length} patterns = ${RATES.length * PATTERNS.length} approximation tests`);
    console.log(`Rates: ${RATES.join(', ')}`);
    console.log(`Patterns: ${PATTERNS.join(', ')}`);
    
    // First run all approximation tests
    console.log('\n📊 PHASE 1: Running Approximation Tests');
    let completed = 0;
    const total = RATES.length * PATTERNS.length;
    
    for (const pattern of PATTERNS) {
        console.log(`\n📈 Testing approximation for ${pattern}`);
        
        for (const rate of RATES) {
            try {
                completed++;
                console.log(`\n[${completed}/${total}] Approximation: ${pattern} rate ${rate}`);
                
                // Skip rate 0.1 exponential_growth as it's already done
                if (pattern === 'exponential_growth' && rate === 0.1) {
                    console.log('⏭️  Skipping - already completed');
                    continue;
                }
                
                await runSingleTest('approximation', pattern, rate);
                
                // Brief pause between tests
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`❌ Failed: approximation ${pattern} ${rate}`);
                console.error(error.message);
                // Continue with other tests
            }
        }
    }
    
    console.log('\n🎉 Approximation tests completed!');
    console.log('\n📋 Next: Run fetching tests with:');
    console.log('node run-exponential-rate-tests.js fetching');
}

async function runFetchingTests() {
    console.log('\n📊 PHASE 2: Running Fetching Client Side Tests');
    let completed = 0;
    const total = RATES.length * PATTERNS.length;
    
    for (const pattern of PATTERNS) {
        console.log(`\n📈 Testing fetching for ${pattern}`);
        
        for (const rate of RATES) {
            try {
                completed++;
                console.log(`\n[${completed}/${total}] Fetching: ${pattern} rate ${rate}`);
                
                await runSingleTest('fetching', pattern, rate);
                
                // Brief pause between tests
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`❌ Failed: fetching ${pattern} ${rate}`);
                console.error(error.message);
                // Continue with other tests
            }
        }
    }
    
    console.log('\n🎉 All exponential rate tests completed!');
    console.log('\n📈 Next steps:');
    console.log('1. Check logs/rate-comparison-approximation/ and logs/rate-comparison-fetching/');
    console.log('2. Run: node analyze-rate-comparison-results.js');
}

// Handle command line arguments
const phase = process.argv[2];

if (phase === 'fetching') {
    runFetchingTests().catch(console.error);
} else {
    runExponentialRateTests().catch(console.error);
}

// Handle interruption gracefully
process.on('SIGINT', () => {
    console.log('\n⚠️  Tests interrupted by user');
    console.log('Partial results available in logs/ directory');
    process.exit(0);
});
