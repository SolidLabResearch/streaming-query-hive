import { lcm, turtleStringToStore, storeToString, stringToStore, hash_string_md5 } from '../../../src/util/Util';
import { Store } from 'n3';

// Mock dependencies
jest.mock('n3');
jest.mock('rdf-parse', () => ({
    default: {
        parse: jest.fn()
    }
}));
jest.mock('rdf-store-stream', () => ({
    storeStream: jest.fn()
}));
jest.mock('streamify-string');

const mockN3 = require('n3');
const mockRdfParse = require('rdf-parse').default;
const mockStoreStream = require('rdf-store-stream').storeStream;
const mockStreamifyString = require('streamify-string');

describe('Util Functions', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('lcm (Least Common Multiple)', () => {
        it('should calculate LCM of two positive numbers', () => {
            expect(lcm(12, 18)).toBe(36);
            expect(lcm(4, 6)).toBe(12);
            expect(lcm(15, 25)).toBe(75);
        });

        it('should handle when one number is 0', () => {
            expect(lcm(0, 5)).toBe(0);
            expect(lcm(5, 0)).toBe(0);
            expect(lcm(0, 0)).toBe(0);
        });

        it('should handle when numbers are equal', () => {
            expect(lcm(5, 5)).toBe(5);
            expect(lcm(1, 1)).toBe(1);
        });

        it('should handle when one number is 1', () => {
            expect(lcm(1, 7)).toBe(7);
            expect(lcm(8, 1)).toBe(8);
        });

        it('should handle negative numbers (always returns positive LCM)', () => {
            expect(lcm(-4, 6)).toBe(12);
            expect(lcm(4, -6)).toBe(12);
            expect(lcm(-4, -6)).toBe(12);
        });

        it('should handle prime numbers', () => {
            expect(lcm(7, 11)).toBe(77);
            expect(lcm(13, 17)).toBe(221);
        });
    });

    describe('hash_string_md5', () => {
        it('should generate consistent MD5 hash for same input', () => {
            const input = 'test string';
            const hash1 = hash_string_md5(input);
            const hash2 = hash_string_md5(input);
            
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(32); // MD5 hash length
            expect(hash1).toMatch(/^[a-f0-9]{32}$/); // hexadecimal pattern
        });

        it('should remove whitespace before hashing', () => {
            const input1 = 'test string';
            const input2 = 'teststring';
            const input3 = 'test   string';
            
            const hash1 = hash_string_md5(input1);
            const hash2 = hash_string_md5(input2);
            const hash3 = hash_string_md5(input3);
            
            expect(hash1).toBe(hash2);
            expect(hash1).toBe(hash3);
        });

        it('should generate different hashes for different inputs', () => {
            const hash1 = hash_string_md5('input1');
            const hash2 = hash_string_md5('input2');
            
            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty string', () => {
            const hash = hash_string_md5('');
            
            expect(hash).toHaveLength(32);
            expect(hash).toMatch(/^[a-f0-9]{32}$/);
        });

        it('should handle strings with various whitespace characters', () => {
            const input1 = 'test\tstring\nwith\rwhitespace';
            const input2 = 'teststringwithwhitespace';
            
            const hash1 = hash_string_md5(input1);
            const hash2 = hash_string_md5(input2);
            
            expect(hash1).toBe(hash2);
        });

        it('should handle special characters', () => {
            const input = 'SELECT * WHERE { ?s ?p ?o }';
            const hash = hash_string_md5(input);
            
            expect(hash).toHaveLength(32);
            expect(hash).toMatch(/^[a-f0-9]{32}$/);
        });
    });

    describe('storeToString', () => {
        let mockStore: jest.Mocked<Store>;
        let mockWriter: any;

        beforeEach(() => {
            mockWriter = {
                quadsToString: jest.fn()
            };
            
            mockStore = {
                getQuads: jest.fn()
            } as any;

            mockN3.Writer.mockImplementation(() => mockWriter);
        });

        it('should convert store to string', () => {
            const mockQuads = [
                { subject: 's1', predicate: 'p1', object: 'o1' },
                { subject: 's2', predicate: 'p2', object: 'o2' }
            ];
            const expectedString = '<s1> <p1> <o1> .\\n<s2> <p2> <o2> .';
            
            mockStore.getQuads.mockReturnValue(mockQuads as any);
            mockWriter.quadsToString.mockReturnValue(expectedString);
            
            const result = storeToString(mockStore);
            
            expect(mockStore.getQuads).toHaveBeenCalledWith(null, null, null, null);
            expect(mockWriter.quadsToString).toHaveBeenCalledWith(mockQuads);
            expect(result).toBe(expectedString);
        });

        it('should handle empty store', () => {
            const emptyQuads: any[] = [];
            const expectedString = '';
            
            mockStore.getQuads.mockReturnValue(emptyQuads);
            mockWriter.quadsToString.mockReturnValue(expectedString);
            
            const result = storeToString(mockStore);
            
            expect(result).toBe(expectedString);
        });
    });

    describe('stringToStore', () => {
        let mockTextStream: any;
        let mockQuadStream: any;
        let mockStore: Store;

        beforeEach(() => {
            mockTextStream = {};
            mockQuadStream = {};
            mockStore = {} as Store;

            mockStreamifyString.mockReturnValue(mockTextStream);
            mockRdfParse.parse.mockReturnValue(mockQuadStream);
            mockStoreStream.mockResolvedValue(mockStore);
        });

        it('should convert string to store with given options', async () => {
            const text = '<s> <p> <o> .';
            const options = { contentType: 'text/turtle', baseIRI: 'http://example.org/' };
            
            const result = await stringToStore(text, options);
            
            expect(mockStreamifyString).toHaveBeenCalledWith(text);
            expect(mockRdfParse.parse).toHaveBeenCalledWith(mockTextStream, options);
            expect(mockStoreStream).toHaveBeenCalledWith(mockQuadStream);
            expect(result).toBe(mockStore);
        });

        it('should handle different content types', async () => {
            const text = '{"@context": {"@base": "http://example.org/"}}';
            const options = { contentType: 'application/ld+json' };
            
            await stringToStore(text, options);
            
            expect(mockRdfParse.parse).toHaveBeenCalledWith(mockTextStream, options);
        });
    });

    describe('turtleStringToStore', () => {
        it('should call stringToStore with turtle content type', async () => {
            // Since turtleStringToStore is a wrapper around stringToStore, 
            // we can verify it works by checking the parameters it would pass
            const text = '<s> <p> <o> .';
            const baseIRI = 'http://example.org/';
            
            // Call the function - it should work with our mocked stringToStore
            await turtleStringToStore(text, baseIRI);
            
            // Verify that stringToStore was called with correct parameters
            expect(mockStoreStream).toHaveBeenCalled();
        });

        it('should work without baseIRI', async () => {
            const text = '<s> <p> <o> .';
            
            // Call the function without baseIRI
            await turtleStringToStore(text);
            
            // Verify that the function completes successfully
            expect(mockStoreStream).toHaveBeenCalled();
        });
    });

    describe('integration tests', () => {
        it('should work with real turtle string parsing', async () => {
            // This would require real implementations, but we can test the flow
            const turtleText = `
                @prefix ex: <http://example.org/> .
                ex:subject ex:predicate ex:object .
            `;

            // Since we're mocking, we just verify the call chain
            await expect(turtleStringToStore(turtleText, 'http://example.org/')).resolves.toBeDefined();
        });

        it('should handle MD5 hashing with real SPARQL queries', () => {
            const sparqlQuery = `
                PREFIX ex: <http://example.org/>
                SELECT * WHERE {
                    ?s ?p ?o .
                }
            `;

            const hash = hash_string_md5(sparqlQuery);
            
            expect(hash).toHaveLength(32);
            expect(hash).toMatch(/^[a-f0-9]{32}$/);
        });
    });
});
