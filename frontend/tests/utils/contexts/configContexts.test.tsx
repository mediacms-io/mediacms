import '../../_support/setupMediaCMS';
import React, { useContext } from 'react';
import { renderIntoContainer } from '../../_support/render';
import { config } from '../../../src/static/js/utils/settings/config';
import { ApiUrlContext, ApiUrlConsumer } from '../../../src/static/js/utils/contexts/ApiUrlContext';
import { LinksContext } from '../../../src/static/js/utils/contexts/LinksContext';
import { MemberContext, MemberConsumer } from '../../../src/static/js/utils/contexts/MemberContext';
import { PlaylistsContext } from '../../../src/static/js/utils/contexts/PlaylistsContext';
import { ShareOptionsContext } from '../../../src/static/js/utils/contexts/ShareOptionsContext';
import { SidebarContext, SidebarConsumer } from '../../../src/static/js/utils/contexts/SidebarContext';
import SiteContextDefault, { SiteContext, SiteConsumer } from '../../../src/static/js/utils/contexts/SiteContext';
import { TextsContext, TextsConsumer } from '../../../src/static/js/utils/contexts/TextsContext';
import * as contexts from '../../../src/static/js/utils/contexts';

function readContext(ctx: React.Context<any>) {
    let value: any;
    function Probe() {
        value = useContext(ctx);
        return null;
    }
    const { unmount } = renderIntoContainer(<Probe />);
    unmount();
    return value;
}

describe('utils/contexts', () => {
    const cfg = config((window as any).MediaCMS);

    describe('Config backed contexts', () => {
        test('ApiUrlContext defaults to configured api endpoints', () => {
            const value = readContext(ApiUrlContext);
            expect(value).toBe(cfg.api);
            expect(value.media).toBe('https://example.com/api/v1/media');
        });

        test('LinksContext defaults to configured url pages', () => {
            const value = readContext(LinksContext);
            expect(value).toBe(cfg.url);
            expect(value.search.query).toBe('/search?q=');
            expect(value.profile.media).toBe('https://example.com/user/john');
        });

        test('MemberContext defaults to member settings', () => {
            const value = readContext(MemberContext);
            expect(value).toBe(cfg.member);
            expect(value.username).toBe('john');
            expect(value.is.admin).toBe(true);
        });

        test('PlaylistsContext defaults to playlists settings', () => {
            expect(readContext(PlaylistsContext)).toBe(cfg.playlists);
        });

        test('ShareOptionsContext keeps only valid share options', () => {
            expect(readContext(ShareOptionsContext)).toStrictEqual(['embed', 'email']);
        });

        test('SidebarContext defaults to sidebar settings', () => {
            expect(readContext(SidebarContext)).toStrictEqual({
                hideHomeLink: false,
                hideTagsLink: false,
                hideCategoriesLink: false,
            });
        });

        test('SiteContext default export is the named context', () => {
            expect(SiteContextDefault).toBe(SiteContext);
            const value = readContext(SiteContext);
            expect(value).toBe(cfg.site);
            expect(value.id).toBe('mediacms-test');
        });

        test('TextsContext exposes notification messages', () => {
            expect(readContext(TextsContext)).toStrictEqual({ notifications: cfg.notifications.messages });
            expect(readContext(TextsContext).notifications.addToLiked).toBe('Added to liked media');
        });

        test('Provider value overrides the default', () => {
            let value: any;
            function Probe() {
                value = useContext(SiteContext);
                return null;
            }
            const { unmount } = renderIntoContainer(
                <SiteContext.Provider value={{ id: 'other' }}>
                    <Probe />
                </SiteContext.Provider>
            );
            expect(value).toStrictEqual({ id: 'other' });
            unmount();
        });

        test('Consumers render children with the default value', () => {
            const { container, unmount } = renderIntoContainer(
                <div>
                    <ApiUrlConsumer>{(v: any) => <span id="api">{v.search.query}</span>}</ApiUrlConsumer>
                    <MemberConsumer>{(v: any) => <span id="member">{v.name}</span>}</MemberConsumer>
                    <SidebarConsumer>{(v: any) => <span id="sidebar">{String(v.hideHomeLink)}</span>}</SidebarConsumer>
                    <SiteConsumer>{(v: any) => <span id="site">{v.title}</span>}</SiteConsumer>
                    <TextsConsumer>{(v: any) => <span id="texts">{v.notifications.removeFromLiked}</span>}</TextsConsumer>
                </div>
            );
            expect(container.querySelector('#api')?.textContent).toBe('https://example.com/api/v1/search?q=');
            expect(container.querySelector('#member')?.textContent).toBe('John');
            expect(container.querySelector('#sidebar')?.textContent).toBe('false');
            expect(container.querySelector('#site')?.textContent).toBe('MediaCMS Test');
            expect(container.querySelector('#texts')?.textContent).toBe('Removed from liked media');
            unmount();
        });

        test('Index re-exports every context', () => {
            expect(contexts.ApiUrlContext).toBe(ApiUrlContext);
            expect(contexts.LinksContext).toBe(LinksContext);
            expect(contexts.MemberContext).toBe(MemberContext);
            expect(contexts.SiteContext).toBe(SiteContext);
            expect(contexts.TextsContext).toBe(TextsContext);
            expect(typeof contexts.ThemeProvider).toBe('function');
            expect(typeof contexts.LayoutProvider).toBe('function');
            expect(typeof contexts.UserProvider).toBe('function');
            expect(contexts.HeaderContext).toBeDefined();
        });
    });
});
