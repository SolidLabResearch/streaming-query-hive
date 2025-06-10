
import { StreamToMQTT } from './publishing/StreamToMQTT';

/**
 *
 */
async function main() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'src/streamer/data/rdfData/accelerometer/acc-x.nt', "accX");
    console.log("Starting replay for accX stream");
    await publisher.replay_streams();
    console.log("Replay completed for accX stream");
}

async function replayStreams() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'src/streamer/data/rdfData/accelerometer/acc-y.nt', "accY");
    console.log("Starting replay for accY stream"); 
    await publisher.replay_streams();
    console.log("Replay completed for accY stream");
    
}

main();

replayStreams().catch(console.error);