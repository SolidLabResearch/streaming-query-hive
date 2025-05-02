
import { StreamToMQTT } from './publishing/StreamToMQTT';

async function main() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'streamer/data/rdfData/spo2.nt', "spo2");
    await publisher.replay_streams();
}

main();