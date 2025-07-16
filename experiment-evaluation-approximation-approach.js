const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUNS = 1;
const LOGS_DIR = 'logs/approximation-approach';
const APPROACH_CMD = ['node', ['dist/approaches/ApproximationApproachOrchestrator.js']];
const PUBLISH_CMD = ['node', ['dist/streamer/src/publish.js']];
const LOG_FILES = [
  'approximation_log.csv',
  'approximation_resource_usage.csv',
  'replayer-log.csv'
];
const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

async function runOnce(iter) {
  console.log(`--- Run ${iter} ---`);

  // Start the approach process
  const approach = spawn(APPROACH_CMD[0], APPROACH_CMD[1], { stdio: 'inherit' });

  // Start the publisher process after a short delay
  await new Promise(res => setTimeout(res, 2000));
  const publisher = spawn(PUBLISH_CMD[0], PUBLISH_CMD[1], { stdio: 'inherit' });

  // Set up a timeout to kill both processes after TIMEOUT_MS
  const timeout = setTimeout(() => {
    console.log('Timeout reached, killing processes...');
    approach.kill();
    publisher.kill();
  }, TIMEOUT_MS);

  // Wait for publisher to finish or timeout
  await new Promise((resolve) => {
    publisher.on('exit', () => resolve());
  });

  // Wait for approach to finish or timeout
  await new Promise((resolve) => {
    approach.on('exit', () => resolve());
  });

  clearTimeout(timeout);

  // Move/rename log files into a subfolder for this iteration
  const iterDir = path.join(LOGS_DIR, `iteration${iter}`);
  if (!fs.existsSync(iterDir)) fs.mkdirSync(iterDir);

  for (const file of LOG_FILES) {
    if (fs.existsSync(file)) {
      const newName = path.join(iterDir, file);
      fs.renameSync(file, newName);
    }
  }
}

(async () => {
  for (let i = 1; i <= RUNS; i++) {
    await runOnce(i);
    await new Promise(res => setTimeout(res, 2000));
  }
  console.log('All runs complete.');
})();