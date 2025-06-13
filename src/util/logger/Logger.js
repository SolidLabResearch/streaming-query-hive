"use strict";
exports.__esModule = true;
exports.Logger = void 0;
var fs = require("fs");
var LoggerEnum_1 = require("./LoggerEnum");
/**
 *
 */
var Logger = /** @class */ (function () {
    /**
     *
     * @param logLevel
     * @param loggableClasses
     * @param logDestination
     */
    function Logger(logLevel, loggableClasses, logDestination) {
        this.log_level = logLevel;
        this.loggable_classes = loggableClasses;
        this.log_destination = logDestination;
        console.log("Logger initialized with log level ".concat(this.log_level, ", loggable classes ").concat(this.loggable_classes, ", and log destination ").concat(this.log_destination));
    }
    /**
     *
     * @param logLevel
     */
    Logger.prototype.setLogLevel = function (logLevel) {
        this.log_level = logLevel;
    };
    /**
     *
     * @param loggableClasses
     */
    Logger.prototype.setLoggableClasses = function (loggableClasses) {
        this.loggable_classes = loggableClasses;
    };
    /**
     *
     * @param logDestination
     */
    Logger.prototype.setLogDestination = function (logDestination) {
        this.log_destination = logDestination;
    };
    /**
     *
     * @param level
     * @param message
     * @param className
     */
    Logger.prototype.log = function (level, message, className) {
        if (level >= this.log_level && this.loggable_classes.includes(className)) {
            var logPrefix = "[".concat(LoggerEnum_1.LogLevel[level], "] [").concat(className, "]");
            var logMessage = "".concat(Date.now(), ",").concat(message);
            switch (this.log_destination) {
                case 'CONSOLE':
                    console.log(logMessage);
                    break;
                case 'FILE':
                    try {
                        fs.appendFileSync("./logs/".concat(className, ".log"), "".concat(logMessage, "\n"));
                    }
                    catch (error) {
                        console.error("Error writing to file: ".concat(error));
                    }
                    break;
                default:
                    console.log("Invalid log destination: ".concat(this.log_destination));
            }
        }
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.trace = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.TRACE, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.debug = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.DEBUG, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.info = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.INFO, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.config = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.CONFIG, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.warn = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.WARN, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.error = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.ERROR, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.fatal = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.FATAL, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.severe = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.SEVERE, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.audit = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.AUDIT, message, className);
    };
    /**
     *
     * @param message
     * @param className
     */
    Logger.prototype.stats = function (message, className) {
        this.log(LoggerEnum_1.LogLevel.STATS, message, className);
    };
    /**
     *
     * @param logLevel
     * @param loggableClasses
     * @param logDestination
     */
    Logger.getLogger = function (logLevel, loggableClasses, logDestination) {
        return new Logger(logLevel, loggableClasses, logDestination);
    };
    /**
     *
     */
    Logger.getLoggerWithDefaults = function () {
        return new Logger(LoggerEnum_1.LogLevel.INFO, [], LoggerEnum_1.LogDestination.CONSOLE);
    };
    return Logger;
}());
exports.Logger = Logger;
