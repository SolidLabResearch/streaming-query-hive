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
exports.R2ROperator = void 0;
var rdf_data_factory_1 = require("rdf-data-factory");
var N3 = require('n3');
var DF = new rdf_data_factory_1.DataFactory();
var QueryEngine = require('@comunica/query-sparql').QueryEngine;
/**
 * R2R Operator Implementation Class for the RSP Engine.
 * It performs operations such as Join, Filter, Aggregation on a stream of data
 * to generate a new stream of data.
 */
var R2ROperator = /** @class */ (function () {
    /**
     * Constructor to initialize the R2R Operator.
     * @param {string} query - The query to be executed.
     */
    function R2ROperator(query) {
        this.query = query;
        this.staticData = new Set();
    }
    /**
     * Add static data to the R2R Operator which will be used in the query execution
     * In case there are some quads which are present in each of the relation to be executed, it is better to add them as static data
     * and therefore save space and the amount of data to be processed.
     * @param {Quad} quad - The quad to be added as static data.
     */
    R2ROperator.prototype.addStaticData = function (quad) {
        this.staticData.add(quad);
    };
    /**
     * Execute the R2R Operator on the given container of quads.
     * @param {QuadContainer} container - The container of quads on which the operator is to be executed. The container contains a set of quads.
     * @returns {Promise<any>} - The promise of the result of the query execution.
     */
    R2ROperator.prototype.execute = function (streamStore) {
        return __awaiter(this, void 0, void 0, function () {
            var store, _i, _a, elem, _b, _c, elem, myEngine;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        store = new N3.Store();
                        for (_i = 0, _a = streamStore.getQuads(null, null, null, null); _i < _a.length; _i++) {
                            elem = _a[_i];
                            store.addQuad(elem);
                        }
                        for (_b = 0, _c = this.staticData; _b < _c.length; _b++) {
                            elem = _c[_b];
                            store.addQuad(elem);
                        }
                        myEngine = new QueryEngine();
                        return [4 /*yield*/, myEngine.queryBindings(this.query, {
                                sources: [store],
                                extensionFunctions: {
                                    'http://extension.org/functions#sqrt': function (args) {
                                        var arg = args[0];
                                        if (arg.termType === 'Literal') {
                                            return DF.literal(Math.sqrt(Number(arg.value)).toString());
                                        }
                                    },
                                    'http://extension.org/functions#pow': function (args) {
                                        var arg1 = args[0];
                                        if (arg1.termType === 'Literal') {
                                            var arg2 = args[1];
                                            if (arg2.termType === 'Literal') {
                                                return DF.literal(Math.pow(Number(arg1.value), Number(arg2.value)).toString());
                                            }
                                        }
                                    }
                                }
                            })];
                    case 1: return [2 /*return*/, _d.sent()];
                }
            });
        });
    };
    return R2ROperator;
}());
exports.R2ROperator = R2ROperator;
