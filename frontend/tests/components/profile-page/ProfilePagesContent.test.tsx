import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import ProfilePagesContent from '../../../src/static/js/components/profile-page/ProfilePagesContent';

const Content = ProfilePagesContent as unknown as React.ComponentType<any>;

describe('components/profile-page', () => {
    describe('ProfilePagesContent', () => {
        test('Wraps children and adds the contact form modifier', () => {
            const { container, rerender, unmount } = renderIntoContainer(
                <Content>
                    <p />
                </Content>
            );
            expect(container.firstElementChild?.className).toBe('profile-page-content');
            rerender(
                <Content enabledContactForm>
                    <p />
                </Content>
            );
            expect(container.firstElementChild?.className).toBe('profile-page-content with-cform');
            unmount();
        });

        test('Renders nothing without children', () => {
            const { container, unmount } = renderIntoContainer(<Content />);
            expect(container.innerHTML).toBe('');
            unmount();
        });
    });
});
