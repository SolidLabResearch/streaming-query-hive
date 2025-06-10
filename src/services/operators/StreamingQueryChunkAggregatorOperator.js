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
exports.StreamingQueryChunkAggregatorOperator = void 0;
var RSPQLParser_1 = require("../../util/parser/RSPQLParser");
var hive_thought_rewriter_1 = require("hive-thought-rewriter");
var RSPQueryProcess_1 = require("../../rsp/RSPQueryProcess");
var Util_1 = require("../../util/Util");
var mqtt_1 = require("mqtt");
/**
 *
 */
var StreamingQueryChunkAggregatorOperator = /** @class */ (function () {
    /**
     *
     */
    function StreamingQueryChunkAggregatorOperator() {
        this.mqttBroker = 'mqtt://localhost:1883'; // Default MQTT broker URL, can be changed if needed
        this.subQueries = [];
        this.outputQuery = '';
        this.parser = new RSPQLParser_1.RSPQLParser();
        this.queryMQTTTopicMap = new Map();
        this.chunkGCD = 0;
    }
    /**
     *
     */
    StreamingQueryChunkAggregatorOperator.prototype.handleAggregation = function () {
        var _this = this;
        this.initializeSubQueryProcesses();
        console.log("SubQuery Processes initialized for aggregation.");
        if (this.subQueries.length === 0) {
            console.error("No subqueries available for aggregation.");
            return;
        }
        if (this.outputQuery === '') {
            console.error("Output query is not set for aggregation.");
            return;
        }
        if (this.chunkGCD <= 0) {
            console.error("Chunk GCD is not valid for aggregation.");
            return;
        }
        if (this.queryMQTTTopicMap.size === 0) {
            console.error("No MQTT topics mapped for subqueries.");
            return;
        }
        console.log("Starting aggregation of subqueries with GCD chunk size:", this.chunkGCD);
        var outputQueryParsed = this.parser.parse(this.outputQuery);
        if (!outputQueryParsed) {
            console.error("Failed to parse output query: ".concat(this.outputQuery));
            return;
        }
        var outputQueryWidth = outputQueryParsed.s2r[0].width;
        var outputQuerySlide = outputQueryParsed.s2r[0].slide;
        if (outputQueryWidth <= 0 || outputQuerySlide <= 0) {
            console.error("Invalid width or slide in output query: ".concat(this.outputQuery));
            return;
        }
        var rsp_client = mqtt_1["default"].connect(this.mqttBroker);
        rsp_client.on("connect", function () {
            console.log("Connected to MQTT broker at ".concat(_this.mqttBroker));
            // Store partial results per hash_subQuery
            var partialResults = new Map();
            // Calculate the chunk size for the output query based on the GCD
            var numbersOfChunksRequiredForOutputQuery = Math.ceil(outputQueryWidth / _this.chunkGCD);
            // Set of expected subqueries with topics
            var expectedSubQueries = new Set(_this.queryMQTTTopicMap.keys());
            // Mao to hold the final full data for each subquery after the chunks are received
            var finalResults = new Map();
            var _loop_1 = function (hash_subQuery, mqttTopic) {
                console.log("SubQuery ".concat(hash_subQuery, " is mapped to MQTT Topic ").concat(mqttTopic));
                rsp_client.subscribe("chunked/".concat(hash_subQuery), function (err) {
                    if (err) {
                        console.error("Failed to subscribe to output query topic: chunked/".concat(hash_subQuery), err);
                    }
                    else {
                        console.log("Subscribed to output query topic: chunked/".concat(hash_subQuery));
                    }
                });
                rsp_client.on("message", function (topic, message) { return __awaiter(_this, void 0, void 0, function () {
                    var hash_subQuery, payload, chunkArray, allCompleted, allResults, _i, _a, _b, subQueryHash, results;
                    var _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                hash_subQuery = topic.split("/")[1];
                                console.log("Received message for subquery ".concat(hash_subQuery, ":"), message.toString());
                                payload = JSON.parse(message.toString());
                                if (!partialResults.has(hash_subQuery)) {
                                    partialResults.set(hash_subQuery, []);
                                }
                                (_c = partialResults.get(hash_subQuery)) === null || _c === void 0 ? void 0 : _c.push(payload);
                                console.log("Partial results for subquery ".concat(hash_subQuery, ":"), partialResults.get(hash_subQuery));
                                chunkArray = partialResults.get(hash_subQuery);
                                if ((chunkArray === null || chunkArray === void 0 ? void 0 : chunkArray.length) === numbersOfChunksRequiredForOutputQuery) {
                                    console.log("Most of the chunks are received for subquery ".concat(hash_subQuery, ". Processing aggregation..."));
                                    finalResults.set(hash_subQuery, chunkArray);
                                    partialResults["delete"](hash_subQuery);
                                }
                                allCompleted = __spreadArray([], expectedSubQueries, true).every(function (queries) { return finalResults.has(queries); });
                                if (!allCompleted) return [3 /*break*/, 2];
                                console.log("All subqueries have completed. Aggregating final results...");
                                allResults = {};
                                for (_i = 0, _a = finalResults.entries(); _i < _a.length; _i++) {
                                    _b = _a[_i], subQueryHash = _b[0], results = _b[1];
                                    allResults[subQueryHash] = results;
                                }
                                return [4 /*yield*/, this.executeR2ROperator(allResults)];
                            case 1:
                                _d.sent();
                                finalResults.clear();
                                _d.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                }); });
            };
            for (var _i = 0, _a = _this.queryMQTTTopicMap.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], hash_subQuery = _b[0], mqttTopic = _b[1];
                _loop_1(hash_subQuery, mqttTopic);
            }
        });
    };
    StreamingQueryChunkAggregatorOperator.prototype.executeR2ROperator = function (allResults) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log("Executing the R2R Operator with results:", allResults);
                return [2 /*return*/];
            });
        });
    };
    StreamingQueryChunkAggregatorOperator.prototype.initializeSubQueryProcesses = function () {
        return __awaiter(this, void 0, void 0, function () {
            var chunkSize, rewrittenChunkQueries, rewriteChunkQuery, i, subQuery, rewrittenQuery, _loop_2, this_1, i;
            return __generator(this, function (_a) {
                chunkSize = this.findGCDChunk(this.subQueries, this.outputQuery);
                console.log("Calculated GCD Chunk Size: ".concat(chunkSize));
                this.chunkGCD = chunkSize;
                rewrittenChunkQueries = [];
                if (chunkSize > 0) {
                    rewriteChunkQuery = new hive_thought_rewriter_1.RewriteChunkQuery(chunkSize, chunkSize);
                    for (i = 0; i < this.subQueries.length; i++) {
                        subQuery = this.subQueries[i];
                        rewrittenQuery = rewriteChunkQuery.rewriteQueryWithNewChunkSize(subQuery);
                        console.log("Rewritten SubQuery ".concat(i, ": ").concat(rewrittenQuery));
                        rewrittenChunkQueries.push(rewrittenQuery);
                    }
                    _loop_2 = function (i) {
                        // Starting a RSP Query Process for each subwritten query
                        // which will be combined to create the final output query
                        var hash_subQuery = (0, Util_1.hash_string_md5)(rewrittenChunkQueries[i]);
                        this_1.queryMQTTTopicMap.set(hash_subQuery, "chunked/".concat(hash_subQuery));
                        var rspQueryProcess = new RSPQueryProcess_1.RSPQueryProcess(rewrittenChunkQueries[i], this_1.queryMQTTTopicMap.get(hash_subQuery));
                        rspQueryProcess.stream_process().then(function () {
                            console.log("RSP Query Process started for subquery ".concat(i, ": ").concat(rewrittenChunkQueries[i]));
                        })["catch"](function (error) {
                            console.error("Error starting RSP Query Process for subquery ".concat(i, ": ").concat(rewrittenChunkQueries[i]), error);
                        });
                    };
                    this_1 = this;
                    for (i = 0; i < rewrittenChunkQueries.length; i++) {
                        _loop_2(i);
                    }
                }
                else {
                    console.error("Failed to find a valid chunk size for the aggregation.");
                }
                return [2 /*return*/];
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
    };
    /**
     *
     */
    StreamingQueryChunkAggregatorOperator.prototype.getOutputQuery = function () {
        return this.outputQuery;
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
    return StreamingQueryChunkAggregatorOperator;
}());
exports.StreamingQueryChunkAggregatorOperator = StreamingQueryChunkAggregatorOperator;
