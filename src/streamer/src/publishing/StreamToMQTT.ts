import { StreamConsumer } from "./StreamConsumer";
import * as fs from 'fs';
import * as mqtt from 'mqtt';
import * as path from 'path';
import { CSVLogger } from "../../../util/logger/CSVLogger";
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal } = DataFactory;

/**
 *
 */
export class StreamToMQTT {

    private stream_consumer: StreamConsumer;
    private store: any;
    private mqtt_client: mqtt.MqttClient;
    private file_location: string;
    private initialize_promise: Promise<void>;
    private sorted_observation_subjects!: string[];
    private observation_pointer: number = 0;
    private number_of_publish: number = 0;
    private queue: any[] = [];
    private topic_to_publish: string;
    private sort_subject_length: number = 0;
    private frequency: number;

    /**
     *
     * @param mqtt_broker
     * @param frequency
     * @param file_location
     * @param topic_to_publish
     */
    constructor(mqtt_broker: string, frequency: number, file_location: string, topic_to_publish: string) {
        this.store = new N3.Store();
        this.stream_consumer = new StreamConsumer(this.store);
        this.file_location = file_location;
        this.frequency = frequency;
        this.topic_to_publish = topic_to_publish;
        this.mqtt_client = mqtt.connect(mqtt_broker);
        this.initialize_promise = this.initialize();
    }

    /**
     *
     */
    async initialize(): Promise<void> {
        try {
            const store: typeof N3.Store = await this.load_dataset(this.file_location);
            this.sorted_observation_subjects = await this.sort_observations(store);
        } catch (error) {
            console.error('Error initializing StreamToMQTT:', error);
            throw error;
        }
    }

    /**
     *
     * @param store
     */
    async sort_observations(store: any): Promise<string[]> {
        const temp: string[] = [];

        for (const quad of store.match(null, 'https://saref.etsi.org/core/measurementMadeBy', null)) {
            temp.push(quad.subject.id);
        }

        const sorted = this.merge_sort(temp, store).reverse();
        this.sort_subject_length = sorted.length;
        return sorted;
    }

    /**
     *
     * @param array
     * @param store
     */
    merge_sort(array: string[], store: any): string[] {
        if (array.length <= 1) return array;

        const mid = Math.floor(array.length / 2);
        const left = this.merge_sort(array.slice(0, mid), store);
        const right = this.merge_sort(array.slice(mid), store);
        return this.merge(left, right, store);
    }

    /**
     *
     * @param left
     * @param right
     * @param store
     */
    merge(left: string[], right: string[], store: any): string[] {
        const merged: string[] = [];
        let i = 0, j = 0;

        while (i < left.length && j < right.length) {
            const t1 = store.getObjects(namedNode(left[i]).id, namedNode('https://saref.etsi.org/core/hasTimestamp'));
            const t2 = store.getObjects(namedNode(right[j]).id, namedNode('https://saref.etsi.org/core/hasTimestamp'));

            if (t1 > t2) merged.push(left[i++]);
            else merged.push(right[j++]);
        }

        return merged.concat(left.slice(i)).concat(right.slice(j));
    }

    /**
     *
     * @param file_location
     */
    async load_dataset(file_location: string): Promise<typeof N3.Store> {
        const topic = path.basename(file_location);
        console.log(`Loading file: ${topic}`);

        return new Promise((resolve, reject) => {
            const parser = new N3.StreamParser();
            const stream = fs.createReadStream(file_location);
            const writer = this.stream_consumer.get_writer();

            parser.on('data', (quad: any) => writer.write(quad));
            parser.on('end', () => resolve(this.store));
            parser.on('error', reject);

            stream.pipe(parser);
        });
    }

    /**
     *
     */
    async replay_streams(): Promise<void> {
        await this.initialize();

        if (!this.store || this.sorted_observation_subjects.length === 0) {
            console.log('No observations to replay.');
            return;
        }

        const delay = 1000 / this.frequency;

        for (let i = 0; i < this.sorted_observation_subjects.length; i++) {
            await this.publish_one_observation();
            await this.sleep(delay);
        }

        console.log('All observations published.');
    }

    /**
     *
     * @param ms
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     *
     */
    private async publish_one_observation() {
        if (this.number_of_publish >= this.sort_subject_length) {
            console.log('No more observations to publish.');
            process.exit();
        }

        try {
            const id = this.sorted_observation_subjects[this.observation_pointer];
            const node = namedNode(id);

            // Remove old timestamp
            const old = this.store.getQuads(node, namedNode('https://saref.etsi.org/core/hasTimestamp'), null, null);
            this.store.removeQuads(old);

            // Add new timestamp
            const now = new Date().toISOString();
            this.store.addQuad(node, namedNode('https://saref.etsi.org/core/hasTimestamp'), literal(now));

            // Extract quads for this observation
            const quads = this.store.getQuads(node, null, null, null);
            const subStore = new N3.Store(quads);
            const data = await this.storeToString(subStore);

            if (data && data.trim() !== '') {
                this.mqtt_client.publish(this.topic_to_publish, data);

                console.log(`Published observation: ${id} at ${this.file_location}`);
                this.number_of_publish++;
                this.observation_pointer++;
            }
        } catch (error) {
            console.error('Error publishing observation:', error);
        }
    }

    /**
     *
     * @param store
     */
    private storeToString(store: any): Promise<string> {
        const writer = new N3.Writer();
        writer.addQuads(store.getQuads(null, null, null, null));

        return new Promise((resolve, reject) => {
            writer.end((err: any, result: string) => err ? reject(err) : resolve(result));
        });
    }
}
