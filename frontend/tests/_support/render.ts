import React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const legacyReactDOM = ReactDOM as any;

export function renderIntoContainer(element: any) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    act(() => {
        legacyReactDOM.render(element, container);
    });

    return {
        container,
        rerender(next: any) {
            act(() => {
                legacyReactDOM.render(next, container);
            });
        },
        unmount() {
            act(() => {
                legacyReactDOM.unmountComponentAtNode(container);
            });
            container.remove();
        },
    };
}

export function renderHook<T>(hook: () => T) {
    const result = { current: undefined as unknown as T };

    function Probe() {
        result.current = hook();
        return null;
    }

    const view = renderIntoContainer(React.createElement(Probe));
    return { ...view, result, rerender: () => view.rerender(React.createElement(Probe)) };
}

export { act };
