# Folder Structure

This document describes the cleaned up folder structure of the streaming-query-hive project.

## Core Application Structure

### `src/` - Main Source Code
- `approaches/` - Stream processing approaches (IndependentStreamProcessingApproach, etc.)
- `agent/` - RSP agents and related components
- `services/` - Core services (BeeKeeper, operators, etc.)
- `orchestrator/` - Orchestration logic
- `rsp/` - RSP-specific components
- `streamer/` - Stream handling and MQTT publishing
- `util/` - Utility functions and parsers
- `config/` - Configuration files

### `examples/` - Working Examples
- `independent-full-processing-demo.ts` - Complete working demo
- `complete-publisher-processor-demo.ts` - Full pipeline demo

### `test/` - Test Files
- `legacy/` - Old test files from root directory
- `unit/` - Unit tests

## Development and Analysis Tools

### `tools/` - Analysis and Development Tools
- `experiments/` - Experiment scripts and runners
- `analysis/` - Analysis scripts and tools
- `legacy-analysis/` - Historical analysis files
- `analysis-py/` - Python analysis scripts
- `scripts/` - Python utility scripts
- `tests/` - Legacy test files
- `temp-results/` - Temporary data and results
- `experiment-logs/` - Historical experiment logs

### `scripts/` - Build and Utility Scripts
- `remove-emojis.js` - Emoji cleanup script

## Documentation and Configuration

### `docs/` - Documentation
- Project documentation and integration guides

### `images/` - Project Images
- Architecture diagrams and visualizations

## Build and Dependencies

### `dist/` - Compiled Output
- TypeScript compiled JavaScript files
- Generated declaration files

### Configuration Files (Root)
- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Jest testing configuration
- `.eslintrc.js` - ESLint configuration
- `esdoc.json` - Documentation generation config

## Key Features of New Structure

1. **Separated concerns**: Source code, tests, tools, and experiments are clearly separated
2. **Reduced duplication**: Consolidated duplicate analysis files
3. **Logical grouping**: Related files are grouped together
4. **Clean root**: Moved test files and temporary data out of root directory
5. **Tool organization**: All analysis and experiment tools are under `tools/`

## Usage

- **Core development**: Work in `src/` and `examples/`
- **Testing**: Use `test/` directory
- **Analysis**: Use scripts in `tools/analysis/` and `tools/experiments/`
- **Documentation**: Refer to `docs/` and this README
