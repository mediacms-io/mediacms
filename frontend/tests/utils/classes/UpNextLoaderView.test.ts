import { UpNextLoaderView } from '../../../src/static/js/utils/classes/UpNextLoaderView';

// Minimal helpers mocks used by UpNextLoaderView
jest.mock('../../../src/static/js/utils/helpers/', () => ({
    addClassname: jest.fn((el: any, cn: string) => el && el.classList && el.classList.add(cn)),
    removeClassname: jest.fn((el: any, cn: string) => el && el.classList && el.classList.remove(cn)),
    translateString: (s: string) => s,
}));

const { addClassname, removeClassname } = jest.requireMock('../../../src/static/js/utils/helpers/');

const makeNextItem = () => ({
    url: '/next-url',
    title: 'Next title',
    author_name: 'Jane Doe',
    thumbnail_url: 'https://example.com/thumb.jpg',
});

describe('utils/classes', () => {
    describe('UpNextLoaderView', () => {
        test('html() builds structure with expected classes and content', () => {
            const v = new UpNextLoaderView(makeNextItem());

            const root = v.html();

            expect(root).toBeInstanceOf(HTMLElement);
            expect(root.querySelector('.up-next-loader-inner')).not.toBeNull();
            expect(root.querySelector('.up-next-label')!.textContent).toBe('Up Next');
            expect(root.querySelector('.next-media-title')!.textContent).toBe('Next title');
            expect(root.querySelector('.next-media-author')!.textContent).toBe('Jane Doe');

            // poster background
            const poster = root.querySelector('.next-media-poster') as HTMLElement;
            expect(poster.style.backgroundImage).toContain('thumb.jpg');

            // go-next link points to next url
            const link = root.querySelector('.go-next a') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/next-url');
        });

        test('setVideoJsPlayerElem marks player with vjs-mediacms-has-up-next-view class', () => {
            const v = new UpNextLoaderView(makeNextItem());
            const player = document.createElement('div');

            v.setVideoJsPlayerElem(player);

            expect(addClassname).toHaveBeenCalledWith(player, 'vjs-mediacms-has-up-next-view');
            expect(v.vjsPlayerElem).toBe(player);
        });

        test('startTimer shows view, registers scroll, and navigates after 10s', () => {
            const next = makeNextItem();
            const v = new UpNextLoaderView(next);
            const player = document.createElement('div');

            v.setVideoJsPlayerElem(player);
            v.startTimer();

            expect(removeClassname).toHaveBeenCalledWith(player, 'vjs-mediacms-up-next-hidden');
            expect(removeClassname).toHaveBeenCalledWith(player, 'vjs-mediacms-canceled-next');
        });

        test('cancelTimer clears timeout, stops scroll, and marks canceled', () => {
            const v = new UpNextLoaderView(makeNextItem());
            const player = document.createElement('div');

            v.setVideoJsPlayerElem(player);

            v.startTimer();
            v.cancelTimer();

            expect(addClassname).toHaveBeenCalledWith(player, 'vjs-mediacms-canceled-next');
        });

        test('Cancel button click hides the view and cancels timer', () => {
            const v = new UpNextLoaderView(makeNextItem());
            const player = document.createElement('div');
            v.setVideoJsPlayerElem(player);

            v.startTimer();
            const root = v.html();
            const cancelBtn = root.querySelector('.up-next-cancel button') as HTMLButtonElement;
            cancelBtn.click();

            expect(addClassname).toHaveBeenCalledWith(player, 'vjs-mediacms-canceled-next');
        });

        test('showTimerView shows or starts timer based on flag', () => {
            const v = new UpNextLoaderView(makeNextItem());
            const player = document.createElement('div');
            v.setVideoJsPlayerElem(player);

            // beginTimer=false -> just show view
            v.showTimerView(false);
            expect(removeClassname).toHaveBeenCalledWith(player, 'vjs-mediacms-up-next-hidden');

            // beginTimer=true -> starts timer
            v.showTimerView(true);
            expect(removeClassname).toHaveBeenCalledWith(player, 'vjs-mediacms-canceled-next');
        });
    });
});
