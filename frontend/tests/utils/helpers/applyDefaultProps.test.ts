import { applyDefaultProps } from '../../../src/static/js/utils/helpers/applyDefaultProps';

describe('js/utils/helpers', () => {
    describe('applyDefaultProps', () => {
        const defaults = { size: 'medium', count: 0, onClick: () => null };

        test('Fills in props that are missing or undefined', () => {
            expect(applyDefaultProps({ count: undefined }, defaults)).toStrictEqual({ size: 'medium', count: 0, onClick: defaults.onClick });
        });

        test('Keeps given values, including null, false, 0 and empty strings, like React defaultProps did', () => {
            const props = { size: null, count: 5, onClick: false, label: '' };
            expect(applyDefaultProps(props, defaults)).toStrictEqual(props);
            expect(applyDefaultProps({ count: 0, size: '' }, defaults)).toStrictEqual({ count: 0, size: '', onClick: defaults.onClick });
        });

        test('Keeps props without a default, such as children', () => {
            const children = ['a'];
            expect(applyDefaultProps({ children, id: 'x' }, defaults)).toStrictEqual({ children, id: 'x', size: 'medium', count: 0, onClick: defaults.onClick });
        });

        test('Does not mutate the props React passed in', () => {
            const props = Object.freeze({ count: 3 });
            const resolved = applyDefaultProps(props, defaults);
            expect(resolved).not.toBe(props);
            expect(props).toStrictEqual({ count: 3 });
        });

        test('Returns the same default objects on every call, so effects depending on them do not re-run', () => {
            expect(applyDefaultProps({}, defaults).onClick).toBe(applyDefaultProps({}, defaults).onClick);
        });
    });
});
