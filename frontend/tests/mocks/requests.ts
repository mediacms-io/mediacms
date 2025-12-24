// =============================================================================
// MOCKS FOR requests.test.ts
// =============================================================================
import axios from 'axios';

/**
 * Mock axios for HTTP request testing
 * Provides mocked versions of get, post, put, delete methods
 */
jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(() => Promise.resolve({ data: {} })),
        post: jest.fn(() => Promise.resolve({ data: {} })),
        put: jest.fn(() => Promise.resolve({ data: {} })),
        delete: jest.fn(() => Promise.resolve({ data: {} })),
    },
}));

/**
 * Type-safe mocked axios instance for use in tests
 */
export const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Utility to flush microtasks (promises) in async tests
 */
export const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Reset all axios mocks before each test
 */
export const resetAxiosMocks = () => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.delete.mockReset();
};
