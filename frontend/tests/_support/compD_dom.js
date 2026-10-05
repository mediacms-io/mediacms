import { act } from 'react-dom/test-utils';

export function click(el) {
    act(() => {
        el.click();
    });
}

export function changeValue(el, value) {
    const proto = 'SELECT' === el.tagName ? HTMLSelectElement.prototype : 'TEXTAREA' === el.tagName ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    act(() => {
        setter.call(el, value);
        el.dispatchEvent(new Event('SELECT' === el.tagName ? 'change' : 'input', { bubbles: true }));
    });
}

export async function flush(rounds = 20) {
    await act(async () => {
        for (let i = 0; i < rounds; i++) {
            await Promise.resolve();
        }
    });
}

export function jsonResponse(body, ok = true) {
    return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
}

export function findByText(root, selector, text) {
    return Array.from(root.querySelectorAll(selector)).find((el) => (el.textContent || '').trim() === text);
}
