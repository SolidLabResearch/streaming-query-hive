
import { StreamToMQTT } from './publishing/StreamToMQTT';

/**
 *
 */
async function main() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'src/streamer/data/rdfData/accelerometer/acc-x.nt', "accX");
    await publisher.replay_streams();
}

async function replayStreams() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'src/streamer/data/rdfData/accelerometer/acc-x.nt', "accY");
    await publisher.replay_streams();}

main();

replayStreams().catch(console.error);