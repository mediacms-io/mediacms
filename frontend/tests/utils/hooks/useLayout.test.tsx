import React from 'react';
import { act, render } from '@testing-library/react';

import { useLayout } from '../../../src/static/js/utils/hooks/useLayout';

jest.mock('../../../src/static/js/utils/classes/', () => ({
    BrowserCache: jest.fn().mockImplementation(() => ({
        get: (key: string) => {
            let result: any = undefined;
            switch (key) {
                case 'visible-sidebar':
                    result = true;
                    break;
            }
            return result;
        },
        set: jest.fn(),
    })),
}));

jest.mock('../../../src/static/js/utils/dispatcher.js', () => ({
    register: jest.fn(),
}));

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

import { LayoutProvider } from '../../../src/static/js/utils/contexts';

describe('utils/hooks', () => {
    describe('useLayout', () => {
        test('Returns default value', () => {
            let received: ReturnType<typeof useLayout> | undefined;

            const Comp: React.FC = () => {
                received = useLayout();
                return null;
            };

            render(
                <LayoutProvider>
                    <Comp />
                </LayoutProvider>
            );

            expect(received).toStrictEqual({
                enabledSidebar: false,
                visibleSidebar: true,
                visibleMobileSearch: false,
                setVisibleSidebar: expect.any(Function),
                toggleMobileSearch: expect.any(Function),
                toggleSidebar: expect.any(Function),
            });
        });

        test('Returns undefined value when used without a Provider', () => {
            let received: any = 'init';

            const Comp: React.FC = () => {
                received = useLayout();
                return null;
            };

            render(<Comp />);

            expect(received).toBe(undefined);
        });

        test('Toggle sidebar', () => {
            jest.useFakeTimers();

            let received: ReturnType<typeof useLayout> | undefined;

            const Comp: React.FC = () => {
                received = useLayout();
                return null;
            };

            render(
                <LayoutProvider>
                    <Comp />
                </LayoutProvider>
            );

            act(() => received?.toggleSidebar());
            jest.advanceTimersByTime(241);
            expect(received?.visibleSidebar).toBe(false);

            act(() => received?.toggleSidebar());
            jest.advanceTimersByTime(241);
            expect(received?.visibleSidebar).toBe(true);

            jest.useRealTimers();
        });

        test('Toggle mobile search', () => {
            let received: ReturnType<typeof useLayout> | undefined;

            const Comp: React.FC = () => {
                received = useLayout();
                return null;
            };

            render(
                <LayoutProvider>
                    <Comp />
                </LayoutProvider>
            );

            act(() => received?.toggleMobileSearch());
            expect(received?.visibleMobileSearch).toBe(true);

            act(() => received?.toggleMobileSearch());
            expect(received?.visibleMobileSearch).toBe(false);
        });
    });
});
