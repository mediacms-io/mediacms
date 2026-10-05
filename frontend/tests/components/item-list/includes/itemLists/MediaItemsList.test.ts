import '../../../../_support/setupMediaCMS';
import initItemsList from '../../../../../src/static/js/components/item-list/includes/itemLists/initItemsList';
import MediaItemsList from '../../../../../src/static/js/components/item-list/includes/itemLists/MediaItemsList';
import MediaItem from '../../../../../src/static/js/components/item-list/includes/itemLists/MediaItem';
import MediaItemPreviewer from '../../../../../src/static/js/components/item-list/includes/itemLists/MediaItemPreviewer';

function buildItem(previewSrc?: string, ext?: string) {
    const item = document.createElement('div');
    item.className = 'item';
    if (undefined !== previewSrc) {
        const preview = document.createElement('span');
        preview.className = 'item-img-preview';
        preview.setAttribute('data-src', previewSrc);
        if (undefined !== ext) {
            preview.setAttribute('data-ext', ext);
        }
        item.appendChild(preview);
    }
    return item;
}

describe('components/item-list', () => {
    describe('MediaItem', () => {
        test('Ignores non DOM nodes', () => {
            const item = new (MediaItem as any)({});
            expect(item.previewer).toBeUndefined();
        });

        test('Reads previewer source and extensions from data attributes', () => {
            const el = buildItem(' /media/preview ', ' gif,webp ');
            const item = new (MediaItem as any)(el);
            expect(item.element).toBe(el);
            expect(item.previewer.src).toBe('/media/preview');
            expect(item.previewer.extensions).toStrictEqual(['gif', 'webp']);
        });

        test('Skips extensions when there is no preview source', () => {
            const item = new (MediaItem as any)(buildItem('', 'gif'));
            expect(item.previewer.src).toBeUndefined();
            expect(item.previewer.extensions).toBeUndefined();
        });

        test('Works without previewer element', () => {
            const item = new (MediaItem as any)(buildItem());
            expect(item.previewer.element).toBeNull();
        });
    });

    describe('MediaItemsList', () => {
        test('Ignores non DOM containers', () => {
            const list = new (MediaItemsList as any)(null, []);
            expect(list.items).toBeUndefined();
        });

        test('Wraps initial node lists and appended nodes', () => {
            const container = document.createElement('div');
            container.className = 'items-list items-list-hor';
            container.appendChild(buildItem());
            container.appendChild(buildItem());
            const list = new (MediaItemsList as any)(container, container.querySelectorAll('.item'));
            expect(list.container).toBe(container);
            expect(list.horizontalItems).toBe(true);
            expect(list.items).toHaveLength(2);
            expect(typeof list.dataObject()).toBe('object');
            expect(list.dataObject()[list.id]).toStrictEqual({});

            list.appendItems(buildItem());
            list.appendItems('not a node');
            expect(list.items).toHaveLength(3);
        });
    });

    describe('initItemsList', () => {
        test('Returns null for empty input', () => {
            expect(initItemsList([])).toBeNull();
        });

        test('Creates a list instance only for containers with items', () => {
            const withItems = document.createElement('div');
            withItems.appendChild(buildItem());
            const empty = document.createElement('div');
            const instances = initItemsList([empty, withItems]) as any[];
            const last = instances[instances.length - 1];
            expect(last.container).toBe(withItems);
            expect(last.items).toHaveLength(1);
        });
    });

    describe('MediaItemPreviewer', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        test('Returns an empty instance for non array input', () => {
            const previewer = new (MediaItemPreviewer as any)('gif');
            expect(previewer.extensions).toBeUndefined();
        });

        test.each([
            [['gif'], ['image/gif'], 'gif'],
            [['webp'], ['image/webp'], 'webp'],
            [['webp', 'jpg'], ['image/webp', 'image/jpg'], 'jpg'],
            [['jpeg'], ['image/jpeg'], 'jpeg'],
            [['png'], [], 'png'],
        ])('Builds picture element for %p', (extensions, sourceTypes, fallbackType) => {
            const previewer = new (MediaItemPreviewer as any)(extensions);
            const picture = previewer.element as HTMLElement;
            expect(picture.tagName).toBe('PICTURE');
            expect(Array.from(picture.querySelectorAll('source')).map((s) => s.getAttribute('type'))).toStrictEqual(
                sourceTypes
            );
            expect(picture.querySelector('img')).toBe(previewer.image);
            expect(previewer.extensions.fallback.type).toBe(fallbackType);
        });

        test('Does not build an element for unsupported extensions', () => {
            const previewer = new (MediaItemPreviewer as any)(['mp4']);
            expect(previewer.element).toBeNull();
            expect(() => previewer.newImage('/x', 1, 1, buildItem('/x', 'mp4'))).not.toThrow();
        });

        test('Appends preview image after hovering for a while', () => {
            jest.useFakeTimers();
            const previewer = new (MediaItemPreviewer as any)(['gif']);
            const item = buildItem('/media/preview', 'gif');
            previewer.elementEvents(item);

            item.dispatchEvent(new MouseEvent('mouseenter'));
            jest.advanceTimersByTime(100);

            const picture = item.querySelector('.item-img-preview picture') as HTMLElement;
            expect(picture).toBe(previewer.element);
            expect(picture.querySelector('source')?.getAttribute('srcset')).toMatch(/^https:\/\/example\.com\/+media\/preview\.gif$/);
            const img = picture.querySelector('img') as HTMLImageElement;
            expect(img.getAttribute('src')).toMatch(/\/media\/preview\.gif$/);
            expect(img.getAttribute('width')).toBe('1px');
            expect(img.getAttribute('height')).toBe('1px');
            expect(previewer.wrapperItem).toBe(item);
        });

        test('Cancels pending preview on mouse leave', () => {
            jest.useFakeTimers();
            const previewer = new (MediaItemPreviewer as any)(['gif']);
            const item = buildItem('/media/preview', 'gif');
            previewer.elementEvents(item);

            item.dispatchEvent(new MouseEvent('mouseenter'));
            item.dispatchEvent(new MouseEvent('mouseleave'));
            jest.advanceTimersByTime(200);

            expect(item.querySelector('picture')).toBeNull();
            expect(previewer.wrapperItem).toBeUndefined();
        });
    });
});
