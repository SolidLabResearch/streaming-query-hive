const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUNS = 1;
const LOGS_DIR = 'logs/streaming-query-hive';
const APPROACH_CMD = ['node', ['dist/approaches/StreamingQueryHiveApproachOrchestrator.js']];
const PUBLISH_CMD = ['node', ['dist/streamer/src/publish.js']];
const LOG_FILES = [
  'streaming_query_chunk_aggregator_log.csv',
  'streaming_query_hive_resource_log.csv',
  'replayer-log.csv'
];
const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

async function runOnce(iter) {
  console.log(`--- Streaming Query Hive Run ${iter} ---`);

  const approach = spawn(APPROACH_CMD[0], APPROACH_CMD[1], { stdio: 'inherit' });

  await new Promise(res => setTimeout(res, 2000));
  const publisher = spawn(PUBLISH_CMD[0], PUBLISH_CMD[1], { stdio: 'inherit' });

  const timeout = setTimeout(() => {
    console.log('Timeout reached, killing processes...');
    approach.kill();
    publisher.kill();
  }, TIMEOUT_MS);

  await new Promise((resolve) => { publisher.on('exit', () => resolve()); });
  await new Promise((resolve) => { approach.on('exit', () => resolve()); });

  clearTimeout(timeout);

  const iterDir = path.join(LOGS_DIR, `iteration${iter}`);
  if (!fs.existsSync(iterDir)) fs.mkdirSync(iterDir, { recursive: true });

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
  console.log('All Streaming Query Hive runs complete.');
})();