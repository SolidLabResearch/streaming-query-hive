
import { StreamToMQTT } from './publishing/StreamToMQTT';

/**
 *
 */
async function main() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'src/streamer/data/rdfData/accelerometer/acc-x.nt', "spo2");
    await publisher.replay_streams();
}

main();