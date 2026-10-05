import { UpNextLoaderView } from '../../../src/static/js/utils/classes/UpNextLoaderView';

describe('utils/classes', () => {
    describe('UpNextLoaderView', () => {
        const nextItem = { url: '#next-media', title: 'Next title', author_name: 'Jane', thumbnail_url: '/thumb.jpg' };

        let view: any;
        let player: HTMLDivElement;

        beforeEach(() => {
            window.location.hash = '';
            jest.useFakeTimers();
            view = new (UpNextLoaderView as any)(nextItem);
            player = document.createElement('div');
            document.body.appendChild(player);
        });

        afterEach(() => {
            view.cancelTimer();
            player.remove();
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        test('Builds the up next markup from next item data', () => {
            const html: HTMLElement = view.html();
            expect(html.className).toBe('up-next-loader');
            expect(html.querySelector('.up-next-label')?.innerHTML).toBe('Up Next');
            expect(html.querySelector('.next-media-title')?.innerHTML).toBe('Next title');
            expect(html.querySelector('.next-media-author')?.innerHTML).toBe('Jane');
            expect(html.querySelector('.go-next a')?.getAttribute('href')).toBe('#next-media');
            expect(html.querySelector('.up-next-cancel button')?.innerHTML).toBe('CANCEL');
            expect((html.querySelector('.next-media-poster') as HTMLElement).style.backgroundImage).toBe(
                'url("/thumb.jpg")'
            );
        });

        test('Ignores empty player element', () => {
            view.setVideoJsPlayerElem(null);
            expect(view.vjsPlayerElem).toBeNull();
        });

        test('Marks the player element when attached', () => {
            view.setVideoJsPlayerElem(player);
            expect(view.vjsPlayerElem).toBe(player);
            expect(player.classList.contains('vjs-mediacms-has-up-next-view')).toBe(true);
        });

        test('Navigates to the next item after ten seconds', () => {
            view.setVideoJsPlayerElem(player);
            player.classList.add('vjs-mediacms-up-next-hidden', 'vjs-mediacms-canceled-next');

            view.showTimerView(true);

            expect(player.classList.contains('vjs-mediacms-up-next-hidden')).toBe(false);
            expect(player.classList.contains('vjs-mediacms-canceled-next')).toBe(false);

            jest.advanceTimersByTime(9999);
            expect(window.location.hash).toBe('');
            jest.advanceTimersByTime(1);
            expect(window.location.hash).toBe('#next-media');
        });

        test('Showing without timer only reveals the view', () => {
            view.setVideoJsPlayerElem(player);
            player.classList.add('vjs-mediacms-up-next-hidden');
            view.showTimerView(false);
            expect(player.classList.contains('vjs-mediacms-up-next-hidden')).toBe(false);
            expect(jest.getTimerCount()).toBe(0);
        });

        test('Cancel button hides the view and stops the timer', () => {
            view.setVideoJsPlayerElem(player);
            view.startTimer();

            (view.html().querySelector('.up-next-cancel button') as HTMLButtonElement).click();

            expect(player.classList.contains('vjs-mediacms-up-next-hidden')).toBe(true);
            expect(player.classList.contains('vjs-mediacms-canceled-next')).toBe(true);
            expect(jest.getTimerCount()).toBe(0);
        });

        test('HideTimerView hides the view', () => {
            view.setVideoJsPlayerElem(player);
            view.showTimerView(true);
            view.hideTimerView();
            expect(player.classList.contains('vjs-mediacms-up-next-hidden')).toBe(true);
            expect(jest.getTimerCount()).toBe(0);
        });

        test('Pauses the timer when the player scrolls out of view and resumes when back', () => {
            view.setVideoJsPlayerElem(player);
            let top = -500;
            jest.spyOn(player, 'getBoundingClientRect').mockImplementation(() => ({ top }) as DOMRect);

            view.startTimer();
            window.dispatchEvent(new Event('scroll'));
            expect(jest.getTimerCount()).toBe(0);
            expect(player.classList.contains('vjs-mediacms-canceled-next')).toBe(true);

            window.dispatchEvent(new Event('scroll'));
            expect(jest.getTimerCount()).toBe(0);

            top = 500;
            window.dispatchEvent(new Event('scroll'));
            expect(jest.getTimerCount()).toBe(1);
            expect(player.classList.contains('vjs-mediacms-canceled-next')).toBe(false);
        });

        test('Timer works without an attached player element', () => {
            const detached = new (UpNextLoaderView as any)(nextItem);
            detached.vjsPlayerElem = document.createElement('div');
            detached.startTimer();
            expect(jest.getTimerCount()).toBe(1);
            detached.cancelTimer();
            expect(jest.getTimerCount()).toBe(0);
        });
    });
});
