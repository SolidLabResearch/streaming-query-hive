import { RSPEngine, RSPQLParser } from "rsp-js";
import { EventEmitter } from "events";
const mqtt = require('mqtt');

export class RSPParentAgent {
    public parent_query: string;
    public rstream_topic: string;
    public rsp_engine: RSPEngine;
    public rstream_emitter: EventEmitter;
    public rspql_parser: RSPQLParser = new RSPQLParser();

    constructor(query: string, rstream_topic: string) {
        this.parent_query = query;
        this.rstream_topic = rstream_topic;
        this.rsp_engine = new RSPEngine(query);
        this.rstream_emitter = this.rsp_engine.register();
        this.subscribeRStream();
    }


    public async process_child_rstreams(rstream_topics: string[]) {
        const mqtt_broker = 'mqtt://localhost:1883/';
        const rsp_client = mqtt.connect(mqtt_broker)

        rsp_client.on("connect", () => {
            console.log(`Connected to the MQTT broker at ${mqtt_broker}`);
            for (let topic of rstream_topics) {
                rsp_client.subscribe(topic, (error: any) => {
                    if (error) {
                        console.log(`Failed to subscribe to the topic ${topic}`, error);
                    }
                    else {
                        console.log(`Subscribed to the topic ${topic}`);
                    }
                })
            }
        });


        rsp_client.on("message", async (topic: any, message: any) => {
            try {
                const message_string = message.toString();
                const topic_where_posted = topic;
                console.log(topic_where_posted, message_string);
                
            } catch (error) {

            }
        })

    }

    public async subscribeRStream() {
        const mqtt_broker = 'mqtt://localhost:1833/';
        const rstream_publisher = mqtt.connect(mqtt_broker);

    }

}