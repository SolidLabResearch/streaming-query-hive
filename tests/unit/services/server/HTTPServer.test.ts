import { HTTPServer, RSPAgentQueryRecord } from '../../../../src/services/server/HTTPServer';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';

// Mock the dependencies
jest.mock('http');
jest.mock('../../../../src/services/server/GETHandler');
jest.mock('../../../../src/services/server/POSTHandler');

const mockCreateServer = createServer as jest.MockedFunction<typeof createServer>;
jest.mock('../../../../src/services/server/GETHandler');
jest.mock('../../../../src/services/server/POSTHandler');

describe('HTTPServer', () => {
    let httpServer: HTTPServer;
    let mockServer: Partial<Server>;
    let mockLogger: any;

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        };

        mockServer = {
            listen: jest.fn().mockReturnThis(),
            close: jest.fn(),
            on: jest.fn()
        };

        mockCreateServer.mockReturnValue(mockServer as Server);
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Clear the RSPAgentQueryRecord
        Object.keys(RSPAgentQueryRecord).forEach(key => {
            delete RSPAgentQueryRecord[key];
        });
    });

    describe('constructor', () => {
        it('should create HTTPServer with given port and logger', () => {
            const port = 3000;
            
            httpServer = new HTTPServer(port, mockLogger);

            expect(mockCreateServer).toHaveBeenCalledWith(expect.any(Function));
            expect(mockServer.listen).toHaveBeenCalledWith(port);
            expect(mockLogger.info).toHaveBeenCalledWith(`HTTP Server started on port ${port}`);
        });

        it('should bind request handler correctly', () => {
            httpServer = new HTTPServer(8080, mockLogger);

            expect(mockCreateServer).toHaveBeenCalledWith(expect.any(Function));
            
            // Verify the function passed to createServer is bound correctly
            const requestHandler = mockCreateServer.mock.calls[0][0];
            expect(typeof requestHandler).toBe('function');
        });
    });

    describe('RSPAgentQueryRecord', () => {
        it('should be an empty object initially', () => {
            // Clear any existing entries first
            Object.keys(RSPAgentQueryRecord).forEach(key => {
                delete RSPAgentQueryRecord[key];
            });
            expect(Object.keys(RSPAgentQueryRecord)).toHaveLength(0);
        });

        it('should allow adding and retrieving queries', () => {
            const testQuery = {
                id: 'test-id',
                rspql_query: 'SELECT * WHERE { ?s ?p ?o }',
                r2s_topic: 'results/test',
                data_topic: 'data/test'
            };

            RSPAgentQueryRecord['test-id'] = testQuery;
            
            expect(RSPAgentQueryRecord['test-id']).toEqual(testQuery);
        });

        it('should support multiple queries', () => {
            const query1 = {
                id: 'query-1',
                rspql_query: 'SELECT * WHERE { ?s ?p ?o }',
                r2s_topic: 'results/query1',
                data_topic: 'data/query1'
            };

            const query2 = {
                id: 'query-2',
                rspql_query: 'SELECT ?x WHERE { ?x rdf:type ?type }',
                r2s_topic: 'results/query2',
                data_topic: 'data/query2'
            };

            RSPAgentQueryRecord['query-1'] = query1;
            RSPAgentQueryRecord['query-2'] = query2;
            
            expect(RSPAgentQueryRecord['query-1']).toEqual(query1);
            expect(RSPAgentQueryRecord['query-2']).toEqual(query2);
            expect(Object.keys(RSPAgentQueryRecord)).toHaveLength(2);
        });
    });

    describe('logger integration', () => {
        it('should use the provided logger', () => {
            httpServer = new HTTPServer(3000, mockLogger);
            
            expect(httpServer.logger).toBe(mockLogger);
            expect(mockLogger.info).toHaveBeenCalledWith('HTTP Server started on port 3000');
        });

        it('should work with different logger implementations', () => {
            const customLogger = {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                debug: jest.fn(),
                customMethod: jest.fn()
            };

            httpServer = new HTTPServer(4000, customLogger);
            
            expect(httpServer.logger).toBe(customLogger);
            expect(customLogger.info).toHaveBeenCalledWith('HTTP Server started on port 4000');
        });
    });
});
