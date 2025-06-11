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
        while (_) try {
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
exports.__esModule = true;
exports.StreamingQueryChunkAggregatorOperator = void 0;
var rsp_js_1 = require("rsp-js");
var hive_thought_rewriter_1 = require("hive-thought-rewriter");
var RSPQueryProcess_1 = require("../../rsp/RSPQueryProcess");
var Util_1 = require("../../util/Util");
var r2r_1 = require("../operators/r2r");
var mqtt_1 = require("mqtt");
var N3 = require('n3');
/**
 *
 */
var StreamingQueryChunkAggregatorOperator = /** @class */ (function () {
    /**
     *
     */
    function StreamingQueryChunkAggregatorOperator(outputQuery) {
        this.subQueryMQTTTopicMap = new Map();
        this.mqttBroker = 'mqtt://localhost:1883'; // Default MQTT broker URL, can be changed if needed
        this.subQueries = [];
        this.parser = new rsp_js_1.RSPQLParser();
        this.chunkGCD = 0;
        this.outputQuery = outputQuery;
    }
    StreamingQueryChunkAggregatorOperator.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("init() called");
                        return [4 /*yield*/, this.setMQTTTopicMap()];
                    case 1:
                        _a.sent();
                        console.log("StreamingQueryChunkAggregatorOperator initialized.");
                        return [2 /*return*/];
                }
            });
        });
    };
    StreamingQueryChunkAggregatorOperator.prototype.setMQTTTopicMap = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, _i, _a, _b, queryHash, mqttTopic;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        console.log("setMQTTTopicMap() called");
                        this.queryMQTTTopicMap = new Map();
                        console.log("MQTT Topic Map set for subqueries:", this.queryMQTTTopicMap);
                        return [4 /*yield*/, fetch("http://localhost:8080/fetchQueries")];
                    case 1:
                        response = _c.sent();
                        if (!response.ok) {
                            console.error("Failed to fetch queries from the server.");
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _c.sent();
                        console.log("Fetched data from server:", data);
                        for (_i = 0, _a = Object.entries(data); _i < _a.length; _i++) {
                            _b = _a[_i], queryHash = _b[0], mqttTopic = _b[1];
                            this.queryMQTTTopicMap.set(queryHash, mqttTopic);
                            console.log("Subquery ".concat(queryHash, " mapped to MQTT Topic ").concat(mqttTopic));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     *
     */
    StreamingQueryChunkAggregatorOperator.prototype.handleAggregation = function () {
        return __awaiter(this, void 0, void 0, function () {
            var outputQueryParsed, outputQueryWidth, outputQuerySlide, rsp_client, that;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Starting aggregation process for subqueries.");
                        return [4 /*yield*/, this.initializeSubQueryProcesses()];
                    case 1:
                        _a.sent();
                        console.log("SubQuery Processes initialized for aggregation.");
                        if (this.subQueries.length === 0) {
                            console.error("No subqueries available for aggregation.");
                            return [2 /*return*/];
                        }
                        if (this.outputQuery === '') {
                            console.error("Output query is not set for aggregation.");
                            return [2 /*return*/];
                        }
                        if (this.chunkGCD <= 0) {
                            console.error("Chunk GCD is not valid for aggregation.");
                            return [2 /*return*/];
                        }
                        if (this.queryMQTTTopicMap.size === 0) {
                            console.error("No MQTT topics mapped for subqueries.");
                            return [2 /*return*/];
                        }
                        console.log("Starting aggregation of subqueries with GCD chunk size:", this.chunkGCD);
                        if (!this.outputQuery) {
                            console.error("Output query is not set or is undefined.");
                            return [2 /*return*/];
                        }
                        outputQueryParsed = this.parser.parse(this.outputQuery);
                        if (!outputQueryParsed) {
                            console.error("Failed to parse output query: ".concat(this.outputQuery));
                            return [2 /*return*/];
                        }
                        outputQueryWidth = outputQueryParsed.s2r[0].width;
                        outputQuerySlide = outputQueryParsed.s2r[0].slide;
                        if (outputQueryWidth <= 0 || outputQuerySlide <= 0) {
                            console.error("Invalid width or slide in output query: ".concat(this.outputQuery));
                            return [2 /*return*/];
                        }
                        rsp_client = mqtt_1["default"].connect(this.mqttBroker);
                        console.log("Connecting to MQTT broker at ".concat(this.mqttBroker, "..."));
                        rsp_client.on("error", function (err) {
                            console.error("MQTT connection error:", err);
                        });
                        rsp_client.on("offline", function () {
                            console.error("MQTT client is offline. Please check the broker connection.");
                        });
                        rsp_client.on("reconnect", function () {
                            console.log("Reconnecting to MQTT broker...");
                        });
                        that = this;
                        rsp_client.on("connect", function () {
                            var topics = Array.from(that.subQueryMQTTTopicMap.values());
                            console.log("topics to subscribe:", topics);
                            var topicsOfProcesses = [];
                            topicsOfProcesses = topics;
                            console.log('DEBUG: topicsOfProcesses after loop:', topicsOfProcesses, 'length:', topicsOfProcesses.length);
                            if (topicsOfProcesses.length === 0) {
                                console.error('No valid MQTT topics to subscribe to. Please check the subQueryMQTTTopicMap.');
                                return;
                            }
                            var _loop_1 = function (mqttTopic) {
                                rsp_client.subscribe("".concat(mqttTopic), function (err) {
                                    if (err) {
                                        console.error("Failed to subscribe to topic ".concat(mqttTopic, ":"), err);
                                    }
                                    else {
                                        console.log("Subscribed to topic: ".concat(mqttTopic));
                                    }
                                });
                            };
                            for (var _i = 0, topicsOfProcesses_1 = topicsOfProcesses; _i < topicsOfProcesses_1.length; _i++) {
                                var mqttTopic = topicsOfProcesses_1[_i];
                                _loop_1(mqttTopic);
                            }
                            // Data structure to collect all chunks
                            var allChunks = [];
                            var chunksRequired = Math.ceil(outputQueryWidth / _this.chunkGCD) * _this.subQueries.length;
                            console.log("Chunks required for aggregation: ".concat(chunksRequired));
                            console.log("Output Query Width: ".concat(outputQueryWidth, ", Chunk GCD: ").concat(_this.chunkGCD, ", SubQueries Length: ").concat(_this.subQueries.length));
                            rsp_client.on("message", function (topic, message) {
                                allChunks.push(message.toString());
                            });
                            // Run aggregation every this.chunkGCD milliseconds
                            setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(allChunks.length > 0)) return [3 /*break*/, 2];
                                            console.log("Interval reached. Aggregating and triggering R2R...");
                                            return [4 /*yield*/, this.executeR2ROperator(allChunks)];
                                        case 1:
                                            _a.sent();
                                            allChunks = [];
                                            return [3 /*break*/, 3];
                                        case 2:
                                            console.log("Interval reached, but no chunks to aggregate.");
                                            _a.label = 3;
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }, outputQuerySlide);
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    StreamingQueryChunkAggregatorOperator.prototype.executeR2ROperator = function (chunks) {
        return __awaiter(this, void 0, void 0, function () {
            var resultString, store, parser, quads, detectAggregationFunction, aggregationSPARQLQuery, r2rOperator, bindingStream;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Executing the R2R Operator with results:", chunks);
                        resultString = chunks.map(function (chunk) { return JSON.parse(chunk); }).join('\n');
                        store = new N3.Store();
                        try {
                            parser = new N3.Parser();
                            quads = parser.parse(resultString);
                            store.addQuads(quads); // add all quads to store
                        }
                        catch (e) {
                            console.error("Failed to parse combined Turtle string:", e);
                        }
                        detectAggregationFunction = this.detectAggregationFunction(this.outputQuery);
                        if (!detectAggregationFunction) {
                            console.error("No aggregation function detected in the output query.");
                            return [2 /*return*/];
                        }
                        aggregationSPARQLQuery = this.getAggregationSPARQLQuery(detectAggregationFunction, 'o');
                        if (!aggregationSPARQLQuery) {
                            console.error("Failed to generate aggregation SPARQL query.");
                            return [2 /*return*/];
                        }
                        console.log("Generated Aggregation SPARQL Query:", aggregationSPARQLQuery);
                        r2rOperator = new r2r_1.R2ROperator(aggregationSPARQLQuery);
                        return [4 /*yield*/, r2rOperator.execute(store)];
                    case 1:
                        bindingStream = _a.sent();
                        if (!bindingStream) {
                            console.error("Failed to execute R2R Operator.");
                            return [2 /*return*/];
                        }
                        bindingStream.on('data', function (data) {
                            console.log("R2R Operator Data Received:", data);
                            var outputQueryEvent = _this.generateOutputQueryEvent(data.get('result').value);
                            console.log("Generated Output Query Event:", outputQueryEvent);
                            // Publish the output query event to the MQTT broker
                            var rsp_client = mqtt_1["default"].connect(_this.mqttBroker);
                            rsp_client.on("connect", function () {
                                var outputTopic = "output";
                                rsp_client.publish(outputTopic, outputQueryEvent, function (err) {
                                    if (err) {
                                        console.error("Error publishing output query event to topic ".concat(outputTopic, ":"), err);
                                    }
                                    else {
                                        console.log("Output query event published to topic ".concat(outputTopic));
                                    }
                                });
                            });
                            rsp_client.on("error", function (err) {
                                console.error("MQTT connection error:", err);
                            });
                            rsp_client.on("offline", function () {
                                console.error("MQTT client is offline. Please check the broker connection.");
                            });
                            rsp_client.on("reconnect", function () {
                                console.log("Reconnecting to MQTT broker...");
                            });
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    StreamingQueryChunkAggregatorOperator.prototype.generateOutputQueryEvent = function (data) {
        var uuid_random = uuidv4();
        return " <https://rsp.js/outputQueryEvent/".concat(uuid_random, "> <https://saref.etsi.org/core/hasValue> \"").concat(data, "\"^^<http://www.w3.org/2001/XMLSchema#float> .");
    };
    StreamingQueryChunkAggregatorOperator.prototype.initializeSubQueryProcesses = function () {
        return __awaiter(this, void 0, void 0, function () {
            var chunkSize, rewrittenChunkQueries, rewriteChunkQuery, i, subQuery, rewrittenQuery, allPromises, _loop_2, this_1, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Initializing subquery processes.");
                        chunkSize = this.findGCDChunk(this.subQueries, this.outputQuery);
                        console.log("Calculated GCD Chunk Size: ".concat(chunkSize));
                        this.chunkGCD = chunkSize;
                        rewrittenChunkQueries = [];
                        if (!(chunkSize > 0)) return [3 /*break*/, 2];
                        rewriteChunkQuery = new hive_thought_rewriter_1.RewriteChunkQuery(chunkSize, chunkSize);
                        for (i = 0; i < this.subQueries.length; i++) {
                            subQuery = this.subQueries[i];
                            rewrittenQuery = rewriteChunkQuery.rewriteQueryWithNewChunkSize(subQuery);
                            console.log("Rewritten SubQuery ".concat(i, ": ").concat(rewrittenQuery));
                            rewrittenChunkQueries.push(rewrittenQuery);
                        }
                        allPromises = [];
                        _loop_2 = function (i) {
                            var hash_subQuery = (0, Util_1.hash_string_md5)(rewrittenChunkQueries[i]);
                            this_1.subQueryMQTTTopicMap.set(hash_subQuery, "chunked/".concat(hash_subQuery));
                            var rspQueryProcess = new RSPQueryProcess_1.RSPQueryProcess(rewrittenChunkQueries[i], "chunked/".concat(hash_subQuery));
                            console.log("chunked/".concat(hash_subQuery, " topic created for rewrittenChunkQueries: ").concat(rewrittenChunkQueries[i], ": ").concat(rewrittenChunkQueries[i]));
                            var p = rspQueryProcess.stream_process().then(function () {
                                console.log("Topic chunked/".concat(hash_subQuery, " created for subquery ").concat(i));
                                console.log("RSP Query Process started for subquery ".concat(i, ": ").concat(rewrittenChunkQueries[i]));
                            })["catch"](function (error) {
                                console.error("Error starting RSP Query Process for subquery ".concat(i, ": ").concat(rewrittenChunkQueries[i]), error);
                            });
                            allPromises.push(p);
                        };
                        this_1 = this;
                        for (i = 0; i < rewrittenChunkQueries.length; i++) {
                            _loop_2(i);
                        }
                        // Wait for all subquery processes to finish initializing
                        return [4 /*yield*/, Promise.all(allPromises)];
                    case 1:
                        // Wait for all subquery processes to finish initializing
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        console.error("Failed to find a valid chunk size for the aggregation.");
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     *
     * @param subQueries
     * @param outputQuery
     */
    StreamingQueryChunkAggregatorOperator.prototype.findGCDChunk = function (subQueries, outputQuery) {
        var window_parameters = [];
        for (var i = 0; i < subQueries.length; i++) {
            var subQueryParsed = this.parser.parse(subQueries[i]);
            console.log("Parsed subquery ".concat(i, ": ").concat(JSON.stringify(subQueryParsed)));
            if (subQueryParsed) {
                for (var _i = 0, _a = subQueryParsed.s2r; _i < _a.length; _i++) {
                    var s2r = _a[_i];
                    window_parameters.push(s2r.width);
                    window_parameters.push(s2r.slide);
                }
            }
            else {
                console.error("Failed to parse subquery: ".concat(subQueries[i]));
            }
        }
        var outputQueryParsed = this.parser.parse(outputQuery);
        console.log("Parsed output query: ".concat(JSON.stringify(outputQueryParsed)));
        if (outputQueryParsed) {
            for (var _b = 0, _c = outputQueryParsed.s2r; _b < _c.length; _b++) {
                var s2r = _c[_b];
                window_parameters.push(s2r.width);
                window_parameters.push(s2r.slide);
            }
        }
        else {
            console.error("Failed to parse output query: ".concat(outputQuery));
        }
        // Find the GCD of the window parameters
        return this.findGCD(window_parameters);
    };
    /**
     *
     * @param arr
     */
    StreamingQueryChunkAggregatorOperator.prototype.findGCD = function (arr) {
        if (arr.length === 0) {
            return 1;
        }
        var gcd = function (a, b) {
            return b === 0 ? a : gcd(b, a % b);
        };
        return arr.reduce(function (acc, val) { return gcd(acc, val); }, arr[0]);
    };
    /**
     *
     * @param arr
     */
    StreamingQueryChunkAggregatorOperator.prototype.findLCM = function (arr) {
        var _this = this;
        var lcm = function (a, b) {
            return (a * b) / _this.findGCD([a, b]);
        };
        return arr.reduce(function (acc, val) { return lcm(acc, val); }, 1);
    };
    /**
     *
     * @param query
     */
    StreamingQueryChunkAggregatorOperator.prototype.addSubQuery = function (query) {
        this.subQueries.push(query);
    };
    /**
     *
     * @param query
     */
    StreamingQueryChunkAggregatorOperator.prototype.setOutputQuery = function (query) {
        this.outputQuery = query;
        console.log("Output query set: ".concat(this.outputQuery));
        if (this.outputQuery === '') {
            console.error("Output query is empty. Please set a valid output query.");
        }
    };
    /**
     *
     */
    StreamingQueryChunkAggregatorOperator.prototype.getOutputQuery = function () {
        var _a;
        return (_a = this.outputQuery) !== null && _a !== void 0 ? _a : "";
    };
    /**
     *
     */
    StreamingQueryChunkAggregatorOperator.prototype.getSubQueries = function () {
        return this.subQueries;
    };
    /**
     *
     */
    StreamingQueryChunkAggregatorOperator.prototype.clearSubQueries = function () {
        this.subQueries = [];
    };
    StreamingQueryChunkAggregatorOperator.prototype.detectAggregationFunction = function (query) {
        var aggregationFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
        for (var _i = 0, aggregationFunctions_1 = aggregationFunctions; _i < aggregationFunctions_1.length; _i++) {
            var func = aggregationFunctions_1[_i];
            if (query.includes(func)) {
                return func;
            }
        }
        return null;
    };
    StreamingQueryChunkAggregatorOperator.prototype.getAggregationSPARQLQuery = function (aggregationFunction, variable) {
        var allowedFunctions = ['AVG', 'SUM', 'COUNT', 'MIN', 'MAX'];
        if (!aggregationFunction || !variable) {
            console.error("Missing aggregation function or variable.");
            return '';
        }
        aggregationFunction = aggregationFunction.toUpperCase();
        if (!allowedFunctions.includes(aggregationFunction)) {
            console.error("Invalid aggregation function.");
            return '';
        }
        if (!variable.startsWith('?')) {
            variable = '?' + variable;
        }
        return "SELECT (".concat(aggregationFunction, "(").concat(variable, ") AS ?result) WHERE { ?s ?p ").concat(variable, " }");
    };
    StreamingQueryChunkAggregatorOperator.prototype.sleep = function (ms) {
        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
    };
    return StreamingQueryChunkAggregatorOperator;
}());
exports.StreamingQueryChunkAggregatorOperator = StreamingQueryChunkAggregatorOperator;
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
