import { R2ROperator } from '../../../../src/services/operators/r2r';

// Mock dependencies before any imports
jest.mock('n3');
jest.mock('@comunica/query-sparql', () => ({
    QueryEngine: jest.fn()
}));
jest.mock('rdf-data-factory', () => ({
    DataFactory: jest.fn()
}));

const mockN3 = require('n3');
const mockQueryEngine = require('@comunica/query-sparql').QueryEngine;
const MockDataFactory = require('rdf-data-factory').DataFactory;

describe('R2ROperator', () => {
    let r2rOperator: R2ROperator;
    let mockStore: any;
    let mockQueryEngineInstance: any;
    let mockDataFactory: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock N3 Store
        mockStore = {
            addQuad: jest.fn(),
            getQuads: jest.fn().mockReturnValue([])
        };
        mockN3.Store.mockImplementation(() => mockStore);

        // Mock Query Engine
        mockQueryEngineInstance = {
            queryBindings: jest.fn()
        };
        mockQueryEngine.mockImplementation(() => mockQueryEngineInstance);

        // Mock Data Factory
        mockDataFactory = {
            literal: jest.fn()
        };
        MockDataFactory.mockImplementation(() => mockDataFactory);

        const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
        r2rOperator = new R2ROperator(testQuery);
    });

    describe('constructor', () => {
        it('should initialize with query and empty static data', () => {
            const query = 'SELECT ?s WHERE { ?s a ?type }';
            const operator = new R2ROperator(query);

            expect(operator.query).toBe(query);
            expect(operator.staticData).toBeInstanceOf(Set);
            expect(operator.staticData.size).toBe(0);
        });

        it('should handle empty query string', () => {
            const operator = new R2ROperator('');
            
            expect(operator.query).toBe('');
            expect(operator.staticData.size).toBe(0);
        });
    });

    describe('addStaticData', () => {
        it('should add quad to static data', () => {
            const mockQuad = {} as any; // Simple mock for testing

            r2rOperator.addStaticData(mockQuad);

            expect(r2rOperator.staticData.has(mockQuad)).toBe(true);
            expect(r2rOperator.staticData.size).toBe(1);
        });

        it('should handle multiple static data additions', () => {
            const quad1 = { id: 'quad1' } as any;
            const quad2 = { id: 'quad2' } as any;

            r2rOperator.addStaticData(quad1);
            r2rOperator.addStaticData(quad2);

            expect(r2rOperator.staticData.size).toBe(2);
            expect(r2rOperator.staticData.has(quad1)).toBe(true);
            expect(r2rOperator.staticData.has(quad2)).toBe(true);
        });

        it('should not add duplicate quads', () => {
            const quad = { id: 'unique' } as any;

            r2rOperator.addStaticData(quad);
            r2rOperator.addStaticData(quad);

            expect(r2rOperator.staticData.size).toBe(1);
        });
    });

    describe('execute', () => {
        let mockStreamStore: any;

        beforeEach(() => {
            mockStreamStore = {
                getQuads: jest.fn()
            };
        });

        it('should execute query with stream store data', async () => {
            const streamQuads = [
                { subject: 's1', predicate: 'p1', object: 'o1' },
                { subject: 's2', predicate: 'p2', object: 'o2' }
            ];
            
            mockStreamStore.getQuads.mockReturnValue(streamQuads);
            mockQueryEngineInstance.queryBindings.mockResolvedValue([{ binding: 'result' }]);

            const result = await r2rOperator.execute(mockStreamStore);

            expect(mockN3.Store).toHaveBeenCalled();
            expect(mockStore.addQuad).toHaveBeenCalledTimes(2);
            expect(mockStore.addQuad).toHaveBeenCalledWith(streamQuads[0]);
            expect(mockStore.addQuad).toHaveBeenCalledWith(streamQuads[1]);
            expect(mockQueryEngineInstance.queryBindings).toHaveBeenCalledWith(
                r2rOperator.query,
                expect.objectContaining({
                    sources: [mockStore],
                    extensionFunctions: expect.any(Object)
                })
            );
            expect(result).toEqual([{ binding: 'result' }]);
        });

        it('should include static data in query execution', async () => {
            const streamQuads = [{ subject: 's1', predicate: 'p1', object: 'o1' }];
            const staticQuad = { subject: 'static_s', predicate: 'static_p', object: 'static_o' };
            
            r2rOperator.addStaticData(staticQuad as any);
            mockStreamStore.getQuads.mockReturnValue(streamQuads);
            mockQueryEngineInstance.queryBindings.mockResolvedValue([]);

            await r2rOperator.execute(mockStreamStore);

            expect(mockStore.addQuad).toHaveBeenCalledTimes(2);
            expect(mockStore.addQuad).toHaveBeenCalledWith(streamQuads[0]);
            expect(mockStore.addQuad).toHaveBeenCalledWith(staticQuad);
        });

        it('should handle empty stream store', async () => {
            mockStreamStore.getQuads.mockReturnValue([]);
            mockQueryEngineInstance.queryBindings.mockResolvedValue([]);

            const result = await r2rOperator.execute(mockStreamStore);

            expect(mockStore.addQuad).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        it('should handle query execution errors', async () => {
            const error = new Error('Query execution failed');
            mockStreamStore.getQuads.mockReturnValue([]);
            mockQueryEngineInstance.queryBindings.mockRejectedValue(error);

            await expect(r2rOperator.execute(mockStreamStore)).rejects.toThrow('Query execution failed');
        });
    });

    describe('extension functions', () => {
        let extensionFunctions: any;
        let mockStreamStore: any;

        beforeEach(async () => {
            mockStreamStore = { getQuads: jest.fn().mockReturnValue([]) };
            mockQueryEngineInstance.queryBindings.mockResolvedValue([]);

            await r2rOperator.execute(mockStreamStore);
            
            const queryCall = mockQueryEngineInstance.queryBindings.mock.calls[0];
            extensionFunctions = queryCall[1].extensionFunctions;
        });

        describe('sqrt function', () => {
            it('should calculate square root for literal terms', () => {
                mockDataFactory.literal.mockReturnValue({ value: '3' });

                const args = [{ termType: 'Literal', value: '9' }];
                const result = extensionFunctions['http://extension.org/functions#sqrt'](args);

                expect(mockDataFactory.literal).toHaveBeenCalledWith('3');
                expect(result).toEqual({ value: '3' });
            });

            it('should handle non-literal terms', () => {
                const args = [{ termType: 'IRI', value: 'http://example.org/iri' }];
                const result = extensionFunctions['http://extension.org/functions#sqrt'](args);

                expect(result).toBeUndefined();
                expect(mockDataFactory.literal).not.toHaveBeenCalled();
            });

            it('should handle decimal values', () => {
                mockDataFactory.literal.mockReturnValue({ value: '2.236067977499790' });

                const args = [{ termType: 'Literal', value: '5' }];
                extensionFunctions['http://extension.org/functions#sqrt'](args);

                expect(mockDataFactory.literal).toHaveBeenCalledWith('2.236067977499790');
            });
        });

        describe('pow function', () => {
            it('should calculate power for two literal terms', () => {
                mockDataFactory.literal.mockReturnValue({ value: '8' });

                const args = [
                    { termType: 'Literal', value: '2' },
                    { termType: 'Literal', value: '3' }
                ];
                const result = extensionFunctions['http://extension.org/functions#pow'](args);

                expect(mockDataFactory.literal).toHaveBeenCalledWith('8');
                expect(result).toEqual({ value: '8' });
            });

            it('should handle first argument not being literal', () => {
                const args = [
                    { termType: 'IRI', value: 'http://example.org/iri' },
                    { termType: 'Literal', value: '3' }
                ];
                const result = extensionFunctions['http://extension.org/functions#pow'](args);

                expect(result).toBeUndefined();
                expect(mockDataFactory.literal).not.toHaveBeenCalled();
            });

            it('should handle second argument not being literal', () => {
                const args = [
                    { termType: 'Literal', value: '2' },
                    { termType: 'IRI', value: 'http://example.org/iri' }
                ];
                const result = extensionFunctions['http://extension.org/functions#pow'](args);

                expect(result).toBeUndefined();
                expect(mockDataFactory.literal).not.toHaveBeenCalled();
            });

            it('should handle fractional powers', () => {
                mockDataFactory.literal.mockReturnValue({ value: '2.828427124746190' });

                const args = [
                    { termType: 'Literal', value: '8' },
                    { termType: 'Literal', value: '0.5' }
                ];
                extensionFunctions['http://extension.org/functions#pow'](args);

                expect(mockDataFactory.literal).toHaveBeenCalledWith('2.828427124746190');
            });
        });
    });

    describe('integration tests', () => {
        it('should work with complex SPARQL query and multiple static data', async () => {
            const complexQuery = `
                PREFIX ex: <http://example.org/>
                SELECT ?s ?avg WHERE {
                    ?s ex:hasValue ?value .
                    BIND(AVG(?value) AS ?avg)
                } GROUP BY ?s
            `;
            
            const operator = new R2ROperator(complexQuery);
            
            const staticQuad1 = { subject: 'ex:entity1', predicate: 'ex:type', object: 'ex:Sensor' };
            const staticQuad2 = { subject: 'ex:entity2', predicate: 'ex:type', object: 'ex:Sensor' };
            
            operator.addStaticData(staticQuad1 as any);
            operator.addStaticData(staticQuad2 as any);

            const streamStore = {
                getQuads: jest.fn().mockReturnValue([
                    { subject: 'ex:entity1', predicate: 'ex:hasValue', object: '10' },
                    { subject: 'ex:entity1', predicate: 'ex:hasValue', object: '20' }
                ])
            };

            mockQueryEngineInstance.queryBindings.mockResolvedValue([
                { 's': 'ex:entity1', 'avg': '15' }
            ]);

            const result = await operator.execute(streamStore);

            expect(result).toEqual([{ 's': 'ex:entity1', 'avg': '15' }]);
            expect(mockStore.addQuad).toHaveBeenCalledTimes(4); // 2 stream + 2 static
        });
    });
});
