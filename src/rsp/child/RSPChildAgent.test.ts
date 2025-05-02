import { RSPChildAgent } from "./RSPChildAgent";

describe("RSPChildAgent", () => {

    test("should create an instance of RSPChildAgent", () => {
        const query = "SELECT ?s WHERE { ?s ?p ?o }";
        const rstream_topic = "test_topic";
        const agent = new RSPChildAgent(query, rstream_topic);
        expect(agent).toBeInstanceOf(RSPChildAgent);
    });

    test("should set child_query and rstream_topic", () => {
        const query = "SELECT ?s WHERE { ?s ?p ?o }";
        const rstream_topic = "test_topic";
        const agent = new RSPChildAgent(query, rstream_topic);
        expect(agent.child_query).toBe(query);
        expect(agent.rstream_topic).toBe(rstream_topic);
    });

    test("should initialize RSPEngine", () => {
        const query = "SELECT ?s WHERE { ?s ?p ?o }";
        const rstream_topic = "test_topic";
        const agent = new RSPChildAgent(query, rstream_topic);
        expect(agent.rsp_engine).toBeDefined();
    });

    test("returnStreams should return streams", () => {

        const query = `
        PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT *
    FROM NAMED WINDOW :w1 ON STREAM :stream1 [RANGE 10 STEP 2]
    WHERE{
        WINDOW :w1 { ?s ?p ?o}
    }
        `;
        const rstream_topic = "test_topic";
        const agent = new RSPChildAgent(query, rstream_topic);
        const streams = agent.returnStreams();
        expect(streams).toStrictEqual(JSON.parse(`[{"slide": 2, "stream_name": "https://rsp.js/stream1", "width": 10, "window_name": "https://rsp.js/w1"}]`))
    });

    test("shouldReturn MQTT broker with a topic as a stream name", () => {
        const query = `
        PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX : <https://rsp.js/>
        REGISTER RStream <output> AS
        SELECT *
        FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:topic [RANGE 10 STEP 2]
        WHERE{
            WINDOW :w1 { ?s ?p ?o}
        }
        `;

        const rstream_topic = "rstream_topic";
        const agent = new RSPChildAgent(query, rstream_topic);
        const streams = agent.returnStreams();
        expect(streams).toStrictEqual(JSON.parse(`[{"slide": 2, "stream_name": "mqtt://localhost:1883/topic", "width": 10, "window_name": "https://rsp.js/w1"}]`));
    });

    test("should return MQTT broker URL", () => {
        const query = `
        PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX : <https://rsp.js/>
        REGISTER RStream <output> AS
        SELECT *
        FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:topic [RANGE 10 STEP 2]
        WHERE{
            WINDOW :w1 { ?s ?p ?o}
        }
        `;

        const rstream_topic = "rstream_topic";
        const agent = new RSPChildAgent(query, rstream_topic);
        expect(agent.returnMQTTBroker("mqtt://localhost:1883/topic")).toBe("mqtt://localhost:1883/");
    });

    test("should return MQTT broker URL for more than one topic hierarchy with slash semantics", () => {
        const query = `
        PREFIX mqtt_broker: <mqtt://localhost:1883/>
        PREFIX : <https://rsp.js/>
        REGISTER RStream <output> AS
        SELECT *
        FROM NAMED WINDOW :w1 ON STREAM mqtt_broker:topic [RANGE 10 STEP 2]
        WHERE{
            WINDOW :w1 { ?s ?p ?o}
        }
        `;

        const rstream_topic = "rstream_topic";
        const agent = new RSPChildAgent(query, rstream_topic);
        expect(agent.returnMQTTBroker("mqtt://localhost:1883/topic/random/sensor/room/temperature")).toBe("mqtt://localhost:1883/");
    });

});