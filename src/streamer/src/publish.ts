
import { CSVLogger } from '../../util/logger/CSVLogger';
import { StreamToMQTT } from './publishing/StreamToMQTT';

/**
 *
 */
const logger = new CSVLogger('replayer-log.csv');

/**
 *
 */

async function replaySmartphoneXStream() {
    // Pass a unique clientId for persistent MQTT session
    const clientId = 'pub-' + Math.random().toString(16).substr(2, 8);
    const mqttOptions = { clean: false, clientId };
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 4, 'src/streamer/data/smartphone.acceleration.x/data.nt', "smartphoneX", mqttOptions);
    logger.log("Starting replay for SmartphoneX stream");
    await publisher.replay_streams();
    logger.log("Replay completed for SmartphoneX stream");

}

/**
 *
 */
async function replayWearableXStream() {
    // Pass a unique clientId for persistent MQTT session
    const clientId = 'pub-' + Math.random().toString(16).substr(2, 8);
    const mqttOptions = { clean: false, clientId };
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 4, 'src/streamer/data/wearable.acceleration.x/data.nt', "wearableX", mqttOptions);
    logger.log("Starting replay for WearableX stream");
    await publisher.replay_streams();
    logger.log("Replay completed for WearableX stream");
}

/**
 *
 */
async function replayStreams() {
    await Promise.all([
        replaySmartphoneXStream(),
        replayWearableXStream()
    ]);
    logger.log("All streams replayed successfully");
    process.exit(0);
}

replayStreams().catch((error) => {
    console.error("Error during stream replay:", error);
});