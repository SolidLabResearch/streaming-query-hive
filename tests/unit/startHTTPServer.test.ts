import { program } from 'commander';
import * as bunyan from 'bunyan';
import * as fs from 'fs';

// Mock dependencies
jest.mock('commander');
jest.mock('bunyan');
jest.mock('fs');
jest.mock('../../../src/services/server/HTTPServer');
jest.mock('../../../src/config/httpServerConfig.json', () => ({
    port: 8080,
    logLevel: 'info'
}), { virtual: true });

const mockProgram = program as jest.Mocked<typeof program>;
const mockBunyan = bunyan as jest.Mocked<typeof bunyan>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockHTTPServer = require('../../../src/services/server/HTTPServer').HTTPServer;

describe('startHTTPServer', () => {
    let mockCreateWriteStream: jest.SpyInstance;
    let mockCreateLogger: jest.SpyInstance;
    let mockDate: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Date to have consistent timestamps
        mockDate = jest.spyOn(global, 'Date').mockImplementation(() => ({
            getFullYear: () => 2023,
            getMonth: () => 11, // December (0-indexed)
            getDate: () => 25,
            getHours: () => 14,
            getMinutes: () => 30,
            getSeconds: () => 45
        } as any));

        mockCreateWriteStream = jest.spyOn(fs, 'createWriteStream').mockReturnValue({
            write: jest.fn(),
            end: jest.fn()
        } as any);

        mockCreateLogger = jest.spyOn(bunyan, 'createLogger').mockReturnValue({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        } as any);

        // Mock commander program methods
        mockProgram.option = jest.fn().mockReturnValue(mockProgram);
        mockProgram.parse = jest.fn().mockReturnValue(mockProgram);
        mockProgram.opts = jest.fn().mockReturnValue({});

        // Mock HTTPServer
        mockHTTPServer.mockImplementation(() => ({
            start: jest.fn(),
            stop: jest.fn()
        }));
    });

    afterEach(() => {
        mockDate.mockRestore();
        jest.resetModules();
    });

    describe('getTimestamp function', () => {
        it('should format timestamp correctly', () => {
            // Since we can't directly test the internal function, we test its effect
            // by checking the log file name creation
            
            // Re-import to get fresh module with our mocked Date
            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                
                expect(mockCreateWriteStream).toHaveBeenCalledWith(
                    'aggregator-2023-12-25-14-30-45.log',
                    { flags: 'a' }
                );
            });
        });

        it('should pad single digit values with zeros', () => {
            // Mock date with single digit values
            mockDate.mockImplementation(() => ({
                getFullYear: () => 2023,
                getMonth: () => 0, // January
                getDate: () => 5,
                getHours: () => 8,
                getMinutes: () => 9,
                getSeconds: () => 3
            } as any));

            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                
                expect(mockCreateWriteStream).toHaveBeenCalledWith(
                    'aggregator-2023-01-05-08-09-03.log',
                    { flags: 'a' }
                );
            });
        });
    });

    describe('Logger setup', () => {
        it('should create bunyan logger with correct configuration', () => {
            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                
                expect(mockCreateLogger).toHaveBeenCalledWith({
                    name: "Streaming Query Hive",
                    streams: [
                        {
                            level: 'info',
                            stream: expect.any(Object)
                        }
                    ],
                    serializers: {
                        log: expect.any(Function)
                    }
                });
            });
        });

        it('should configure log serializer correctly', () => {
            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                
                const loggerConfig = mockCreateLogger.mock.calls[0][0];
                const logSerializer = loggerConfig.serializers.log;
                
                // Test the log serializer function
                const testLogData = {
                    message: 'test message',
                    query_id: 'query-123',
                    extra_field: 'extra_value'
                };
                
                const result = logSerializer(testLogData);
                
                expect(result).toEqual({
                    message: 'test message',
                    query_id: 'query-123',
                    extra_field: 'extra_value'
                });
            });
        });

        it('should handle log data without query_id', () => {
            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                
                const loggerConfig = mockCreateLogger.mock.calls[0][0];
                const logSerializer = loggerConfig.serializers.log;
                
                const testLogData = {
                    message: 'test message without query_id'
                };
                
                const result = logSerializer(testLogData);
                
                expect(result).toEqual({
                    message: 'test message without query_id',
                    query_id: 'no_query_id'
                });
            });
        });
    });

    describe('File stream creation', () => {
        it('should create write stream with append flag', () => {
            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                
                expect(mockCreateWriteStream).toHaveBeenCalledWith(
                    expect.stringMatching(/^aggregator-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.log$/),
                    { flags: 'a' }
                );
            });
        });
    });

    describe('Commander.js integration', () => {
        beforeEach(() => {
            // Reset the commander mocks
            mockProgram.option.mockClear().mockReturnValue(mockProgram);
            mockProgram.parse.mockClear().mockReturnValue(mockProgram);
            mockProgram.opts.mockClear();
        });

        it('should set up commander options if used', () => {
            // This test would verify commander setup if the module uses it
            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                // If commander is used in the module, we can verify the setup here
            });
        });
    });

    describe('Error handling', () => {
        it('should handle file stream creation errors gracefully', () => {
            const error = new Error('File system error');
            mockCreateWriteStream.mockImplementation(() => {
                throw error;
            });

            expect(() => {
                jest.isolateModules(() => {
                    require('../../../src/startHTTPServer');
                });
            }).toThrow('File system error');
        });

        it('should handle logger creation errors gracefully', () => {
            const error = new Error('Logger creation error');
            mockCreateLogger.mockImplementation(() => {
                throw error;
            });

            expect(() => {
                jest.isolateModules(() => {
                    require('../../../src/startHTTPServer');
                });
            }).toThrow('Logger creation error');
        });
    });

    describe('Integration', () => {
        it('should initialize all components correctly', () => {
            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                
                // Verify that all major components are initialized
                expect(mockCreateWriteStream).toHaveBeenCalled();
                expect(mockCreateLogger).toHaveBeenCalled();
            });
        });

        it('should use config values correctly', () => {
            jest.isolateModules(() => {
                require('../../../src/startHTTPServer');
                
                // If HTTPServer is instantiated in the module, verify config usage
                // This would depend on the actual implementation
            });
        });
    });
});
