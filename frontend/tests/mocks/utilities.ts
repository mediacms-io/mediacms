// =============================================================================
// COMMON TEST UTILITIES
// =============================================================================

/**
 * Utility to flush microtasks (promises) in tests
 * Useful for testing async code that uses Promise.resolve().then()
 */
export const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Create a mock function with common testing patterns
 */
export const createMockFn = <T extends (...args: any[]) => any>(implementation?: T, name?: string) => {
    const mock = jest.fn(implementation);
    if (name) {
        mock.mockName(name);
    }
    return mock;
};

/**
 * Create a spy on an object method
 */
export const createSpy = <T extends object>(object: T, method: keyof T) => {
    return jest.spyOn(object, method as any);
};

// Note: resetAllMocks is defined in index.ts to avoid circular dependencies
