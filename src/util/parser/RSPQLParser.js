"use strict";
exports.__esModule = true;
exports.ParsedQuery = exports.RSPQLParser = void 0;
var SparqlParser = require('sparqljs').Parser;
/**
 * Class for parsing a RSPQL query.
 * @class RSPQLParser
 */
var RSPQLParser = /** @class */ (function () {
    /**
     * Creates an instance of RSPQLParser.
     * @memberof RSPQLParser
     */
    function RSPQLParser() {
        this.r2s = new Map();
        this.s2r = new Array();
        this.sparql_parser = new SparqlParser();
    }
    /**
     * Parse a RSPQL query to a parsedQuery Object containing the R2S and S2R mappings along with the SPARQL query.
     * @param {string} rspql_query - The RSPQL query to be parsed.
     * @returns {ParsedQuery} - The parsed query object.
     * @memberof RSPQLParser
     */
    RSPQLParser.prototype.parse = function (rspql_query) {
        var _this = this;
        var parsed = new ParsedQuery();
        var split = rspql_query.split(/\r?\n/);
        var sparqlLines = new Array();
        var prefixMapper = new Map();
        split.forEach(function (line) {
            var trimmed_line = line.trim();
            if (trimmed_line.startsWith("REGISTER")) {
                var regexp = /REGISTER +([^ ]+) +<([^>]+)> AS/g;
                var matches = trimmed_line.matchAll(regexp);
                for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
                    var match = matches_1[_i];
                    if (match[1] === "RStream" || match[1] === "DStream" || match[1] === "IStream") {
                        parsed.set_r2s({ operator: match[1], name: match[2] });
                    }
                }
            }
            else if (trimmed_line.startsWith("FROM NAMED WINDOW")) {
                var regexp = /FROM +NAMED +WINDOW +([^ ]+) +ON +STREAM +([^ ]+) +\[RANGE +([^ ]+) +STEP +([^ ]+)\]/g;
                var matches = trimmed_line.matchAll(regexp);
                for (var _a = 0, matches_2 = matches; _a < matches_2.length; _a++) {
                    var match = matches_2[_a];
                    parsed.add_s2r({
                        window_name: _this.unwrap(match[1], prefixMapper),
                        stream_name: _this.unwrap(match[2], prefixMapper),
                        width: Number(match[3]),
                        slide: Number(match[4])
                    });
                }
            }
            else {
                var sparqlLine = trimmed_line;
                if (sparqlLine.startsWith("WINDOW")) {
                    sparqlLine = sparqlLine.replace("WINDOW", "GRAPH");
                }
                if (sparqlLine.startsWith("PREFIX")) {
                    var regexp = /PREFIX +([^:]*): +<([^>]+)>/g;
                    var matches = trimmed_line.matchAll(regexp);
                    for (var _b = 0, matches_3 = matches; _b < matches_3.length; _b++) {
                        var match = matches_3[_b];
                        prefixMapper.set(match[1], match[2]);
                    }
                }
                sparqlLines.push(sparqlLine);
            }
        });
        parsed.sparql = sparqlLines.join("\n");
        this.parse_sparql_query(parsed.sparql, parsed);
        return parsed;
    };
    /**
     * Unwraps a prefixed IRI to a full IRI.
     * @param {string} prefixedIRI - The prefixed IRI to be unwrapped.
     * @param {Map<string, string>} prefixMapper - The prefix mapper to be used for unwrapping.
     * @returns {string} - The unwrapped IRI. - The unwrapped IRI.
     * @memberof RSPQLParser
     */
    RSPQLParser.prototype.unwrap = function (prefixedIRI, prefixMapper) {
        if (prefixedIRI.trim().startsWith("<")) {
            return prefixedIRI.trim().slice(1, -1);
        }
        var split = prefixedIRI.trim().split(":");
        var iri = split[0];
        if (prefixMapper.has(iri)) {
            return prefixMapper.get(iri) + split[1];
        }
        else {
            return "";
        }
    };
    /**
     * Parses the SPARQL query to extract the prefixes, projection variables and aggregation function.
     * @param {string} sparqlQuery - The SPARQL query to be parsed.
     * @param {ParsedQuery} parsed - The parsed query object to be used for storing the parsed data.
     * @memberof RSPQLParser
     */
    RSPQLParser.prototype.parse_sparql_query = function (sparqlQuery, parsed) {
        var parsed_sparql_query = this.sparql_parser.parse(sparqlQuery);
        var prefixes = parsed_sparql_query.prefixes;
        Object.keys(prefixes).forEach(function (key) {
            parsed.prefixes.set(key, prefixes[key]);
        });
        for (var i = 0; i <= parsed_sparql_query.variables.length; i++) {
            if (parsed_sparql_query.variables[i] !== undefined) {
                //                parsed.projection_variables.push(parsed_sparql_query.variables[i].variable.value);
                //    parsed.aggregation_function = parsed_sparql_query.variables[i].expression.aggregation;
            }
        }
    };
    return RSPQLParser;
}());
exports.RSPQLParser = RSPQLParser;
/**
 * The parsed query object.
 * @class ParsedQuery
 */
var ParsedQuery = /** @class */ (function () {
    /**
     * Creates an instance of ParsedQuery.
     * @memberof ParsedQuery
     */
    function ParsedQuery() {
        this.sparql = "Select * WHERE{?s ?p ?o}";
        this.r2s = { operator: "RStream", name: "undefined" };
        this.s2r = new Array();
        this.prefixes = new Map();
        this.aggregation_thing_in_context = new Array();
        this.projection_variables = new Array();
        this.aggregation_function = "";
    }
    /**
     * Set the SPARQL query.
     * @param {string} sparql - The SPARQL query to be set.
     * @memberof ParsedQuery
     */
    ParsedQuery.prototype.set_sparql = function (sparql) {
        this.sparql = sparql;
    };
    /**
     * Set the R2S mapping (The Relation to Stream Operator).
     * @param {R2S} r2s - The R2S mapping to be set.
     * @memberof ParsedQuery
     */
    ParsedQuery.prototype.set_r2s = function (r2s) {
        this.r2s = r2s;
    };
    /**
     * Add a window definition. (The Stream to Relation Operator).
     * @param {WindowDefinition} s2r - The window definition to be added.
     * @memberof ParsedQuery
     */
    ParsedQuery.prototype.add_s2r = function (s2r) {
        this.s2r.push(s2r);
    };
    return ParsedQuery;
}());
exports.ParsedQuery = ParsedQuery;
