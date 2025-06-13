const { spawn } = require('child_process');

function runScript(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [script], { stdio: 'inherit' });
    proc.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

(async () => {
  try {
    console.log('Starting Approximation Approach experiments...');
    await runScript('experiment-evaluation-approximation-approach.js');
    console.log('Approximation Approach experiments complete.');

    console.log('Starting Streaming Query Hive experiments...');
    await runScript('experiment-evaluation-streaming-query-hive.js');
    console.log('Streaming Query Hive experiments complete.');
  } catch (err) {
    console.error('Error running experiments:', err);
  }
})();
