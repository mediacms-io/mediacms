import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { NumericInputWithUnit } from '../../../src/static/js/components/_shared/numeric-input-with-unit/NumericInputWithUnit';

function setNativeValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    (Object.getOwnPropertyDescriptor(proto, 'value') as PropertyDescriptor).set!.call(el, value);
}

describe('components/_shared', () => {
    describe('NumericInputWithUnit', () => {
        const units = [{ key: 'px', label: 'Pixels' }, { key: 'percent' }, { label: 'ignored without key' }];

        test('Renders label, bounded input and unit options', () => {
            const { container, unmount } = renderIntoContainer(
                <NumericInputWithUnit label="Width" units={units} defaultValue={50} minValue={10} maxValue={100} defaultUnit="percent" />
            );
            expect(container.querySelector('.num-value-unit .label')?.textContent).toBe('Width');
            const input = container.querySelector('input.value-input') as HTMLInputElement;
            expect(input.value).toBe('50');
            expect(input.getAttribute('min')).toBe('10');
            expect(input.getAttribute('max')).toBe('100');

            const select = container.querySelector('select.value-unit') as HTMLSelectElement;
            const options = Array.from(select.options).map((o) => [o.value, o.textContent]);
            expect(options).toStrictEqual([
                ['px', 'Pixels'],
                ['percent', 'percent'],
            ]);
            expect(select.value).toBe('percent');
            unmount();
        });

        test.each([
            [5, 10],
            [500, 100],
        ])('Clamps default value %p into range as %p', (defaultValue, expected) => {
            const { container, unmount } = renderIntoContainer(
                <NumericInputWithUnit units={units} defaultValue={defaultValue} minValue={10} maxValue={100} />
            );
            expect((container.querySelector('input') as HTMLInputElement).value).toBe(String(expected));
            unmount();
        });

        test('Falls back to the first unit for unknown default unit and omits label and bounds', () => {
            const { container, unmount } = renderIntoContainer(
                <NumericInputWithUnit units={units} defaultValue={1} defaultUnit="em" />
            );
            expect(container.querySelector('.label')).toBeNull();
            const input = container.querySelector('input') as HTMLInputElement;
            expect(input.hasAttribute('min')).toBe(false);
            expect(input.hasAttribute('max')).toBe(false);
            expect((container.querySelector('select') as HTMLSelectElement).value).toBe('px');
            unmount();
        });

        test('Renders an empty select without units', () => {
            const { container, unmount } = renderIntoContainer(<NumericInputWithUnit units={[]} defaultValue={1} />);
            expect((container.querySelector('select') as HTMLSelectElement).options).toHaveLength(0);
            unmount();
        });

        test('Forwards user changes to value and unit callbacks', () => {
            const valueCallback = jest.fn();
            const unitCallback = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <NumericInputWithUnit
                    units={units}
                    defaultValue={20}
                    valueCallback={valueCallback}
                    unitCallback={unitCallback}
                />
            );
            const input = container.querySelector('input') as HTMLInputElement;
            const select = container.querySelector('select') as HTMLSelectElement;

            act(() => {
                setNativeValue(input, '42');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            expect(valueCallback).toHaveBeenCalledWith('42');

            act(() => {
                setNativeValue(select, 'percent');
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            expect(unitCallback).toHaveBeenCalledWith('percent');
            unmount();
        });

        test('Accepts changes without callbacks', () => {
            const { container, unmount } = renderIntoContainer(<NumericInputWithUnit units={units} defaultValue={20} />);
            const input = container.querySelector('input') as HTMLInputElement;
            const select = container.querySelector('select') as HTMLSelectElement;
            expect(() =>
                act(() => {
                    setNativeValue(input, '7');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    setNativeValue(select, 'percent');
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                })
            ).not.toThrow();
            unmount();
        });
    });
});
