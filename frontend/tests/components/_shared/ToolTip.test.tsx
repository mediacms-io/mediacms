import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import TooltipComponent from '../../../src/static/js/components/_shared/ToolTip';

const Tooltip = TooltipComponent as any;

describe('components/_shared', () => {
    describe('ToolTip', () => {
        function mouse(el: Element, type: 'mouseover' | 'mouseout', relatedTarget: EventTarget | null) {
            act(() => {
                el.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget }));
            });
        }

        test('Renders hidden content with title and default right position', () => {
            const { container, unmount } = renderIntoContainer(
                <Tooltip content="Body" title="Head" classNames="extra">
                    <span className="child">child</span>
                </Tooltip>
            );
            const box = container.querySelector('.tooltip-box') as HTMLElement;
            expect(box.className).toBe('tooltip-box hide extra');
            expect(box.querySelector('.tooltip-title')?.textContent).toBe('Head');
            expect(box.querySelector('.tooltip-content')?.textContent).toBe('Body');
            expect(box.style.left).toBe('100%');
            expect(box.style.marginLeft).toBe('10px');
            expect(container.querySelector('.child')).not.toBeNull();
            unmount();
        });

        test('Toggles show class on mouse enter and leave', () => {
            const { container, unmount } = renderIntoContainer(
                <Tooltip content="Body">
                    <span className="child">child</span>
                </Tooltip>
            );
            const wrapper = container.firstElementChild as HTMLElement;
            const box = container.querySelector('.tooltip-box') as HTMLElement;
            expect(box.querySelector('.tooltip-title')).toBeNull();

            mouse(wrapper, 'mouseover', document.body);
            expect(box.className).toBe('tooltip-box show ');
            mouse(wrapper, 'mouseout', document.body);
            expect(box.className).toBe('tooltip-box hide ');
            unmount();
        });

        test.each([
            ['left', { right: '100%', marginRight: '10px' }],
            ['top', { left: '50%', top: '-10px', transform: 'translateX(-50%)' }],
        ])('Applies %s position styles', (position, expected) => {
            const { container, unmount } = renderIntoContainer(<Tooltip content="Body" position={position} />);
            const box = container.querySelector('.tooltip-box') as HTMLElement;
            Object.entries(expected).forEach(([key, value]) => {
                expect((box.style as any)[key]).toBe(value);
            });
            unmount();
        });

        test('Uses measured box dimensions for top and bottom-left offsets', () => {
            const height = jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(30);
            const width = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);

            const top = renderIntoContainer(<Tooltip content="Body" position="top" />);
            expect((top.container.querySelector('.tooltip-box') as HTMLElement).style.top).toBe('-40px');
            top.unmount();

            const bottomLeft = renderIntoContainer(<Tooltip content="Body" position="bottom-left" />);
            const box = bottomLeft.container.querySelector('.tooltip-box') as HTMLElement;
            expect(box.style.left).toBe('-80px');
            expect(box.style.top).toBe('100%');
            expect(box.style.marginTop).toBe('10px');
            bottomLeft.unmount();

            height.mockRestore();
            width.mockRestore();
        });
    });
});
