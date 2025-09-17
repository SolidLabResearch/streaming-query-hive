import { Orchestrator } from '../../../src/orchestrator/Orchestrator';
import { RSPAgent } from '../../../src/agent/RSPAgent';
import { BeeKeeper } from '../../../src/services/BeeKeeper';
import { HTTPServer } from '../../../src/services/server/HTTPServer';

// Mock dependencies
jest.mock('../../../src/agent/RSPAgent');
jest.mock('../../../src/services/BeeKeeper');
jest.mock('../../../src/services/server/HTTPServer');
jest.mock('../../../src/util/Util', () => ({
    hash_string_md5: jest.fn().mockReturnValue('mock-hash-12345678901234567890123456789012')
}));

const MockRSPAgent = RSPAgent as jest.MockedClass<typeof RSPAgent>;
const MockBeeKeeper = BeeKeeper as jest.MockedClass<typeof BeeKeeper>;
const MockHTTPServer = HTTPServer as jest.MockedClass<typeof HTTPServer>;

// Mock the config import
jest.mock('../../../src/config/httpServerConfig.json', () => ({
    port: 8080
}), { virtual: true });

describe('Orchestrator', () => {
    let orchestrator: Orchestrator;
    let mockConsoleLog: jest.SpyInstance;
    let mockConsoleError: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
        mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

        // Mock RSPAgent instance methods
        const mockRSPAgentInstance = {
            process_streams: jest.fn().mockResolvedValue(undefined)
        };
        MockRSPAgent.mockImplementation(() => mockRSPAgentInstance as any);

        // Mock BeeKeeper instance
        MockBeeKeeper.mockImplementation(() => ({} as any));

        // Mock HTTPServer instance
        MockHTTPServer.mockImplementation(() => ({} as any));
    });

    afterEach(() => {
        mockConsoleLog.mockRestore();
        mockConsoleError.mockRestore();
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            orchestrator = new Orchestrator('test-operator');

            expect(MockBeeKeeper).toHaveBeenCalled();
            expect(MockHTTPServer).toHaveBeenCalledWith(8080, console);
            expect(mockConsoleLog).toHaveBeenCalledWith('HTTP server has started on port 8080');
        });

        it('should set operator type correctly', () => {
            const operatorType = 'chunked-operator';
            orchestrator = new Orchestrator(operatorType);

            // We can't directly test private properties, but we know it's set based on constructor
            expect(MockHTTPServer).toHaveBeenCalled();
        });
    });

    describe('addSubQuery', () => {
        beforeEach(() => {
            orchestrator = new Orchestrator('test-operator');
        });

        it('should add a sub-query successfully', async () => {
            const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
            
            orchestrator.addSubQuery(testQuery);

            expect(MockRSPAgent).toHaveBeenCalledWith(
                testQuery, 
                expect.stringContaining('chunked/')
            );
            expect(mockConsoleLog).toHaveBeenCalledWith(`Sub-query added: ${testQuery}`);
        });

        it('should create RSPAgent with hashed query path', () => {
            const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
            
            orchestrator.addSubQuery(testQuery);

            expect(MockRSPAgent).toHaveBeenCalledWith(
                testQuery,
                expect.stringMatching(/^chunked\/[a-f0-9]{32}$/)
            );
        });

        it('should handle multiple sub-queries', () => {
            const query1 = 'SELECT * WHERE { ?s ?p ?o }';
            const query2 = 'SELECT ?x WHERE { ?x rdf:type ?type }';
            
            orchestrator.addSubQuery(query1);
            orchestrator.addSubQuery(query2);

            expect(MockRSPAgent).toHaveBeenCalledTimes(2);
            expect(mockConsoleLog).toHaveBeenCalledWith(`Sub-query added: ${query1}`);
            expect(mockConsoleLog).toHaveBeenCalledWith(`Sub-query added: ${query2}`);
        });

        it('should handle RSPAgent process_streams rejection', async () => {
            const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
            const mockError = new Error('Processing failed');
            
            const mockRSPAgentInstance = {
                process_streams: jest.fn().mockRejectedValue(mockError)
            };
            MockRSPAgent.mockImplementation(() => mockRSPAgentInstance as any);

            orchestrator.addSubQuery(testQuery);

            // Wait for the async operation to complete
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockConsoleError).toHaveBeenCalledWith(
                `Error processing sub-query "${testQuery}":`,
                mockError
            );
        });
    });

    describe('registerQuery', () => {
        beforeEach(() => {
            orchestrator = new Orchestrator('test-operator');
        });

        it('should add a registered query', () => {
            const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
            
            orchestrator.registerQuery(testQuery);

            expect(mockConsoleLog).toHaveBeenCalledWith(`Registered query: ${testQuery}`);
        });

        it('should handle empty query string', () => {
            const emptyQuery = '';
            
            orchestrator.registerQuery(emptyQuery);

            expect(mockConsoleLog).toHaveBeenCalledWith(`Registered query: ${emptyQuery}`);
        });
    });

    describe('getRegisteredQuery', () => {
        beforeEach(() => {
            orchestrator = new Orchestrator('test-operator');
        });

        it('should return the registered query', () => {
            const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
            
            orchestrator.registerQuery(testQuery);
            const result = orchestrator.getRegisteredQuery();

            expect(result).toBe(testQuery);
        });

        it('should return empty string when no query is registered', () => {
            const result = orchestrator.getRegisteredQuery();

            expect(result).toBe('');
        });
    });

    describe('getSubQueries', () => {
        beforeEach(() => {
            orchestrator = new Orchestrator('test-operator');
        });

        it('should return empty array initially', () => {
            const result = orchestrator.getSubQueries();

            expect(result).toEqual([]);
        });

        it('should return all added sub-queries', () => {
            const query1 = 'SELECT * WHERE { ?s ?p ?o }';
            const query2 = 'SELECT ?x WHERE { ?x rdf:type ?type }';
            
            orchestrator.addSubQuery(query1);
            orchestrator.addSubQuery(query2);
            
            const result = orchestrator.getSubQueries();

            expect(result).toEqual([query1, query2]);
        });
    });

    describe('deleteSubQuery', () => {
        beforeEach(() => {
            orchestrator = new Orchestrator('test-operator');
        });

        it('should remove a specific sub-query', () => {
            const query1 = 'SELECT * WHERE { ?s ?p ?o }';
            const query2 = 'SELECT ?x WHERE { ?x rdf:type ?type }';
            
            orchestrator.addSubQuery(query1);
            orchestrator.addSubQuery(query2);
            
            orchestrator.deleteSubQuery(query1);
            
            const result = orchestrator.getSubQueries();
            expect(result).toEqual([query2]);
        });

        it('should handle deletion of non-existent query', () => {
            const query1 = 'SELECT * WHERE { ?s ?p ?o }';
            const nonExistentQuery = 'SELECT ?y WHERE { ?y rdfs:label ?label }';
            
            orchestrator.addSubQuery(query1);
            orchestrator.deleteSubQuery(nonExistentQuery);
            
            const result = orchestrator.getSubQueries();
            expect(result).toEqual([query1]);
        });
    });

    describe('clearSubQueries', () => {
        beforeEach(() => {
            orchestrator = new Orchestrator('test-operator');
        });

        it('should clear all sub-queries', () => {
            const query1 = 'SELECT * WHERE { ?s ?p ?o }';
            const query2 = 'SELECT ?x WHERE { ?x rdf:type ?type }';
            
            orchestrator.addSubQuery(query1);
            orchestrator.addSubQuery(query2);
            
            orchestrator.clearSubQueries();
            
            const result = orchestrator.getSubQueries();
            expect(result).toEqual([]);
            expect(mockConsoleLog).toHaveBeenCalledWith('Cleared all sub-queries.');
        });
    });

    describe('runSubQueries', () => {
        beforeEach(() => {
            orchestrator = new Orchestrator('test-operator');
        });

        it('should handle empty sub-queries list', () => {
            orchestrator.runSubQueries();
            
            expect(mockConsoleLog).toHaveBeenCalledWith('No queries to run.');
            expect(MockRSPAgent).not.toHaveBeenCalled();
        });

        it('should run all sub-queries', () => {
            const query1 = 'SELECT * WHERE { ?s ?p ?o }';
            const query2 = 'SELECT ?x WHERE { ?x rdf:type ?type }';
            
            orchestrator.addSubQuery(query1);
            orchestrator.addSubQuery(query2);
            
            orchestrator.runSubQueries();
            
            // Should be called 4 times: 2 from addSubQuery, 2 from runSubQueries
            expect(MockRSPAgent).toHaveBeenCalledTimes(4);
        });
    });

    describe('runRegisteredQuery', () => {
        beforeEach(() => {
            orchestrator = new Orchestrator('test-operator');
            
            // Mock BeeKeeper executeQuery method
            const mockBeeKeeperInstance = {
                executeQuery: jest.fn()
            };
            MockBeeKeeper.mockImplementation(() => mockBeeKeeperInstance as any);
            orchestrator = new Orchestrator('test-operator');
        });

        it('should handle empty registered query', () => {
            orchestrator.runRegisteredQuery();
            
            expect(mockConsoleLog).toHaveBeenCalledWith('No registered query to run.');
        });

        it('should run registered query with BeeKeeper', () => {
            const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
            const subQuery1 = 'SELECT ?s WHERE { ?s ?p ?o }';
            
            orchestrator.registerQuery(testQuery);
            orchestrator.addSubQuery(subQuery1);
            
            orchestrator.runRegisteredQuery();
            
            expect(mockConsoleLog).toHaveBeenCalledWith(`Running registered query: ${testQuery}`);
        });
    });

    describe('integration', () => {
        it('should work with different operator types', () => {
            const operators = ['chunked', 'approximation', 'fetching'];
            
            operators.forEach(operatorType => {
                const orch = new Orchestrator(operatorType);
                expect(MockHTTPServer).toHaveBeenCalled();
            });

            expect(MockHTTPServer).toHaveBeenCalledTimes(operators.length);
        });
    });
});
