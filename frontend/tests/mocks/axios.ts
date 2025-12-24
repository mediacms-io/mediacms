// =============================================================================
// AXIOS MOCKING
// =============================================================================
import axios from 'axios';

/**
 * Mock implementation for axios HTTP client
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
 * Common mock response shapes for different scenarios
 */
export const mockResponses = {
    success: { data: { success: true }, status: 200 },
    error: { data: { error: 'Something went wrong' }, status: 500 },
    unauthorized: { data: { error: 'Unauthorized' }, status: 401 },
    notFound: { data: { error: 'Not found' }, status: 404 },
    networkError: new Error('Network Error'),
};

/**
 * Setup axios to return specific responses for testing
 */
export const setupAxiosResponses = {
    success: () => {
        mockedAxios.get.mockResolvedValueOnce(mockResponses.success);
    },
    error: () => {
        mockedAxios.get.mockRejectedValueOnce(mockResponses.error);
    },
    networkError: () => {
        mockedAxios.get.mockRejectedValueOnce(mockResponses.networkError);
    },
    unauthorized: () => {
        mockedAxios.get.mockRejectedValueOnce(mockResponses.unauthorized);
    },
    notFound: () => {
        mockedAxios.get.mockRejectedValueOnce(mockResponses.notFound);
    },
};
