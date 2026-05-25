import React from 'react';
import { render } from '@testing-library/react';
import { useItem } from '../../../src/static/js/utils/hooks/useItem';

// Mock the item components
jest.mock('../../../src/static/js/components/list-item/includes/items', () => ({
    ItemDescription: ({ description }: { description: string }) => (
        <div data-testid="item-description">{description}</div>
    ),
    ItemMain: ({ children }: { children: React.ReactNode }) => <div data-testid="item-main">{children}</div>,
    ItemMainInLink: ({ children, link, title }: { children: React.ReactNode; link: string; title: string }) => (
        <div data-testid="item-main-in-link" data-link={link} data-title={title}>
            {children}
        </div>
    ),
    ItemTitle: ({ title, ariaLabel }: { title: string; ariaLabel: string }) => (
        <h3 data-testid="item-title" data-aria-label={ariaLabel}>
            {title}
        </h3>
    ),
    ItemTitleLink: ({ title, link, ariaLabel }: { title: string; link: string; ariaLabel: string }) => (
        <h3 data-testid="item-title-link" data-link={link} data-aria-label={ariaLabel}>
            {title}
        </h3>
    ),
}));

// Mock PageStore
jest.mock('../../../src/static/js/utils/stores/PageStore.js', () => ({
    __esModule: true,
    default: {
        get: (key: string) => (key === 'config-site' ? { url: 'https://example.com' } : null),
    },
}));

// HookConsumer component to test the hook
function HookConsumer(props: any) {
    const { titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper } = useItem(props);

    return (
        <div>
            <div data-testid="title">{titleComponent()}</div>
            <div data-testid="description">{descriptionComponent()}</div>
            <div data-testid="thumbnail-url">{thumbnailUrl || 'null'}</div>
            <div data-testid="wrapper-type">{(UnderThumbWrapper as any).name}</div>
            <div data-testid="wrapper-component">
                <div>Wrapper content</div>
            </div>
        </div>
    );
}

// Wrapper consumer to test wrapper selection
function WrapperTest(props: any) {
    const { UnderThumbWrapper } = useItem(props);

    return (
        <UnderThumbWrapper link={props.link} title={props.title} data-testid="wrapper-test">
            <span data-testid="wrapper-content">Content</span>
        </UnderThumbWrapper>
    );
}

describe('utils/hooks', () => {
    describe('useItem', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe('titleComponent Rendering', () => {
            test('Renders ItemTitle when singleLinkContent is true', () => {
                const { getByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail=""
                        singleLinkContent={true}
                    />
                );

                expect(getByTestId('title').querySelector('[data-testid="item-title"]')).toBeTruthy();
                expect(getByTestId('title').querySelector('[data-testid="item-title-link"]')).toBeFalsy();
            });

            test('Renders ItemTitleLink when singleLinkContent is false', () => {
                const { getByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail=""
                        singleLinkContent={false}
                    />
                );

                expect(getByTestId('title').querySelector('[data-testid="item-title"]')).toBeFalsy();
                expect(getByTestId('title').querySelector('[data-testid="item-title-link"]')).toBeTruthy();
            });

            test('Renders with default link when singleLinkContent is not provided', () => {
                const { getByTestId } = render(
                    <HookConsumer title="Test Title" description="Test Description" link="/media/test" thumbnail="" />
                );

                // Default is false for singleLinkContent
                expect(getByTestId('title').querySelector('[data-testid="item-title-link"]')).toBeTruthy();
            });
        });

        describe('descriptionComponent Rendering', () => {
            test('Renders single ItemDescription when hasMediaViewer is false', () => {
                const { getByTestId, queryAllByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="My Description"
                        link="https://example.com"
                        thumbnail=""
                        hasMediaViewer={false}
                    />
                );

                const descriptions = queryAllByTestId('item-description');
                expect(descriptions.length).toBe(1);
                expect(descriptions[0].textContent).toBe('My Description');
            });

            test('Renders single ItemDescription when hasMediaViewerDescr is false', () => {
                const { getByTestId, queryAllByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="My Description"
                        link="https://example.com"
                        thumbnail=""
                        hasMediaViewer={true}
                        hasMediaViewerDescr={false}
                    />
                );

                const descriptions = queryAllByTestId('item-description');
                expect(descriptions.length).toBe(1);
                expect(descriptions[0].textContent).toBe('My Description');
            });

            test('Renders two ItemDescriptions when hasMediaViewer and hasMediaViewerDescr are both true', () => {
                const { queryAllByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="Main Description"
                        link="https://example.com"
                        thumbnail=""
                        hasMediaViewer={true}
                        hasMediaViewerDescr={true}
                        meta_description="Meta Description"
                    />
                );

                const descriptions = queryAllByTestId('item-description');
                expect(descriptions.length).toBe(2);
                expect(descriptions[0].textContent).toBe('Meta Description');
                expect(descriptions[1].textContent).toBe('Main Description');
            });

            test('Trims description text', () => {
                const { queryAllByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="   Description with spaces   "
                        link="https://example.com"
                        thumbnail=""
                    />
                );

                expect(queryAllByTestId('item-description')[0].textContent).toBe('Description with spaces');
            });

            test('Trims meta_description text', () => {
                const { queryAllByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="Main Description"
                        link="https://example.com"
                        thumbnail=""
                        hasMediaViewer={true}
                        hasMediaViewerDescr={true}
                        meta_description="   Meta with spaces   "
                    />
                );

                expect(queryAllByTestId('item-description')[0].textContent).toBe('Meta with spaces');
            });
        });

        describe('thumbnailUrl', () => {
            test('Returns null when thumbnail is empty string', () => {
                const { getByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail=""
                    />
                );

                expect(getByTestId('thumbnail-url').textContent).toBe('null');
            });

            test('Returns formatted URL when thumbnail has value', () => {
                const { getByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail="/media/thumbnail.jpg"
                    />
                );

                expect(getByTestId('thumbnail-url').textContent).toBe('https://example.com/media/thumbnail.jpg');
            });

            test('Handles absolute URLs as thumbnails', () => {
                const { getByTestId } = render(
                    <HookConsumer
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail="https://cdn.example.com/image.jpg"
                    />
                );

                // formatInnerLink should preserve absolute URLs
                expect(getByTestId('thumbnail-url').textContent).toBe('https://cdn.example.com/image.jpg');
            });
        });

        describe('UnderThumbWrapper', () => {
            test('Uses ItemMainInLink when singleLinkContent is true', () => {
                const { getByTestId } = render(
                    <WrapperTest
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail=""
                        singleLinkContent={true}
                    />
                );

                // When singleLinkContent is true, UnderThumbWrapper should be ItemMainInLink
                expect(getByTestId('item-main-in-link')).toBeTruthy();
                expect(getByTestId('item-main-in-link').getAttribute('data-link')).toBe('https://example.com');
                expect(getByTestId('item-main-in-link').getAttribute('data-title')).toBe('Test Title');
            });

            test('Uses ItemMain when singleLinkContent is false', () => {
                const { getByTestId } = render(
                    <WrapperTest
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail=""
                        singleLinkContent={false}
                    />
                );

                // When singleLinkContent is false, UnderThumbWrapper should be ItemMain
                expect(getByTestId('item-main')).toBeTruthy();
            });

            test('Uses ItemMain by default when singleLinkContent is not provided', () => {
                const { getByTestId } = render(
                    <WrapperTest
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail=""
                    />
                );

                // Default is singleLinkContent=false, so ItemMain
                expect(getByTestId('item-main')).toBeTruthy();
            });
        });

        describe('onMount callback', () => {
            test('Calls onMount callback when component mounts', () => {
                const onMountCallback = jest.fn();

                render(
                    <HookConsumer
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail=""
                        onMount={onMountCallback}
                    />
                );

                expect(onMountCallback).toHaveBeenCalledTimes(1);
            });

            test('Calls onMount only once on initial mount', () => {
                const onMountCallback = jest.fn();

                const { rerender } = render(
                    <HookConsumer
                        title="Test Title"
                        description="Test Description"
                        link="https://example.com"
                        thumbnail=""
                        onMount={onMountCallback}
                    />
                );

                expect(onMountCallback).toHaveBeenCalledTimes(1);

                rerender(
                    <HookConsumer
                        title="Updated Title"
                        description="Updated Description"
                        link="https://example.com"
                        thumbnail=""
                        onMount={onMountCallback}
                    />
                );

                // Should still be called only once (useEffect with empty dependency array)
                expect(onMountCallback).toHaveBeenCalledTimes(1);
            });
        });

        describe('Integration tests', () => {
            test('Complete rendering with all props', () => {
                const onMount = jest.fn();
                const { getByTestId, queryAllByTestId } = render(
                    <HookConsumer
                        title="Complete Test"
                        description="Complete Description"
                        link="/media/complete"
                        thumbnail="/img/thumb.jpg"
                        type="media"
                        hasMediaViewer={true}
                        hasMediaViewerDescr={true}
                        meta_description="Complete Meta"
                        singleLinkContent={false}
                        onMount={onMount}
                    />
                );

                const descriptions = queryAllByTestId('item-description');
                expect(descriptions.length).toBe(2);
                expect(onMount).toHaveBeenCalledTimes(1);
                expect(getByTestId('thumbnail-url').textContent).toBe('https://example.com/img/thumb.jpg');
            });

            test('Minimal props required', () => {
                const { getByTestId } = render(
                    <HookConsumer title="Title" description="Description" link="/link" thumbnail="" />
                );

                expect(getByTestId('title')).toBeTruthy();
                expect(getByTestId('description')).toBeTruthy();
                expect(getByTestId('thumbnail-url').textContent).toBe('null');
            });

            test('Renders with special characters in title and description', () => {
                const { queryAllByTestId } = render(
                    <HookConsumer
                        title="Title with & < > special chars"
                        description={`Description with 'quotes' and "double quotes"`}
                        link="/media"
                        thumbnail=""
                    />
                );

                const descriptions = queryAllByTestId('item-description');
                expect(descriptions[0].textContent).toContain('Description with');
            });
        });
    });
});
