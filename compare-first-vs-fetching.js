const fs = require('fs');
const path = require('path');

function extractFirstApproximationResult(logContent) {
    const lines = logContent.split('\n');
    
    // Look for the first "Successfully published unified cross-sensor average" line
    for (const line of lines) {
        if (line.includes('Successfully published unified cross-sensor average:')) {
            const match = line.match(/Successfully published unified cross-sensor average:\s*([\d.]+)/);
            if (match) {
                return parseFloat(match[1]);
            }
        }
    }
    return null;
}

function extractFetchingResult(logContent) {
    const lines = logContent.split('\n');
    
    // Look for the first "Successfully published result" line
    for (const line of lines) {
        if (line.includes('Successfully published result:')) {
            const match = line.match(/Successfully published result:\s*([\d.]+)/);
            if (match) {
                return parseFloat(match[1]);
            }
        }
    }
    return null;
}

const patterns = [
    'challenging_chaotic_oscillation',
    'challenging_exponential_decay', 
    'challenging_exponential_growth',
    'challenging_high_frequency_oscillation',
    'challenging_high_variance_random',
    'challenging_logarithmic',
    'challenging_sine_wave',
    'challenging_spike_pattern',
    'challenging_step_function',
    'favorable_constant_value',
    'favorable_gentle_sine',
    'favorable_gradual_trend',
    'favorable_linear_decreasing',
    'favorable_linear_increasing',
    'favorable_low_variance_random',
    'favorable_smooth_polynomial'
];

const results = [];

console.log('='.repeat(80));
console.log('              FIRST APPROXIMATION vs FETCHING CLIENT SIDE COMPARISON');
console.log('='.repeat(80));
console.log();

for (const pattern of patterns) {
    // Extract first approximation result from iteration1
    let firstApproxResult = null;
    const approxPath = `logs/approximation-patterns/${pattern}/iteration1/approximation_approach_log.csv`;
    
    if (fs.existsSync(approxPath)) {
        const logContent = fs.readFileSync(approxPath, 'utf8');
        firstApproxResult = extractFirstApproximationResult(logContent);
    }
    
    // Extract fetching client side result from iteration1
    let fetchingResult = null;
    const fetchingPath = `logs/fetching-client-side-patterns/${pattern}/iteration1/fetching_client_side_log.csv`;
    
    if (fs.existsSync(fetchingPath)) {
        const logContent = fs.readFileSync(fetchingPath, 'utf8');
        fetchingResult = extractFetchingResult(logContent);
    }
    
    if (firstApproxResult !== null && fetchingResult !== null) {
        const diff = Math.abs((firstApproxResult - fetchingResult) / fetchingResult * 100);
        const patternType = pattern.startsWith('challenging') ? 'Challenging' : 'Favorable';
        
        results.push({
            pattern,
            type: patternType,
            firstApprox: firstApproxResult,
            fetching: fetchingResult,
            diff: diff
        });
    } else {
        const patternType = pattern.startsWith('challenging') ? 'Challenging' : 'Favorable';
        results.push({
            pattern,
            type: patternType,
            firstApprox: firstApproxResult,
            fetching: fetchingResult,
            diff: null
        });
    }
}

// Generate detailed table
console.log('┌─' + '─'.repeat(35) + '┬─' + '─'.repeat(15) + '┬─' + '─'.repeat(15) + '┬─' + '─'.repeat(12) + '┬─' + '─'.repeat(12) + '┐');
console.log('│ Pattern                            │ First Approx    │ Fetching Client │ Accuracy     │ Pattern Type │');
console.log('│                                    │ Result          │ Result          │ Diff (%)     │              │');
console.log('├─' + '─'.repeat(35) + '┼─' + '─'.repeat(15) + '┼─' + '─'.repeat(15) + '┼─' + '─'.repeat(12) + '┼─' + '─'.repeat(12) + '┤');

results.forEach(result => {
    const pattern = result.pattern.replace('_', ' ').substring(0, 33).padEnd(34);
    const approx = result.firstApprox ? result.firstApprox.toFixed(4).padEnd(15) : 'N/A'.padEnd(15);
    const fetching = result.fetching ? result.fetching.toFixed(4).padEnd(15) : 'N/A'.padEnd(15);
    const diff = result.diff !== null ? `${result.diff.toFixed(2)}%`.padEnd(12) : 'N/A'.padEnd(12);
    const type = result.type.padEnd(12);
    
    console.log(`│ ${pattern} │ ${approx} │ ${fetching} │ ${diff} │ ${type} │`);
});

console.log('└─' + '─'.repeat(35) + '┴─' + '─'.repeat(15) + '┴─' + '─'.repeat(15) + '┴─' + '─'.repeat(12) + '┴─' + '─'.repeat(12) + '┘');

// Calculate summary statistics for patterns with complete data
const validResults = results.filter(r => r.diff !== null);
const challenging = validResults.filter(r => r.type === 'Challenging');
const favorable = validResults.filter(r => r.type === 'Favorable');

console.log('\n' + '='.repeat(80));
console.log('                               COMPARISON SUMMARY');
console.log('='.repeat(80));

console.log(`\n📊 TOTAL PATTERNS WITH COMPLETE DATA: ${validResults.length}/16`);

if (challenging.length > 0) {
    const challengingAvgDiff = challenging.reduce((sum, r) => sum + r.diff, 0) / challenging.length;
    const challengingMin = Math.min(...challenging.map(r => r.diff));
    const challengingMax = Math.max(...challenging.map(r => r.diff));
    
    console.log(`\n🔴 CHALLENGING PATTERNS (${challenging.length}/9 with data):`);
    console.log(`   • Average difference: ${challengingAvgDiff.toFixed(3)}%`);
    console.log(`   • Range: ${challengingMin.toFixed(3)}% - ${challengingMax.toFixed(3)}%`);
    
    const perfectChallenging = challenging.filter(r => r.diff < 0.01).length;
    console.log(`   • Perfect accuracy (≤0.01%): ${perfectChallenging}/${challenging.length} patterns`);
}

if (favorable.length > 0) {
    const favorableAvgDiff = favorable.reduce((sum, r) => sum + r.diff, 0) / favorable.length;
    const favorableMin = Math.min(...favorable.map(r => r.diff));
    const favorableMax = Math.max(...favorable.map(r => r.diff));
    
    console.log(`\n🟢 FAVORABLE PATTERNS (${favorable.length}/7 with data):`);
    console.log(`   • Average difference: ${favorableAvgDiff.toFixed(3)}%`);
    console.log(`   • Range: ${favorableMin.toFixed(3)}% - ${favorableMax.toFixed(3)}%`);
    
    const perfectFavorable = favorable.filter(r => r.diff < 0.01).length;
    console.log(`   • Perfect accuracy (≤0.01%): ${perfectFavorable}/${favorable.length} patterns`);
}

if (validResults.length > 0) {
    const overallAvg = validResults.reduce((sum, r) => sum + r.diff, 0) / validResults.length;
    const overallMin = Math.min(...validResults.map(r => r.diff));
    const overallMax = Math.max(...validResults.map(r => r.diff));
    const perfectOverall = validResults.filter(r => r.diff < 0.01).length;
    
    console.log(`\n🎯 OVERALL PERFORMANCE:`);
    console.log(`   • Average difference: ${overallAvg.toFixed(3)}%`);
    console.log(`   • Range: ${overallMin.toFixed(3)}% - ${overallMax.toFixed(3)}%`);
    console.log(`   • Perfect accuracy (≤0.01%): ${perfectOverall}/${validResults.length} patterns`);
    console.log(`   • Near-perfect accuracy (≤0.1%): ${validResults.filter(r => r.diff < 0.1).length}/${validResults.length} patterns`);
}

// Missing data analysis
const missingApprox = results.filter(r => r.firstApprox === null);
const missingFetching = results.filter(r => r.fetching === null);

if (missingApprox.length > 0 || missingFetching.length > 0) {
    console.log(`\n⚠️  MISSING DATA:`);
    if (missingApprox.length > 0) {
        console.log(`   • Missing approximation data: ${missingApprox.map(r => r.pattern).join(', ')}`);
    }
    if (missingFetching.length > 0) {
        console.log(`   • Missing fetching client side data: ${missingFetching.map(r => r.pattern).join(', ')}`);
    }
}

// Best and worst performers
if (validResults.length > 0) {
    const bestResult = validResults.reduce((best, current) => current.diff < best.diff ? current : best);
    const worstResult = validResults.reduce((worst, current) => current.diff > worst.diff ? current : worst);
    
    console.log(`\n🏆 PERFORMANCE HIGHLIGHTS:`);
    console.log(`   • Best accuracy: ${bestResult.pattern} (${bestResult.diff.toFixed(3)}% difference)`);
    console.log(`   • Worst accuracy: ${worstResult.pattern} (${worstResult.diff.toFixed(3)}% difference)`);
}

console.log('\n' + '='.repeat(80));

// Export detailed results
const exportData = {
    summary: {
        totalPatterns: validResults.length,
        challengingPatterns: challenging.length,
        favorablePatterns: favorable.length,
        overallStats: validResults.length > 0 ? {
            averageDifference: validResults.reduce((sum, r) => sum + r.diff, 0) / validResults.length,
            minDifference: Math.min(...validResults.map(r => r.diff)),
            maxDifference: Math.max(...validResults.map(r => r.diff)),
            perfectAccuracy: validResults.filter(r => r.diff < 0.01).length
        } : null
    },
    detailedResults: results,
    missingData: {
        missingApproximation: missingApprox.map(r => r.pattern),
        missingFetching: missingFetching.map(r => r.pattern)
    }
};

fs.writeFileSync('first-vs-fetching-comparison.json', JSON.stringify(exportData, null, 2));
console.log('Detailed results exported to first-vs-fetching-comparison.json');
