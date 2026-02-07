import React from 'react';
import { render } from '@testing-library/react';
import { useMediaItem, itemClassname } from '../../../src/static/js/utils/hooks/useMediaItem';

// Mock dependencies used by useMediaItem

// @todo: Revisit this
jest.mock('../../../src/static/js/utils/stores/', () => ({
    PageStore: { get: (_: string) => ({ url: 'https://example.com' }) },
}));

jest.mock('../../../src/static/js/components/list-item/includes/items', () => ({
    MediaItemAuthor: ({ name }: any) => <div data-testid="author" data-name={name} />,
    MediaItemAuthorLink: ({ name, link }: any) => (
        <a data-testid="author-link" data-name={name} href={link || undefined} />
    ),
    MediaItemMetaViews: ({ views }: any) => <span data-testid="views" data-views={views} />,
    MediaItemMetaDate: ({ time, dateTime, text }: any) => (
        <time data-testid="date" data-time={String(time)} data-datetime={String(dateTime)}>
            {text}
        </time>
    ),
    MediaItemEditLink: ({ link }: any) => <a data-testid="edit" href={link} />,
    MediaItemViewLink: ({ link }: any) => <a data-testid="view" href={link} />,
}));

// @todo: Revisit this
// useItem returns titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper
jest.mock('../../../src/static/js/utils/hooks/useItem', () => ({
    useItem: (props: any) => ({
        titleComponent: () => <h3 data-testid="title">{props.title || 'title'}</h3>,
        descriptionComponent: () => <p data-testid="desc">{props.description || 'desc'}</p>,
        thumbnailUrl: props.thumb || 'thumb.jpg',
        UnderThumbWrapper: ({ children }: any) => <div data-testid="under-thumb">{children}</div>,
    }),
}));

function HookConsumer(props: any) {
    const [TitleComp, DescComp, thumbUrl, UnderThumbComp, EditComp, MetaComp, ViewComp] = useMediaItem(props);
    // The hook returns functions/components/values. To satisfy TS, render using React.createElement
    return (
        <div>
            {typeof TitleComp === 'function' ? React.createElement(TitleComp) : null}
            {typeof DescComp === 'function' ? React.createElement(DescComp) : null}
            <div data-testid="thumb">{typeof thumbUrl === 'string' ? thumbUrl : ''}</div>
            {typeof UnderThumbComp === 'function'
                ? React.createElement(
                      UnderThumbComp,
                      null,
                      typeof EditComp === 'function' ? React.createElement(EditComp) : null,
                      typeof MetaComp === 'function' ? React.createElement(MetaComp) : null,
                      typeof ViewComp === 'function' ? React.createElement(ViewComp) : null
                  )
                : null}
        </div>
    );
}

describe('utils/hooks', () => {
    describe('useMediaItem', () => {
        describe('itemClassname utility function', () => {
            test('Returns default classname when no modifications', () => {
                expect(itemClassname('base', '', false)).toBe('base');
            });

            test('Appends inherited classname when provided', () => {
                expect(itemClassname('base', 'extra', false)).toBe('base extra');
            });

            test('Appends pl-active-item when isActiveInPlaylistPlayback is true', () => {
                expect(itemClassname('base', '', true)).toBe('base pl-active-item');
            });

            test('Appends both inherited classname and active state', () => {
                expect(itemClassname('base', 'extra', true)).toBe('base extra pl-active-item');
            });
        });

        describe('Basic Rendering', () => {
            test('Renders basic components from useItem and edit/view links', () => {
                // @todo: Revisit this
                const props = {
                    title: 'My Title',
                    description: 'My Desc',
                    thumbnail: 'thumb.jpg',
                    link: '/watch/1',
                    singleLinkContent: true,
                    // hasMediaViewer:...
                    // hasMediaViewerDescr:...
                    // meta_description:...
                    // onMount:...
                    // type:...
                    // ------------------------------
                    editLink: '/edit/1',
                    showSelection: true,
                    // publishLink: ...
                    // hideAuthor:...
                    author_name: 'Author',
                    author_link: '/u/author',
                    // hideViews:...
                    views: 10,
                    // hideDate:...
                    publish_date: '2020-01-01T00:00:00Z',
                    // hideAllMeta:...
                };

                const { getByTestId, queryByTestId } = render(<HookConsumer {...props} />);

                expect(getByTestId('title').textContent).toBe(props.title);
                expect(getByTestId('desc').textContent).toBe(props.description);
                expect(getByTestId('thumb').textContent).toBe('thumb.jpg');

                expect(getByTestId('edit').getAttribute('href')).toBe(props.editLink);

                expect(getByTestId('views').getAttribute('data-views')).toBe(props.views.toString());
                expect(getByTestId('date')).toBeTruthy();
                expect(getByTestId('view').getAttribute('href')).toBe(props.link);
                expect(queryByTestId('author')).toBeTruthy();
            });
        });

        describe('View Link Selection', () => {
            test('Uses publishLink when provided and showSelection=true', () => {
                const props = {
                    editLink: '/edit/2',
                    link: '/watch/2',
                    publishLink: '/publish/2',
                    showSelection: true,
                    singleLinkContent: true,
                    author_name: 'A',
                    author_link: '',
                    views: 0,
                    publish_date: 0,
                };

                const { getByTestId } = render(<HookConsumer {...props} />);

                expect(getByTestId('view').getAttribute('href')).toBe(props.publishLink);
            });
        });

        describe('Visibility Controls', () => {
            test('Hides author, views, and date based on props', () => {
                const props = {
                    editLink: '/e',
                    link: '/l',
                    showSelection: true,
                    hideAuthor: true,
                    hideViews: true,
                    hideDate: true,
                    publish_date: '2020-01-01T00:00:00Z',
                    views: 5,
                    author_name: 'Hidden',
                    author_link: '/u/x',
                };

                const { queryByTestId } = render(<HookConsumer {...props} />);

                expect(queryByTestId('author')).toBeNull();
                expect(queryByTestId('views')).toBeNull();
                expect(queryByTestId('date')).toBeNull();
            });

            test('Author link resolves using formatInnerLink and PageStore base url when singleLinkContent=false', () => {
                const props = {
                    editLink: '/e',
                    link: '/l',
                    showSelection: true,
                    singleLinkContent: false,
                    hideAuthor: false,
                    author_name: 'John',
                    author_link: '/u/john',
                    publish_date: '2020-01-01T00:00:00Z',
                };

                const { container } = render(<HookConsumer {...props} />);

                const a = container.querySelector('[data-testid="author-link"]') as HTMLAnchorElement;

                expect(a).toBeTruthy();
                expect(a.getAttribute('href')).toBe(`https://example.com${props.author_link}`);
                expect(a.getAttribute('data-name')).toBe(props.author_name);
            });
        });

        describe('Meta Visibility', () => {
            test('Meta wrapper hidden when hideAllMeta=true', () => {
                const props = {
                    editLink: '/e',
                    link: '/l',
                    showSelection: true,
                    hideAllMeta: true,
                    publish_date: '2020-01-01T00:00:00Z',
                };

                const { queryByTestId } = render(<HookConsumer {...props} />);

                expect(queryByTestId('author')).toBeNull();
                expect(queryByTestId('views')).toBeNull();
                expect(queryByTestId('date')).toBeNull();
            });

            test('Meta wrapper hidden individually by hideAuthor, hideViews, hideDate', () => {
                const props = {
                    editLink: '/e',
                    link: '/l',
                    showSelection: true,
                    hideAuthor: true,
                    hideViews: false,
                    hideDate: false,
                    publish_date: '2020-01-01T00:00:00Z',
                    views: 5,
                    author_name: 'Test',
                    author_link: '/u/test',
                };

                const { queryByTestId } = render(<HookConsumer {...props} />);

                expect(queryByTestId('author')).toBeNull();
                expect(queryByTestId('views')).toBeTruthy();
                expect(queryByTestId('date')).toBeTruthy();
            });
        });

        describe('Edge Cases & Date Handling', () => {
            test('Handles views when hideViews is false', () => {
                const props = {
                    editLink: '/e',
                    link: '/l',
                    showSelection: true,
                    hideViews: false,
                    views: 100,
                    publish_date: '2020-01-01T00:00:00Z',
                    author_name: 'A',
                    author_link: '/u/a',
                };

                const { getByTestId } = render(<HookConsumer {...props} />);
                expect(getByTestId('views')).toBeTruthy();
                expect(getByTestId('views').getAttribute('data-views')).toBe('100');
            });

            test('Renders without showSelection', () => {
                const props = {
                    editLink: '/e',
                    link: '/l',
                    showSelection: false,
                    publish_date: '2020-01-01T00:00:00Z',
                    author_name: 'A',
                    author_link: '/u/a',
                };

                const { queryByTestId } = render(<HookConsumer {...props} />);
                expect(queryByTestId('view')).toBeNull();
            });

            test('Handles numeric publish_date correctly', () => {
                const props = {
                    editLink: '/e',
                    link: '/l',
                    showSelection: true,
                    publish_date: 1577836800000, // 2020-01-01 as timestamp
                    author_name: 'A',
                    author_link: '/u/a',
                };

                const { getByTestId } = render(<HookConsumer {...props} />);
                expect(getByTestId('date')).toBeTruthy();
            });

            test('Handles empty author_link by setting it to null', () => {
                const props = {
                    editLink: '/e',
                    link: '/l',
                    showSelection: true,
                    singleLinkContent: false,
                    author_name: 'Anonymous',
                    author_link: '', // Empty link
                    publish_date: '2020-01-01T00:00:00Z',
                };

                const { container } = render(<HookConsumer {...props} />);
                const authorLink = container.querySelector('[data-testid="author-link"]') as HTMLAnchorElement;
                expect(authorLink).toBeTruthy();
                expect(authorLink.getAttribute('href')).toBeNull();
            });
        });
    });
});
