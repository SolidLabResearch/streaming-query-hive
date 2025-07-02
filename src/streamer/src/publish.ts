
import { CSVLogger } from '../../util/logger/CSVLogger';
import { StreamToMQTT } from './publishing/StreamToMQTT';

/**
 *
 */
const logger = new CSVLogger('replayer-log.csv');

/**
 *
 */
async function replayXStream() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 4, 'src/streamer/data/2minutes/acc-x.nt', "accX");
    logger.log("Starting replay for accX stream");
    await publisher.replay_streams();
    logger.log("Replay completed for accX stream");
}

/**
 *
 */
async function replayYStream() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 4, 'src/streamer/data/2minutes/acc-y.nt', "accY");
    logger.log("Starting replay for accY stream");
    await publisher.replay_streams();
    logger.log("Replay completed for accY stream");

}

/**
 *
 */
async function replayZStream() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 4, 'src/streamer/data/2minutes/acc-z.nt', "accZ");
    logger.log("Starting replay for accZ stream");
    await publisher.replay_streams();
    logger.log("Replay completed for accZ stream");
}

/**
 *
 */
async function replayStreams() {
    await Promise.all([
        replayXStream(),
        replayYStream(),
        replayZStream()
    ]);
    logger.log("All streams replayed successfully");
    process.exit(0);
}

replayStreams().catch((error) => {
    console.error("Error during stream replay:", error);
});