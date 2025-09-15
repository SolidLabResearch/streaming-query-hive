"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.RSPAgent = void 0;
var rsp_js_1 = require("rsp-js");
var hive_thought_rewriter_1 = require("hive-thought-rewriter");
var DataFactory = require("n3").DataFactory;
var uuid_1 = require("uuid");
var Util_1 = require("../util/Util");
var mqtt = require('mqtt');
/**
 *
 */
var RSPAgent = /** @class */ (function () {
    /**
     *
     * @param query
     * @param r2s_topic
     */
    function RSPAgent(query, r2s_topic) {
        this.query = query;
        this.r2s_topic = r2s_topic;
        this.rspql_parser = new hive_thought_rewriter_1.RSPQLParser();
        this.rsp_engine = new rsp_js_1.RSPEngine(query);
        this.rstream_emitter = this.rsp_engine.register();
        this.http_server_location = "http://localhost:8080/";
        this.registerToQueryRegistry();
        this.subscribeRStream();
    }
    /**
     *
     */
    RSPAgent.prototype.registerToQueryRegistry = function () {
        return __awaiter(this, void 0, void 0, function () {
            var register_location, request, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Registering query: ".concat(this.query, " to the query registry."));
                        register_location = "".concat(this.http_server_location, "register");
                        return [4 /*yield*/, fetch(register_location, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    rspql_query: this.query,
                                    r2s_topic: this.r2s_topic,
                                    data_topic: this.r2s_topic,
                                    id: (0, Util_1.hash_string_md5)(this.query)
                                })
                            })];
                    case 1:
                        request = _a.sent();
                        if (!request.ok) {
                            throw new Error("Failed to register query: ".concat(this.query, ". Status: ").concat(request.status));
                        }
                        return [4 /*yield*/, request.json()];
                    case 2:
                        response = _a.sent();
                        if (response.error) {
                            throw new Error("Error registering query: ".concat(response.error));
                        }
                        console.log("Successfully registered query: ".concat(this.query));
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     *
     */
    RSPAgent.prototype.process_streams = function () {
        return __awaiter(this, void 0, void 0, function () {
            var streams, _loop_1, this_1, _i, streams_1, stream;
            var _this = this;
            return __generator(this, function (_a) {
                streams = this.returnStreams();
                _loop_1 = function (stream) {
                    var stream_name = stream.stream_name;
                    var mqtt_broker = this_1.returnMQTTBroker(stream_name);
                    var rsp_client = mqtt.connect(mqtt_broker);
                    var rsp_stream_object = this_1.rsp_engine.getStream(stream_name);
                    var topic = new URL(stream_name).pathname.slice(1);
                    rsp_client.on("connect", function () {
                        console.log("Connected to MQTT broker at ".concat(mqtt_broker));
                        rsp_client.subscribe(topic, function (err) {
                            if (err) {
                                console.error("Failed to subscribe to stream ".concat(stream_name, ":"), err);
                            }
                            else {
                                console.log("Subscribed to stream ".concat(stream_name));
                            }
                        });
                    });
                    rsp_client.on("message", function (topic, message) { return __awaiter(_this, void 0, void 0, function () {
                        var message_string, latest_event_store, timestamp, timestamp_epoch, error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    message_string = message.toString();
                                    return [4 /*yield*/, (0, Util_1.turtleStringToStore)(message_string)];
                                case 1:
                                    latest_event_store = _a.sent();
                                    timestamp = latest_event_store.getQuads(null, DataFactory.namedNode("https://saref.etsi.org/core/hasTimestamp"), null, null)[0].object.value;
                                    timestamp_epoch = Date.parse(timestamp);
                                    if (!rsp_stream_object) return [3 /*break*/, 3];
                                    return [4 /*yield*/, this.add_event_store_to_rsp_engine(latest_event_store, [rsp_stream_object], timestamp_epoch)];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3: return [3 /*break*/, 5];
                                case 4:
                                    error_1 = _a.sent();
                                    console.error("Error processing message from stream ".concat(stream_name, ":"), error_1);
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    rsp_client.on("error", function (error) {
                        console.error("Error with MQTT client for stream ".concat(stream_name, ":"), error);
                    });
                };
                this_1 = this;
                for (_i = 0, streams_1 = streams; _i < streams_1.length; _i++) {
                    stream = streams_1[_i];
                    _loop_1(stream);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     *
     * @param stream_name
     */
    RSPAgent.prototype.returnMQTTBroker = function (stream_name) {
        var url = new URL(stream_name);
        return "".concat(url.protocol, "//").concat(url.hostname, ":").concat(url.port, "/");
    };
    /**
     *
     */
    RSPAgent.prototype.returnStreams = function () {
        var parsed_query = this.rspql_parser.parse(this.query);
        var streams = __spreadArray([], parsed_query.s2r, true);
        return streams;
    };
    /**
     *
     */
    RSPAgent.prototype.subscribeRStream = function () {
        return __awaiter(this, void 0, void 0, function () {
            var mqtt_broker, rstream_publisher, query_hash;
            var _this = this;
            return __generator(this, function (_a) {
                mqtt_broker = "mqtt://localhost:1883";
                rstream_publisher = mqtt.connect(mqtt_broker);
                query_hash = (0, Util_1.hash_string_md5)(this.query);
                rstream_publisher.on("connect", function () {
                    console.log("Connected to MQTT broker for publishing");
                    _this.rstream_emitter.on("RStream", function (object) { return __awaiter(_this, void 0, void 0, function () {
                        var iterables, _i, iterables_1, item, aggregation_event_timestamp, data;
                        return __generator(this, function (_a) {
                            if (!object || !object.bindings) {
                                console.log("No bindings found in the RStream object.");
                                return [2 /*return*/];
                            }
                            iterables = object.bindings.values();
                            for (_i = 0, iterables_1 = iterables; _i < iterables_1.length; _i++) {
                                item = iterables_1[_i];
                                aggregation_event_timestamp = new Date().getTime();
                                data = item.value;
                                console.log("Binding data received:", data);
                                rstream_publisher.publish(this.r2s_topic, data);
                            }
                            return [2 /*return*/];
                        });
                    }); });
                });
                rstream_publisher.on("error", function (err) {
                    console.error("MQTT publisher error:", err);
                });
                return [2 /*return*/];
            });
        });
    };
    /**
     *
     * @param data
     * @param timestamp
     */
    RSPAgent.prototype.generate_aggregation_event = function (data, timestamp) {
        var uuid_random = (0, uuid_1.v4)();
        var aggregation_event = "\n    <https://rsp.js/aggregation_event/".concat(uuid_random, "> <https://saref.etsi.org/core/hasValue> \"").concat(data, "\"^^<http://www.w3.org/2001/XMLSchema#float> .\n    ");
        return aggregation_event.trim();
    };
    /**
     *
     * @param event_store
     * @param stream_name
     * @param timestamp
     */
    RSPAgent.prototype.add_event_store_to_rsp_engine = function (event_store, stream_name, timestamp) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                stream_name.forEach(function (stream) { return __awaiter(_this, void 0, void 0, function () {
                    var quads, _i, quads_1, quad, quadWithGraph;
                    return __generator(this, function (_a) {
                        quads = event_store.getQuads(null, null, null, null);
                        for (_i = 0, quads_1 = quads; _i < quads_1.length; _i++) {
                            quad = quads_1[_i];
                            quadWithGraph = DataFactory.quad(quad.subject, quad.predicate, quad.object, DataFactory.namedNode(stream_name));
                            stream.add(quadWithGraph, timestamp);
                        }
                        return [2 /*return*/];
                    });
                }); });
                return [2 /*return*/];
            });
        });
    };
    return RSPAgent;
}());
exports.RSPAgent = RSPAgent;
