import React from 'react';
import { render } from '@testing-library/react';
import { useMediaFilter } from '../../../src/static/js/utils/hooks/useMediaFilter';

jest.mock('../../../src/static/js/components/_shared/popup/PopupContent', () => ({
    PopupContent: (props: any) => React.createElement('div', props, props.children),
}));

jest.mock('../../../src/static/js/components/_shared/popup/PopupTrigger', () => ({
    PopupTrigger: (props: any) => React.createElement('div', props, props.children),
}));

function HookConsumer({ initial }: { initial: string }) {
    const tuple = useMediaFilter(initial) as [
        React.RefObject<any>,
        string,
        React.Dispatch<React.SetStateAction<string>>,
        React.RefObject<any>,
        React.ReactNode,
        React.ReactNode,
    ];

    const [containerRef, value, setValue, popupContentRef, PopupContent, PopupTrigger] = tuple;

    return (
        <div>
            <div data-testid="container-ref">{containerRef && typeof containerRef === 'object' ? 'ok' : 'bad'}</div>
            <div data-testid="value">{value}</div>
            <button data-testid="set" onClick={() => setValue('updated')} />
            <div data-testid="popup-ref">{popupContentRef && typeof popupContentRef === 'object' ? 'ok' : 'bad'}</div>
            {typeof PopupContent === 'function' ? React.createElement(PopupContent, null, 'c') : null}
            {typeof PopupTrigger === 'function' ? React.createElement(PopupTrigger, null, 't') : null}
        </div>
    );
}

describe('utils/hooks', () => {
    describe('useMediaFilter', () => {
        test('Returns a 6-tuple in expected order', () => {
            let tuple: any;

            const Comp: React.FC = () => {
                tuple = useMediaFilter('init');
                return null;
            };

            render(<Comp />);

            expect(Array.isArray(tuple)).toBe(true);
            expect(tuple).toHaveLength(6);

            const [containerRef, value, setValue, popupContentRef, PopupContent, PopupTrigger] = tuple;

            expect(containerRef).toBeDefined();
            expect(containerRef.current).toBe(null);
            expect(value).toBe('init');
            expect(typeof setValue).toBe('function');
            expect(popupContentRef).toBeDefined();
            expect(typeof PopupContent).toBe('function');
            expect(typeof PopupTrigger).toBe('function');
        });

        test('Initial value is respected and can be updated via setter', () => {
            const { getByTestId } = render(<HookConsumer initial="first" />);
            expect(getByTestId('value').textContent).toBe('first');
            getByTestId('set').click();
            expect(getByTestId('value').textContent).toBe('updated');
        });

        test('containerRef and popupContentRef are mutable ref objects', () => {
            let data: any;

            const Comp: React.FC = () => {
                data = useMediaFilter('x');
                return null;
            };

            render(<Comp />);

            const [containerRef, _value, _setValue, popupContentRef] = data;

            expect(containerRef.current).toBe(null);
            expect(popupContentRef.current).toBe(null);
        });

        test('PopupContent and PopupTrigger are stable functions', () => {
            let first: any;
            let second: any;

            const First: React.FC = () => {
                first = useMediaFilter('a');
                return null;
            };

            const Second: React.FC = () => {
                second = useMediaFilter('b');
                return null;
            };

            const Parent: React.FC = () => (
                <>
                    <First />
                    <Second />
                </>
            );

            render(<Parent />);

            const [, , , , PopupContent1, PopupTrigger1] = first;
            const [, , , , PopupContent2, PopupTrigger2] = second;

            expect(typeof PopupContent1).toBe('function');
            expect(typeof PopupTrigger1).toBe('function');

            expect(PopupContent1).toBe(PopupContent2);
            expect(PopupTrigger1).toBe(PopupTrigger2);
        });
    });
});
