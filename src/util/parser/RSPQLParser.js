"use strict";
exports.__esModule = true;
exports.ParsedQuery = exports.RSPQLParser = void 0;
var SparqlParser = require('sparqljs').Parser;
/**
 * Class for parsing an RSPQL query.
 * @class RSPQLParser
 */
var RSPQLParser = /** @class */ (function () {
    function RSPQLParser() {
        this.sparqlParser = new SparqlParser();
    }
    /**
     * Parses an RSPQL query and extracts relevant informati;on.
     * @param {string} query - The RSPQL query to parse.
     * @returns {ParsedQuery} - The parsed query object containing extracted information.
     */
    RSPQLParser.prototype.parse = function (query) {
        var _this = this;
        var parsed = new ParsedQuery();
        var split = query.split(/\r?\n/);
        var sparqlLines = new Array();
        var originalSparqlLines = new Array(); // For sparqljs parsing with aggregations
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
                // Don’t add REGISTER to sparqlLines (pure SPARQL doesn’t need it)
                originalSparqlLines.push(trimmed_line);
            }
            else if (trimmed_line.startsWith("FROM NAMED WINDOW")) {
                var regexp = /FROM +NAMED +WINDOW +([^ ]+) +ON +STREAM +([^ ]+) +\[RANGE +([^ ]+) +STEP +([^ ]+)\]/g;
                var matches = trimmed_line.matchAll(regexp);
                for (var _a = 0, matches_2 = matches; _a < matches_2.length; _a++) {
                    var match = matches_2[_a];
                    var windowName = _this.unwrap(match[1], prefixMapper);
                    parsed.add_s2r({
                        window_name: windowName,
                        stream_name: _this.unwrap(match[2], prefixMapper),
                        width: Number(match[3]),
                        slide: Number(match[4])
                    });
                }
                originalSparqlLines.push(trimmed_line);
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
                        parsed.prefixes.set(match[1], match[2]);
                    }
                }
                if (sparqlLine.startsWith("SELECT")) {
                    // Simplify SELECT for sparqlLines using the variable inside aggregation
                    var aggMatch = sparqlLine.match(/SELECT\s*\(?([A-Z]+)\(\?([^)]+)\)\s*(?:AS|as)\s*\?([a-zA-Z0-9]+)\)?/i);
                    if (aggMatch) {
                        var aggVar = "?".concat(aggMatch[2]); // e.g., ?x (variable inside AVG)
                        sparqlLines.push("SELECT ".concat(aggVar));
                    }
                    else {
                        sparqlLines.push(sparqlLine);
                    }
                    originalSparqlLines.push(trimmed_line); // Keep original for sparqljs
                }
                else if (sparqlLine) {
                    sparqlLines.push(sparqlLine);
                    originalSparqlLines.push(sparqlLine);
                }
            }
        });
        // Ensure parsed.sparql is pure SPARQL
        parsed.sparql = sparqlLines.join("\n");
        // Parse the original SPARQL portion with aggregations for metadata
        var sparqlOnlyLines = originalSparqlLines.filter(function (line) { return !line.includes("FROM NAMED WINDOW") && !line.includes("REGISTER"); });
        var sparqlOnlyQuery = sparqlOnlyLines.join("\n");
        try {
            var parsedSparql = this.sparqlParser.parse(sparqlOnlyQuery);
            this.extractAggregations(parsedSparql, parsed);
        }
        catch (error) {
            console.warn("Failed to parse SPARQL portion:", error);
        }
        return parsed;
    };
    /**
     * Extracts aggregation functions and variables from the parsed SPARQL query.
     * @param {any} parsedSparql - The parsed SPARQL query object.
     * @param {ParsedQuery} parsed - The ParsedQuery object to populate with extracted information.
     */
    RSPQLParser.prototype.extractAggregations = function (parsedSparql, parsed) {
        if (parsedSparql.queryType === 'SELECT' && parsedSparql.variables) {
            parsedSparql.variables.forEach(function (variable) {
                if (variable.expression && variable.expression.type === 'aggregate') {
                    parsed.aggregation_function = variable.expression.aggregation.toUpperCase();
                    parsed.aggregation_thing_in_context.push(variable.expression.expression.value);
                    parsed.projection_variables.push(variable.variable.value);
                }
                else if (variable.termType === 'Variable') {
                    parsed.projection_variables.push(variable.value);
                }
            });
        }
    };
    /**
     * Unwraps a prefixed IRI using the provided mapper.
     * @param {string} prefixedIri - The prefixed IRI to unwrap.
     * @param {Map<string, string>} mapper - The prefix mapper.
     * @returns {string} - The unwrapped IRI or an empty string if the prefix is not found.
     */
    RSPQLParser.prototype.unwrap = function (prefixedIri, mapper) {
        if (prefixedIri.trim().startsWith("<")) {
            return prefixedIri.trim().slice(1, -1);
        }
        var split = prefixedIri.trim().split(":");
        var iri = split[0];
        if (mapper.has(iri)) {
            return mapper.get(iri) + split[1];
        }
        else {
            return "";
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
        this.sparql = "SELECT * WHERE{?s ?p ?o}";
        this.r2s = { operator: "RStream", name: "undefined" };
        this.s2r = new Array();
        this.prefixes = new Map();
        this.aggregation_thing_in_context = new Array();
        this.projection_variables = new Array();
        this.aggregation_function = "";
    }
    /**
     * Sets the SPARQL query string.
     * @param {string} sparql - The SPARQL query string to set.
     * @returns {void}
     * @memberof ParsedQuery
     */
    ParsedQuery.prototype.set_sparql = function (sparql) {
        this.sparql = sparql;
    };
    /**
     * Sets the R2S object.
     * @param {R2S} r2s - The R2S object to set.
     * @returns {void}
     * @memberof ParsedQuery
     */
    ParsedQuery.prototype.set_r2s = function (r2s) {
        this.r2s = r2s;
    };
    /**
     * Adds a prefix to the prefixes map.
     * @param {WindowDefinition} s2r - The S2R object to add.
     * @memberof ParsedQuery
     */
    ParsedQuery.prototype.add_s2r = function (s2r) {
        this.s2r.push(s2r);
    };
    return ParsedQuery;
}());
exports.ParsedQuery = ParsedQuery;
