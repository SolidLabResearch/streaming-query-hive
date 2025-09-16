module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: [
        '**/tests/**/*.test.{ts,js}',
        '**/src/**/*.test.{ts,js}'
    ],
    collectCoverageFrom: [
        'src/**/*.{ts,js}',
        '!src/**/*.test.{ts,js}',
        '!src/**/*.d.ts',
        '!src/test.ts'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: [],
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    testTimeout: 30000
};
