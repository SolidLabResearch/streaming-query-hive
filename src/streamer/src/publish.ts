
import { StreamToMQTT } from './publishing/StreamToMQTT';

/**
 *
 */
async function replayXStream() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'src/streamer/data/acc-x.nt', "accX");
    console.log("Starting replay for accX stream");
    await publisher.replay_streams();
    console.log("Replay completed for accX stream");
}

async function replayYStream() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'src/streamer/data/acc-y.nt', "accY");
    console.log("Starting replay for accY stream");
    await publisher.replay_streams();
    console.log("Replay completed for accY stream");

}

async function replayZStream() {
    const publisher = new StreamToMQTT('mqtt://localhost:1883', 1, 'src/streamer/data/acc-z.nt', "accZ");
    console.log("Starting replay for accZ stream");
    await publisher.replay_streams();
    console.log("Replay completed for accZ stream");
}

async function replayStreams() {
    replayXStream();
    replayYStream();
    replayZStream();
}
replayStreams().catch((error) => {
    console.error("Error during stream replay:", error);
});