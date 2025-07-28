/**
 * A consistent logger utility that only outputs debug messages in development
 * but always shows errors, warnings, and info messages.
 */
const logger = {
    /**
     * Logs debug messages only in development environment
     */
    debug: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(...args);
        }
    },

    /**
     * Always logs error messages
     */
    error: (...args: any[]) => console.error(...args),

    /**
     * Always logs warning messages
     */
    warn: (...args: any[]) => console.warn(...args),

    /**
     * Always logs info messages
     */
    info: (...args: any[]) => console.info(...args),
};

export default logger;
