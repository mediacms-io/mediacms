/** @type {import("jest").Config} **/
module.exports = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.jsx?$': 'babel-jest',
    },
    collectCoverageFrom: ['src/**'],
};
