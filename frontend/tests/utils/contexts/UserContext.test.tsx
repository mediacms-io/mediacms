import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import UserContextDefault, { UserContext, UserProvider, UserConsumer } from '../../../src/static/js/utils/contexts/UserContext';
import { useUser } from '../../../src/static/js/utils/hooks/useUser';
import { installMediaCMSGlobal } from '../../_support/mediacmsGlobal';

describe('utils/contexts', () => {
    describe('UserContext', () => {
        test('Default export is the named context', () => {
            expect(UserContextDefault).toBe(UserContext);
        });

        test('UserProvider exposes the signed in member through useUser', () => {
            let value: any;
            function Probe() {
                value = useUser();
                return null;
            }
            const { unmount } = renderIntoContainer(
                <UserProvider>
                    <Probe />
                </UserProvider>
            );
            expect(value.isAnonymous).toBe(false);
            expect(value.username).toBe('john');
            expect(value.thumbnail).toBe('/img/john.png');
            expect(value.userCan.addMedia).toBe(true);
            expect(value.userCan.manageUsers).toBe(true);
            expect(value.pages).toStrictEqual({
                home: null,
                about: '/user/john/about',
                media: '/user/john',
                playlists: '/user/john/playlists',
            });
            unmount();
        });

        test('useUser returns undefined outside a provider', () => {
            let value: any = 'unset';
            function Probe() {
                value = useUser();
                return null;
            }
            const { unmount } = renderIntoContainer(<Probe />);
            expect(value).toBeUndefined();
            unmount();
        });

        test('Anonymous visitors get no username and anonymous flag', () => {
            const original = (window as any).MediaCMS;
            installMediaCMSGlobal({ user: { is: { anonymous: true, admin: false } } });
            let value: any;
            jest.isolateModules(() => {
                const IsolatedReact = require('react');
                const { renderToStaticMarkup } = require('react-dom/server');
                const ctx = require('../../../src/static/js/utils/contexts/UserContext');
                renderToStaticMarkup(
                    IsolatedReact.createElement(
                        ctx.UserProvider,
                        null,
                        IsolatedReact.createElement(ctx.UserConsumer, null, (v: any) => {
                            value = v;
                            return null;
                        })
                    )
                );
            });
            (window as any).MediaCMS = original;
            expect(value.isAnonymous).toBe(true);
            expect(value.username).toBeNull();
            expect(value.thumbnail).toBeNull();
            expect(value.userCan.deleteMedia).toBe(false);
        });

        test('UserConsumer renders with the provider value', () => {
            const { container, unmount } = renderIntoContainer(
                <UserProvider>
                    <UserConsumer>{(v: any) => <span>{v.username}</span>}</UserConsumer>
                </UserProvider>
            );
            expect(container.textContent).toBe('john');
            unmount();
        });
    });
});
