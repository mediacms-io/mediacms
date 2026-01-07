// Mock the './log' module used by errors.ts to capture calls without console side effects
jest.mock('../../../src/static/js/utils/helpers/log', () => ({ error: jest.fn(), warn: jest.fn() }));

import { logErrorAndReturnError, logWarningAndReturnError } from '../../../src/static/js/utils/helpers/errors';
import { error as mockedError, warn as mockedWarn } from '../../../src/static/js/utils/helpers/log';

describe('js/utils/helpers', () => {
    describe('errors', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('logErrorAndReturnError returns Error with first message and logs with error', () => {
            const messages = ['Primary msg', 'details', 'more'];
            const err = logErrorAndReturnError(messages);
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('Primary msg');
            expect(mockedError).toHaveBeenCalledTimes(1);
            expect(mockedError).toHaveBeenCalledWith(...messages);
        });

        test('logWarningAndReturnError returns Error with first message and logs with warn', () => {
            const messages = ['Primary msg', 'details', 'more'];
            const err = logWarningAndReturnError(messages);
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('Primary msg');
            expect(mockedWarn).toHaveBeenCalledTimes(1);
            expect(mockedWarn).toHaveBeenCalledWith(...messages);
        });

        test('Handles empty array creating an Error with undefined message and logs called with no args', () => {
            const messages: string[] = [];

            const err1 = logErrorAndReturnError(messages);
            expect(err1).toBeInstanceOf(Error);
            expect(err1.message).toBe('');
            expect(mockedError).toHaveBeenCalledWith('');

            jest.clearAllMocks();

            const err2 = logWarningAndReturnError(messages);
            expect(err2).toBeInstanceOf(Error);
            expect(err2.message).toBe('');
            expect(mockedWarn).toHaveBeenCalledWith('');
        });
    });
});
