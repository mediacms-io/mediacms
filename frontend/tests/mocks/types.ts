// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Type helper for creating mocked modules
 */
export type MockedModule<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? jest.MockedFunction<T[K]> : T[K];
};

/**
 * Type helper for creating spy objects
 */
export type SpyObject<T> = {
    [K in keyof T]: jest.SpyInstance;
};
