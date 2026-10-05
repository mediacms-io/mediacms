/** @type {import("jest").Config} **/
module.exports = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.jsx?$': 'babel-jest',
    },
    moduleNameMapper: {
        '(^\\.\\./|/utils/)dispatcher(\\.js)?$': '<rootDir>/tests/_support/flatDispatcher.js',
        '\\.(css|scss|sass)$': '<rootDir>/tests/_support/styleMock.js',
        '\\.(svg|png|jpe?g|gif|woff2?)$': '<rootDir>/tests/_support/fileMock.js',
    },
    maxWorkers: '25%',
    collectCoverageFrom: ['src/**'],
};
