/** @type {import("jest").Config} **/
module.exports = {
    testEnvironment: 'jsdom',
    setupFiles: ['<rootDir>/tests/_support/jestSetup.js'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.jsx?$': 'babel-jest',
    },
    moduleNameMapper: {
        '\\.(css|scss|sass)$': '<rootDir>/tests/_support/styleMock.js',
        '\\.(svg|png|jpe?g|gif|woff2?)$': '<rootDir>/tests/_support/fileMock.js',
    },
    maxWorkers: '25%',
    collectCoverageFrom: ['src/**'],
};
