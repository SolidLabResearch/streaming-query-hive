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
exports.BeeWorker = void 0;
var rspql_containment_checker_1 = require("rspql-containment-checker");
var hive_thought_rewriter_1 = require("hive-thought-rewriter");
var StreamingQueryChunkAggregatorOperator_1 = require("./operators/StreamingQueryChunkAggregatorOperator");
var Util_1 = require("../util/Util");
/**
 */
var BeeWorker = /** @class */ (function () {
    /**
     *
     */
    function BeeWorker() {
        this.interval = null;
        this.containmentChecker = new rspql_containment_checker_1.ContainmentChecker();
        this.queryCombiner = new hive_thought_rewriter_1.QueryCombiner();
        var query = process.env.QUERY;
        var r2s_topic = process.env.TOPIC;
        if (!query || !r2s_topic) {
            console.error("Missing the Query or the R2S topic where the results should be published.");
            process.exit(1);
        }
        this.query = query;
        this.r2s_topic = r2s_topic;
        console.log("Started a Bee Worker for the Query");
        // this.processAgentStreams();
        this.process();
    }
    BeeWorker.prototype.process = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fetchLocation, executingQueries, rspql_queries, parsed_queries, _i, _a, _b, id, rspql_query, streamingQueryChunkAggregatorOperator, query1, query2, query3;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        console.log("this.process() called with query: ".concat(this.query));
                        fetchLocation = "http://localhost:8080/fetchQueries";
                        return [4 /*yield*/, this.fetchExistingQueries(fetchLocation)];
                    case 1:
                        executingQueries = _c.sent();
                        rspql_queries = [];
                        console.log("Executing Queries: ".concat(executingQueries));
                        parsed_queries = JSON.parse(executingQueries);
                        if (!parsed_queries || Object.keys(parsed_queries).length === 0) {
                            console.error("No executing queries found or the fetch operation failed.");
                            return [2 /*return*/];
                        }
                        for (_i = 0, _a = Object.entries(parsed_queries); _i < _a.length; _i++) {
                            _b = _a[_i], id = _b[0], rspql_query = _b[1];
                            console.log("Found executing query with ID: ".concat(id));
                            if (typeof rspql_query === "string") {
                                rspql_queries.push(rspql_query);
                                console.log("RSPQL Query: ".concat(rspql_query));
                            }
                            else {
                                console.warn("Skipping non-string rspql_query for ID: ".concat(id));
                            }
                        }
                        console.log("Executing Queries: ".concat(executingQueries));
                        if (!executingQueries) {
                            console.error("No executing queries found or the fetch operation failed.");
                            return [2 /*return*/];
                        }
                        streamingQueryChunkAggregatorOperator = new StreamingQueryChunkAggregatorOperator_1.StreamingQueryChunkAggregatorOperator(this.query);
                        query1 = "\n            PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o) AS ?avgX)\nFROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 60000 STEP 60000]\nWHERE {\n    WINDOW :w1 {\n        ?s saref:hasValue ?o .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .\n    }\n}\n    ";
                        query2 = "\n                PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o) AS ?avgY)\nFROM NAMED WINDOW :w2 ON STREAM mqtt_broker:accY [RANGE 60000 STEP 60000]\nWHERE {\n    WINDOW :w2 {\n        ?s saref:hasValue ?o .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .\n    }\n}";
                        query3 = "\n                    PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o3) AS ?avgZ)\nFROM NAMED WINDOW :w3 ON STREAM mqtt_broker:accZ [RANGE 60000 STEP 60000]\nWHERE {\n    WINDOW :w3 {\n        ?s saref:hasValue ?o3 .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.z .\n    }\n}\n    ";
                        streamingQueryChunkAggregatorOperator.addSubQuery(query1);
                        streamingQueryChunkAggregatorOperator.addSubQuery(query2);
                        streamingQueryChunkAggregatorOperator.addSubQuery(query3);
                        console.log("About to call init()");
                        return [4 /*yield*/, streamingQueryChunkAggregatorOperator.init()];
                    case 2:
                        _c.sent();
                        streamingQueryChunkAggregatorOperator.handleAggregation();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     *
     */
    BeeWorker.prototype.processAgentStreams = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fetchLocation, executingQueries, rspql_queries, parsed_queries, _i, _a, _b, id, rspql_query, containedQueries, registeredQuery;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        console.log("Finding if there are existing queries with RSP Agents being processed which are contained in the query of the Bee Worker");
                        fetchLocation = "http://localhost:8080/fetchQueries";
                        return [4 /*yield*/, this.fetchExistingQueries(fetchLocation)];
                    case 1:
                        executingQueries = _c.sent();
                        rspql_queries = [];
                        console.log("Executing Queries: ".concat(executingQueries));
                        parsed_queries = JSON.parse(executingQueries);
                        if (!parsed_queries || Object.keys(parsed_queries).length === 0) {
                            console.error("No executing queries found or the fetch operation failed.");
                            return [2 /*return*/];
                        }
                        for (_i = 0, _a = Object.entries(parsed_queries); _i < _a.length; _i++) {
                            _b = _a[_i], id = _b[0], rspql_query = _b[1];
                            console.log("Found executing query with ID: ".concat(id));
                            if (typeof rspql_query === "string") {
                                rspql_queries.push(rspql_query);
                                console.log("RSPQL Query: ".concat(rspql_query));
                            }
                            else {
                                console.warn("Skipping non-string rspql_query for ID: ".concat(id));
                            }
                        }
                        console.log("Executing Queries: ".concat(executingQueries));
                        if (!executingQueries) {
                            console.error("No executing queries found or the fetch operation failed.");
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.findContainedQueries(rspql_queries, this.query)];
                    case 2:
                        containedQueries = _c.sent();
                        if (containedQueries) {
                            // Check which queries can be reused
                            // Rewriting and combining the queries
                            // for (const [id, rspql_query] of containedQueries) {
                            //     this.queryCombiner.addQuery(rspql_query);
                            // }
                            // const combined_query = this.queryCombiner.combine();
                            // const combined_query_string = combined_query.toString();
                            // Now we have a combined query that can be used to process the streams
                            // Time to do a completeness and soundness check
                            // const is_complete = await this.completenessCheck(combined_query_string, this.query);
                            // const is_sound = await this.soundnessCheck(combined_query_string, this.query);
                            // if (is_complete && is_sound) {
                            console.log('The combined query is complete and sound');
                            registeredQuery = "\n                PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o) AS ?avgX) (AVG(?o) AS ?avgY)\nFROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 120000 STEP 30000]\nFROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accY [RANGE 120000 STEP 30000]\nWHERE {\n    WINDOW :w1 {\n        ?s saref:hasValue ?o .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .\n    }\n    UNION\n    WINDOW :w1 {\n        ?s saref:hasValue ?o .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .\n    }\n}\n    ";
                            // this.streamingQueryChunkAggregatorOperator.setOutputQuery(combined_query_string);
                            // streamingQueryChunkAggregatorOperator.setOutputQuery(registeredQuery);            // Handle the case where the combined query is complete and sound
                            // this.streamingQueryChunkAggregatorOperator.init();
                            // This means that the Bee Worker can start processing the combined query
                            // and reuse the existing queries from the RSP Agents
                            // console.log(`Combined Query: ${combined_query_string}`);
                            // }
                            // else {
                            // console.log('There was partial containment of the queries, however the combined query is not complete or sound');
                            // Handle the case where the combined query is not complete or sound
                            // }
                        }
                        else {
                            console.log("There are no existing queries by the RSP Agents that are contained in the query of the Bee Worker");
                            // Handle the case where there are no contained queries 
                            // Therefore the Bee Worker can start processing the entire query by itself rather than reusing the existing queries
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     *
     * @param fetchLocation
     */
    BeeWorker.prototype.fetchExistingQueries = function (fetchLocation) {
        return __awaiter(this, void 0, void 0, function () {
            var response, executingQueries;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch(fetchLocation, {
                            'method': 'GET'
                        })];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.text()];
                    case 2:
                        executingQueries = _a.sent();
                        console.log("Fetched existing queries from ".concat(fetchLocation, ": ").concat(executingQueries));
                        if (!executingQueries) {
                            console.error("No executing queries found or the fetch operation failed.");
                            return [2 /*return*/, ''];
                        }
                        console.log("Executing Queries: ".concat(executingQueries));
                        return [2 /*return*/, executingQueries];
                }
            });
        });
    };
    /**
     *
     */
    BeeWorker.prototype.validateQueryContainment = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query_to_check;
            return __generator(this, function (_a) {
                // First Rewrite the SubQueries
                console.log("Rewriting the different subQueries to check for containment");
                if (!this.query) {
                    console.error("Query is not defined");
                    return [2 /*return*/];
                }
                query_to_check = this.query;
                console.log("Query to check for containment: ".concat(query_to_check));
                this.rewriteSubQueries();
                return [2 /*return*/];
            });
        });
    };
    /**
     *
     */
    BeeWorker.prototype.rewriteSubQueries = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log("Rewriting SubQueries for the Query: ".concat(this.query));
                return [2 /*return*/];
            });
        });
    };
    /**
     *
     * @param queryOne
     * @param queryTwo
     */
    BeeWorker.prototype.completenessCheck = function (queryOne, queryTwo) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, true]; // Placeholder for completeness check logic
            });
        });
    };
    /**
     *
     * @param queryOne
     * @param queryTwo
     */
    BeeWorker.prototype.soundnessCheck = function (queryOne, queryTwo) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, true]; // Placeholder for soundness check logic
            });
        });
    };
    /**
     *
     */
    BeeWorker.prototype.checkWindowParametersForQueries = function () {
        return __awaiter(this, void 0, void 0, function () {
            var existingQueries;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchExistingQueries("http://localhost:8080/fetchQueries")];
                    case 1:
                        existingQueries = _a.sent();
                        console.log("Existing Queries: ".concat(existingQueries));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     *
     * @param executingQueries
     * @param query
     */
    BeeWorker.prototype.findContainedQueries = function (executingQueries, query) {
        return __awaiter(this, void 0, void 0, function () {
            var test_map, query1, query2;
            return __generator(this, function (_a) {
                test_map = new Map();
                query1 = "\n            PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o) AS ?avgX)\nFROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accX [RANGE 60000 STEP 60000]\nWHERE {\n    WINDOW :w1 {\n        ?s saref:hasValue ?o .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .\n    }\n}\n    ";
                query2 = "\n                PREFIX mqtt_broker: <mqtt://localhost:1883/>\n    PREFIX saref: <https://saref.etsi.org/core/>\nPREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\nPREFIX : <https://rsp.js> \nREGISTER RStream <output> AS\nSELECT (AVG(?o) AS ?avgX)\nFROM NAMED WINDOW :w1 ON STREAM mqtt_broker:accY [RANGE 60000 STEP 60000]\nWHERE {\n    WINDOW :w1 {\n        ?s saref:hasValue ?o .\n        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.y .\n    }\n}\n    ";
                test_map.set((0, Util_1.hash_string_md5)(query1), query1);
                test_map.set((0, Util_1.hash_string_md5)(query2), query2);
                return [2 /*return*/, test_map]; // Placeholder for contained queries logic
            });
        });
    };
    /**
     *
     */
    BeeWorker.prototype.stop = function () {
    };
    return BeeWorker;
}());
exports.BeeWorker = BeeWorker;
var worker = new BeeWorker();
process.on("SIGINT", function () {
    worker.stop();
    process.exit(0);
});
process.on("SIGTERM", function () {
    worker.stop();
    process.exit(0);
});
