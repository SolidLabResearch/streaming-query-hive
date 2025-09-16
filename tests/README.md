# Tests

This directory contains the test suite for the Streaming Query Hive project.

## Structure

### Unit Tests (`tests/unit/`)

The unit tests are organized to mirror the structure of the `src/` directory:

- `tests/unit/services/` - Tests for service classes
  - `server/` - HTTP server related tests
  - `operators/` - Stream processing operator tests
- `tests/unit/orchestrator/` - Tests for orchestrator classes
- `tests/unit/util/` - Tests for utility functions

### Existing Tests (`src/**/*.test.ts`)

The project also contains co-located test files directly in the source directory:
- Agent tests: `src/agent/RSPAgent.test.ts`
- Service tests: `src/services/*.test.ts`
- Operator tests: `src/services/operators/*.test.ts`
- RSP tests: `src/rsp/RSPQueryProcess.test.ts`
- Parser tests: `src/util/parser/RSPQLParser.test.ts`

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test files
npm test -- HTTPServer.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="Orchestrator"
```

## Test Coverage

The test configuration is set up to collect coverage from:
- All TypeScript/JavaScript files in `src/`
- Excluding test files and type definitions
- Excluding the `src/test.ts` file

Coverage reports are generated in:
- Terminal output (text format)
- `coverage/lcov.info` (LCOV format)
- `coverage/index.html` (HTML report)

## Writing Tests

### Test File Naming

- Unit tests should be named `*.test.ts`
- Test files should be placed either:
  - Co-located with source files (existing pattern)
  - In the `tests/unit/` directory mirroring the source structure

### Test Structure

```typescript
import { MyClass } from '../../../src/path/to/MyClass';

describe('MyClass', () => {
    let instance: MyClass;
    
    beforeEach(() => {
        instance = new MyClass();
    });
    
    describe('methodName', () => {
        it('should do something specific', () => {
            // Test implementation
        });
    });
});
```

### Mocking

The project uses Jest's built-in mocking capabilities:

```typescript
// Mock external dependencies
jest.mock('external-library');

// Mock internal modules
jest.mock('../../../src/path/to/dependency');
```

## Test Files Added

The following new test files have been created:

1. **HTTPServer.test.ts** - Tests for the HTTP server functionality
   - Constructor validation
   - Logger integration
   - Query record management

2. **Orchestrator.test.ts** - Tests for the main orchestrator class
   - Sub-query management
   - Registered query handling
   - BeeKeeper integration
   - Error handling

3. **Util.test.ts** - Tests for utility functions
   - LCM calculation
   - MD5 hashing
   - RDF store operations
   - Turtle string parsing

4. **r2r.test.ts** - Tests for the R2R (Result-to-Result) operator
   - Static data management
   - Query execution
   - Extension functions (sqrt, pow)
   - Stream store integration

5. **startHTTPServer.test.ts** - Tests for the HTTP server startup module
   - Timestamp formatting
   - Logger configuration
   - File stream setup
   - Error handling

## Notes

- Tests are configured with a 30-second timeout for async operations
- The test environment is set to Node.js
- Coverage collection excludes test files and type definitions
- Both co-located and separate test directories are supported