import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

export function renderIntoContainer(element: React.ReactNode) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
        root.render(element);
    });

    return {
        container,
        rerender(next: React.ReactNode) {
            act(() => {
                root.render(next);
            });
        },
        unmount() {
            act(() => {
                root.unmount();
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
