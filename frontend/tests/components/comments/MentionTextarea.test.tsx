import React, { useState } from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import {
    MentionTextarea as MentionTextareaComponent,
    applyPlainTextChange,
    diffText,
    filterMentionUsers,
    findMentionQuery,
    mentionMarkup,
    parseMentions,
} from '../../../src/static/js/components/comments/MentionTextarea';

const MentionTextarea = MentionTextareaComponent as any;

const USERS = [
    { id: 'alice', display: 'Alice Liddell' },
    { id: 'bob', display: 'Bob Builder' },
    { id: 'alfred', display: 'Alfred Pennyworth' },
    { id: 'noname', display: '' },
];

function setup(initial = '', users = USERS) {
    const onChange = jest.fn();
    const inputRef = React.createRef<HTMLTextAreaElement>();
    let current = initial;

    function Harness() {
        const [value, setValue] = useState(initial);
        return (
            <MentionTextarea
                inputRef={inputRef}
                className="form-textarea"
                rows="1"
                placeholder="Add a comment..."
                value={value}
                users={users}
                onChange={(event: any, next: string, plain: string) => {
                    current = next;
                    onChange(event, next, plain);
                    setValue(next);
                }}
            />
        );
    }

    const view = renderIntoContainer(<Harness />);
    const textarea = view.container.querySelector('textarea') as HTMLTextAreaElement;

    return {
        ...view,
        textarea,
        inputRef,
        onChange,
        value: () => current,
        suggestions: () =>
            Array.from(view.container.querySelectorAll('.form-textarea__suggestions__item')).map((li) => li.textContent),
        focused: () => view.container.querySelector('.form-textarea__suggestions__item--focused')?.textContent,
    };
}

const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;

function edit(textarea: HTMLTextAreaElement, text: string, caret = text.length) {
    act(() => {
        valueSetter.call(textarea, text);
        textarea.setSelectionRange(caret, caret);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function typeAtCaret(textarea: HTMLTextAreaElement, chars: string) {
    const pos = textarea.selectionEnd;
    edit(textarea, textarea.value.slice(0, pos) + chars + textarea.value.slice(pos), pos + chars.length);
}

function backspace(textarea: HTMLTextAreaElement) {
    const pos = textarea.selectionEnd;
    edit(textarea, textarea.value.slice(0, pos - 1) + textarea.value.slice(pos), pos - 1);
}

function key(textarea: HTMLTextAreaElement, keyName: string) {
    const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true });
    act(() => {
        textarea.dispatchEvent(event);
    });
    return event;
}

describe('components/comments/MentionTextarea', () => {
    describe('helpers', () => {
        test('mentionMarkup produces the format parsed by the backend', () => {
            expect(mentionMarkup('alice', 'Alice Liddell')).toBe('@(_alice_)[_Alice Liddell_]');
            expect(/@\(_(.+?)_\)/.exec(mentionMarkup('alice', 'Alice Liddell'))![1]).toBe('alice');
        });

        test('parseMentions maps markup to display text and positions', () => {
            const parsed = parseMentions('hi @(_alice_)[_Alice_] and @(_bob_)[_Bob B_]!');
            expect(parsed.plainText).toBe('hi Alice and Bob B!');
            expect(parsed.mentions).toEqual([
                { id: 'alice', display: 'Alice', plainStart: 3, plainEnd: 8, markupStart: 3, markupEnd: 22 },
                { id: 'bob', display: 'Bob B', plainStart: 13, plainEnd: 18, markupStart: 27, markupEnd: 44 },
            ]);
        });

        test('parseMentions keeps plain text untouched', () => {
            expect(parseMentions('just @ text (_x_) [_y_]')).toEqual({ plainText: 'just @ text (_x_) [_y_]', mentions: [] });
        });

        test('diffText finds the edited range, using the caret to resolve repeated characters', () => {
            expect(diffText('abc', 'abXc', 3)).toEqual({ start: 2, end: 2, inserted: 'X' });
            expect(diffText('aa', 'aaa', 1)).toEqual({ start: 0, end: 0, inserted: 'a' });
            expect(diffText('aa', 'aaa', 3)).toEqual({ start: 2, end: 2, inserted: 'a' });
            expect(diffText('hello', 'heo', 2)).toEqual({ start: 2, end: 4, inserted: '' });
            expect(diffText('hello', 'hXYo', 3)).toEqual({ start: 1, end: 4, inserted: 'XY' });
        });

        test('applyPlainTextChange edits text around mentions and removes touched mentions entirely', () => {
            const markup = 'a @(_bob_)[_Bob_] z';
            const parsed = parseMentions(markup);
            expect(applyPlainTextChange(markup, parsed, 1, 1, '!')).toEqual({ markup: 'a! @(_bob_)[_Bob_] z', caret: 2 });
            expect(applyPlainTextChange(markup, parsed, 5, 5, '!')).toEqual({ markup: 'a @(_bob_)[_Bob_]! z', caret: 6 });
            expect(applyPlainTextChange(markup, parsed, 2, 2, '!')).toEqual({ markup: 'a !@(_bob_)[_Bob_] z', caret: 3 });
            expect(applyPlainTextChange(markup, parsed, 4, 5, '')).toEqual({ markup: 'a  z', caret: 2 });
            expect(applyPlainTextChange(markup, parsed, 3, 3, 'x')).toEqual({ markup: 'a x z', caret: 3 });
            expect(applyPlainTextChange(markup, parsed, 0, 7, 'new')).toEqual({ markup: 'new', caret: 3 });
        });

        test('findMentionQuery detects an @ query before the caret', () => {
            expect(findMentionQuery(parseMentions('@'), 1)).toEqual({ triggerIndex: 0, query: '' });
            expect(findMentionQuery(parseMentions('hi @al'), 6)).toEqual({ triggerIndex: 3, query: 'al' });
            expect(findMentionQuery(parseMentions('hi @al there'), 6)).toEqual({ triggerIndex: 3, query: 'al' });
            expect(findMentionQuery(parseMentions('mail@al'), 7)).toBeNull();
            expect(findMentionQuery(parseMentions('hi @al there'), 12)).toBeNull();
            expect(findMentionQuery(parseMentions('x @(_bob_)[_Bob_]'), 5)).toBeNull();
        });

        test('filterMentionUsers matches display name or username, case insensitive', () => {
            expect(filterMentionUsers(USERS, '').map((u: any) => u.id)).toEqual(['alice', 'bob', 'alfred', 'noname']);
            expect(filterMentionUsers(USERS, 'AL').map((u: any) => u.id)).toEqual(['alice', 'alfred']);
            expect(filterMentionUsers(USERS, 'builder').map((u: any) => u.id)).toEqual(['bob']);
            expect(filterMentionUsers(USERS, 'nonam').map((u: any) => u.id)).toEqual(['noname']);
            expect(filterMentionUsers(USERS, 'zzz')).toEqual([]);
        });
    });

    describe('component', () => {
        test('Renders a textarea with the passed props and exposes it through inputRef', () => {
            const { textarea, inputRef, container, unmount } = setup();
            expect(inputRef.current).toBe(textarea);
            expect(textarea.className).toBe('form-textarea__input');
            expect(textarea.getAttribute('rows')).toBe('1');
            expect(textarea.getAttribute('placeholder')).toBe('Add a comment...');
            expect(container.firstElementChild?.className).toBe('form-textarea');
            expect(container.querySelector('.form-textarea__suggestions')).toBeNull();
            unmount();
        });

        test('Plain text without mentions is passed through unchanged', () => {
            const { textarea, onChange, value, suggestions, unmount } = setup();
            edit(textarea, 'hello world, mail me at a@b.c');
            expect(value()).toBe('hello world, mail me at a@b.c');
            expect(textarea.value).toBe('hello world, mail me at a@b.c');
            expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 'hello world, mail me at a@b.c', 'hello world, mail me at a@b.c');
            expect(suggestions()).toEqual([]);
            unmount();
        });

        test('Typing @ shows all users and further letters filter them', () => {
            const { textarea, suggestions, container, unmount } = setup();
            edit(textarea, 'hi @');
            expect(suggestions()).toEqual(['Alice Liddell', 'Bob Builder', 'Alfred Pennyworth', 'noname']);
            typeAtCaret(textarea, 'a');
            typeAtCaret(textarea, 'l');
            expect(suggestions()).toEqual(['Alice Liddell', 'Alfred Pennyworth']);
            expect(container.querySelector('[role="listbox"]')).not.toBeNull();
            typeAtCaret(textarea, 'z');
            expect(suggestions()).toEqual([]);
            unmount();
        });

        test('Arrow keys move the focused suggestion with wrap around and Enter selects it', () => {
            const { textarea, suggestions, focused, value, unmount } = setup();
            edit(textarea, 'hey @al');
            expect(suggestions()).toEqual(['Alice Liddell', 'Alfred Pennyworth']);
            expect(focused()).toBe('Alice Liddell');
            expect(key(textarea, 'ArrowDown').defaultPrevented).toBe(true);
            expect(focused()).toBe('Alfred Pennyworth');
            expect(textarea.getAttribute('aria-activedescendant')).toMatch(/-1$/);
            key(textarea, 'ArrowDown');
            expect(focused()).toBe('Alice Liddell');
            key(textarea, 'ArrowUp');
            expect(focused()).toBe('Alfred Pennyworth');
            expect(key(textarea, 'Enter').defaultPrevented).toBe(true);
            expect(value()).toBe('hey @(_alfred_)[_Alfred Pennyworth_]');
            expect(textarea.value).toBe('hey Alfred Pennyworth');
            expect(textarea.selectionEnd).toBe('hey Alfred Pennyworth'.length);
            expect(suggestions()).toEqual([]);
            unmount();
        });

        test('Tab selects the focused suggestion', () => {
            const { textarea, value, unmount } = setup();
            edit(textarea, '@bo');
            expect(key(textarea, 'Tab').defaultPrevented).toBe(true);
            expect(value()).toBe('@(_bob_)[_Bob Builder_]');
            unmount();
        });

        test('Clicking a suggestion selects it', () => {
            const { textarea, container, value, unmount } = setup();
            edit(textarea, 'ping @');
            const items = container.querySelectorAll('.form-textarea__suggestions__item');
            const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
            act(() => {
                items[1].dispatchEvent(mouseDown);
            });
            expect(mouseDown.defaultPrevented).toBe(true);
            act(() => {
                items[1].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                (items[1] as HTMLElement).click();
            });
            expect(value()).toBe('ping @(_bob_)[_Bob Builder_]');
            unmount();
        });

        test('A user without a display name is inserted with the username', () => {
            const { textarea, value, unmount } = setup();
            edit(textarea, '@nonam');
            key(textarea, 'Enter');
            expect(value()).toBe('@(_noname_)[_noname_]');
            expect(textarea.value).toBe('noname');
            unmount();
        });

        test('Escape closes the suggestions and keys behave normally afterwards', () => {
            const { textarea, suggestions, value, unmount } = setup();
            edit(textarea, '@a');
            expect(key(textarea, 'Escape').defaultPrevented).toBe(true);
            expect(suggestions()).toEqual([]);
            expect(key(textarea, 'Enter').defaultPrevented).toBe(false);
            expect(value()).toBe('@a');
            typeAtCaret(textarea, 'l');
            expect(suggestions()).toEqual(['Alice Liddell', 'Alfred Pennyworth']);
            unmount();
        });

        test('Keys are forwarded to onKeyDown when no suggestion list is open', () => {
            const onKeyDown = jest.fn();
            function Harness() {
                const [value, setValue] = useState('');
                return (
                    <MentionTextarea className="x" value={value} users={USERS} onChange={(e: any, v: string) => setValue(v)} onKeyDown={onKeyDown} />
                );
            }
            const { container, unmount } = renderIntoContainer(<Harness />);
            const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
            key(textarea, 'Enter');
            expect(onKeyDown).toHaveBeenCalledTimes(1);
            edit(textarea, '@');
            key(textarea, 'ArrowDown');
            expect(onKeyDown).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Blur closes the suggestions and calls onBlur', () => {
            const onBlur = jest.fn();
            function Harness() {
                const [value, setValue] = useState('');
                return <MentionTextarea className="x" value={value} users={USERS} onChange={(e: any, v: string) => setValue(v)} onBlur={onBlur} />;
            }
            const { container, unmount } = renderIntoContainer(<Harness />);
            const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
            act(() => textarea.focus());
            edit(textarea, '@');
            expect(container.querySelectorAll('.x__suggestions__item').length).toBe(4);
            act(() => textarea.blur());
            expect(container.querySelectorAll('.x__suggestions__item').length).toBe(0);
            expect(onBlur).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Multiple mentions mixed with text produce the expected markup', () => {
            const { textarea, value, container, unmount } = setup();
            edit(textarea, 'cc @ali');
            key(textarea, 'Enter');
            typeAtCaret(textarea, ' and @bu');
            key(textarea, 'Enter');
            typeAtCaret(textarea, ' thanks');
            expect(value()).toBe('cc @(_alice_)[_Alice Liddell_] and @(_bob_)[_Bob Builder_] thanks');
            expect(textarea.value).toBe('cc Alice Liddell and Bob Builder thanks');
            expect(Array.from(container.querySelectorAll('.form-textarea__highlighter strong')).map((s) => s.textContent)).toEqual([
                'Alice Liddell',
                'Bob Builder',
            ]);
            unmount();
        });

        test('Inserting a mention in the middle of text keeps the following text and puts the caret after it', () => {
            const { textarea, value, unmount } = setup('hello world');
            edit(textarea, 'hello @b world', 8);
            key(textarea, 'Enter');
            expect(value()).toBe('hello @(_bob_)[_Bob Builder_] world');
            expect(textarea.selectionEnd).toBe('hello Bob Builder'.length);
            unmount();
        });

        test('Backspace at the end of a mention removes the whole mention', () => {
            const { textarea, value, unmount } = setup('hi @(_bob_)[_Bob Builder_] yo');
            expect(textarea.value).toBe('hi Bob Builder yo');
            textarea.setSelectionRange(14, 14);
            backspace(textarea);
            expect(value()).toBe('hi  yo');
            expect(textarea.value).toBe('hi  yo');
            expect(textarea.selectionEnd).toBe(3);
            unmount();
        });

        test('Typing inside a mention removes the mention and keeps the typed text', () => {
            const { textarea, value, unmount } = setup('@(_bob_)[_Bob_]!');
            edit(textarea, 'BoXb!', 3);
            expect(value()).toBe('X!');
            expect(textarea.selectionEnd).toBe(1);
            unmount();
        });

        test('Deleting a selection that covers part of a mention removes the mention', () => {
            const { textarea, value, unmount } = setup('a @(_alice_)[_Alice_] b @(_bob_)[_Bob_]');
            edit(textarea, 'a Alob', 4);
            expect(value()).toBe('a ');
            unmount();
        });

        test('Editing text next to a mention keeps the mention intact', () => {
            const { textarea, value, unmount } = setup('@(_bob_)[_Bob_]');
            edit(textarea, 'Bob, hi');
            expect(value()).toBe('@(_bob_)[_Bob_], hi');
            edit(textarea, 'hey Bob, hi', 4);
            expect(value()).toBe('hey @(_bob_)[_Bob_], hi');
            unmount();
        });

        test('Clearing the value externally resets the textarea', () => {
            function Harness() {
                const [value, setValue] = useState('@(_bob_)[_Bob_] x');
                return (
                    <>
                        <MentionTextarea className="x" value={value} users={USERS} onChange={(e: any, v: string) => setValue(v)} />
                        <button onClick={() => setValue('')}>clear</button>
                    </>
                );
            }
            const { container, unmount } = renderIntoContainer(<Harness />);
            const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
            expect(textarea.value).toBe('Bob x');
            act(() => (container.querySelector('button') as HTMLButtonElement).click());
            expect(textarea.value).toBe('');
            expect(container.querySelectorAll('.x__highlighter strong').length).toBe(0);
            unmount();
        });

        test('Moving the caret back into an @ query reopens the suggestions', () => {
            const { textarea, suggestions, unmount } = setup();
            act(() => textarea.focus());
            edit(textarea, '@bo then');
            expect(suggestions()).toEqual([]);
            act(() => {
                textarea.setSelectionRange(3, 3);
                textarea.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
            });
            expect(suggestions()).toEqual(['Bob Builder']);
            act(() => {
                textarea.setSelectionRange(0, 3);
                textarea.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
            });
            expect(suggestions()).toEqual([]);
            unmount();
        });

        test('Works with an empty user list', () => {
            const { textarea, suggestions, value, unmount } = setup('', []);
            edit(textarea, '@a');
            expect(suggestions()).toEqual([]);
            expect(key(textarea, 'Enter').defaultPrevented).toBe(false);
            expect(value()).toBe('@a');
            unmount();
        });
    });
});
