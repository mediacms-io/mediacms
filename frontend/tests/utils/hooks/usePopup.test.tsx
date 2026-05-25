import React from 'react';
import { render } from '@testing-library/react';

// Mock popup components to avoid SCSS imports breaking Jest
jest.mock('../../../src/static/js/components/_shared/popup/Popup.jsx', () => {
    const React = require('react');
    const Popup = React.forwardRef((props: any, _ref: any) => React.createElement('div', props, props.children));
    return { __esModule: true, default: Popup };
});

jest.mock('../../../src/static/js/components/_shared/popup/PopupContent.jsx', () => ({
    PopupContent: (props: any) => React.createElement('div', props, props.children),
}));

jest.mock('../../../src/static/js/components/_shared/popup/PopupTrigger.jsx', () => ({
    PopupTrigger: (props: any) => React.createElement('div', props, props.children),
}));

import { usePopup } from '../../../src/static/js/utils/hooks/usePopup';

describe('utils/hooks', () => {
    describe('usePopup', () => {
        test('Returns a 3-tuple: [ref, PopupContent, PopupTrigger]', () => {
            let value: any;

            const Comp: React.FC = () => {
                value = usePopup();
                return null;
            };

            render(<Comp />);

            expect(Array.isArray(value)).toBe(true);
            expect(value).toHaveLength(3);

            const [ref, PopupContent, PopupTrigger] = value;

            expect(ref).toBeDefined();
            expect(ref.current).toBe(null);

            expect(typeof PopupContent).toBe('function');
            expect(typeof PopupTrigger).toBe('function');
        });

        test('Tuple components are stable functions and refs are unique per call', () => {
            let results: any[] = [];

            const Comp: React.FC = () => {
                results.push(usePopup());
                results.push(usePopup());
                return null;
            };

            render(<Comp />);

            const [ref1, PopupContent1, PopupTrigger1] = results[0];
            const [ref2, PopupContent2, PopupTrigger2] = results[1];

            expect(typeof PopupContent1).toBe('function');
            expect(typeof PopupTrigger1).toBe('function');

            expect(PopupContent1).toBe(PopupContent2);
            expect(PopupTrigger1).toBe(PopupTrigger2);

            expect(ref1).not.toBe(ref2);
        });
    });
});
