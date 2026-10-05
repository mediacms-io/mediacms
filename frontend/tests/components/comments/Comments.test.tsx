import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click, changeValue } from '../../_support/compD_dom';
import { MediaPageStore, PageStore } from '../../../src/static/js/utils/stores/';
import { MediaPageActions, PageActions } from '../../../src/static/js/utils/actions/';
import { UserProvider } from '../../../src/static/js/utils/contexts/UserContext';
import { LinksContext } from '../../../src/static/js/utils/contexts/LinksContext';
import CommentsListComponent from '../../../src/static/js/components/comments/Comments';

function CommentsList() {
    return (
        <UserProvider>
            <CommentsListComponent />
        </UserProvider>
    );
}

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());

const mediaStore = MediaPageStore as any;

function comment(uid: string, add_date: string, text: string) {
    return { uid, add_date, text, author_name: 'Author ' + uid, author_profile: '/user/' + uid, author_thumbnail_url: '/thumbs/' + uid + '.jpg' };
}

describe('components/comments', () => {
    describe('CommentsList', () => {
        let pageMain: HTMLElement;

        beforeEach(() => {
            jest.useFakeTimers();
            jest.clearAllMocks();
            pageMain = document.createElement('div');
            pageMain.className = 'page-main';
            document.body.appendChild(pageMain);
            (PageStore as any).__reset({ 'config-contents': { uploader: { postUploadMessage: '' } } });
            mediaStore.__reset({
                'media-id': 'm1',
                'media-data': { enable_comments: true, state: 'public' },
                'media-comments': [comment('a', '2024-01-01T00:00:00Z', 'first'), comment('b', '2024-02-01T00:00:00Z', 'second\nline')],
            });
        });

        afterEach(() => {
            pageMain.remove();
            jest.useRealTimers();
        });

        function texts(container: HTMLElement) {
            return Array.from(container.querySelectorAll('.comment-text-inner')).map((t) => t.innerHTML);
        }

        test('Lists comments newest first and toggles ordering', () => {
            const { container, unmount } = renderIntoContainer(<CommentsList />);
            expect(container.querySelector('h2')?.firstChild?.textContent).toBe('2 Comments');
            expect(texts(container)).toEqual(['second<br>line', 'first']);
            const author = container.querySelector('.comment-author a') as HTMLAnchorElement;
            expect(author.getAttribute('href')).toBe('/user/b');
            expect(author.textContent).toBe('Author b');
            expect(container.querySelector('.comment-author-thumb img')?.getAttribute('src')).toMatch(/^https:\/\/example\.com\/+thumbs\/b\.jpg$/);
            expect(container.querySelector('.comment-date')?.textContent).not.toBe('');
            expect(container.querySelector('.comments-order-label')?.textContent).toBe('Newest first');
            click(container.querySelector('.comments-order-toggle'));
            expect(container.querySelector('.comments-order-label')?.textContent).toBe('Oldest first');
            expect(texts(container)).toEqual(['first', 'second<br>line']);
            unmount();
        });

        test('Shows singular header and empty state', () => {
            mediaStore.__set('media-comments', [comment('a', '2024-01-01T00:00:00Z', 'only')]);
            const one = renderIntoContainer(<CommentsList />);
            expect(one.container.querySelector('h2')?.firstChild?.textContent).toBe('1 Comment');
            one.unmount();

            mediaStore.__set('media-comments', []);
            const none = renderIntoContainer(<CommentsList />);
            expect(none.container.querySelector('h2')?.textContent).toBe('No comment yet');
            expect(none.container.querySelector('.comments-order-toggle')).toBeNull();
            expect(none.container.querySelector('.comment')).toBeNull();
            none.unmount();
        });

        test('Shows disabled message and hides the form when comments are disabled', () => {
            mediaStore.__set('media-data', { enable_comments: false });
            const { container, unmount } = renderIntoContainer(<CommentsList />);
            expect(container.querySelector('.disabled-comments-msg')?.textContent).toBe('Comments are disabled');
            expect(container.querySelector('.comments-form')).toBeNull();
            expect(container.querySelectorAll('.comment').length).toBe(2);
            unmount();
        });

        test('Submits a trimmed comment only after changes', () => {
            const { container, unmount } = renderIntoContainer(<CommentsList />);
            const button = () => container.querySelector('.comments-form .form-buttons button') as HTMLButtonElement;
            expect(button().className).toBe('disabled');
            click(button());
            expect((MediaPageActions as any).submitComment).not.toHaveBeenCalled();
            const textarea = container.querySelector('textarea.form-textarea') as HTMLTextAreaElement;
            act(() => {
                textarea.focus();
            });
            expect(container.querySelector('.form-textarea-wrap')?.className).toContain('focused');
            changeValue(textarea, '  hello  ');
            expect(button().className).toBe('');
            click(button());
            expect((MediaPageActions as any).submitComment).toHaveBeenCalledWith('hello');
            act(() => {
                textarea.blur();
            });
            expect(container.querySelector('.form-textarea-wrap')?.className).not.toContain('focused');
            unmount();
        });

        test('Whitespace only comments are not submitted', () => {
            const { container, unmount } = renderIntoContainer(<CommentsList />);
            changeValue(container.querySelector('textarea.form-textarea'), '   ');
            click(container.querySelector('.comments-form .form-buttons button'));
            expect((MediaPageActions as any).submitComment).not.toHaveBeenCalled();
            unmount();
        });

        test('Successful submit clears the form, reloads comments with timestamp links and notifies', () => {
            const { container, unmount } = renderIntoContainer(<CommentsList />);
            const textarea = container.querySelector('textarea.form-textarea') as HTMLTextAreaElement;
            changeValue(textarea, 'new one');
            mediaStore.__set('media-comments', [comment('c', '2024-03-01T00:00:00Z', 'see 1:02:03 and 4:05')]);
            act(() => {
                mediaStore.emit('comment_submit', 'c');
            });
            expect(textarea.value).toBe('');
            expect(container.querySelector('h2')?.firstChild?.textContent).toBe('1 Comment');
            const anchors = Array.from(container.querySelectorAll('.comment-text-inner a.video-timestamp')) as HTMLAnchorElement[];
            expect(anchors.map((a) => [a.textContent, a.getAttribute('data-timestamp')])).toEqual([
                ['1:02:03', '3723'],
                ['4:05', '245'],
            ]);
            act(() => {
                jest.advanceTimersByTime(100);
            });
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Comment added', 'commentSubmit');
            unmount();
        });

        test('Submit and delete failures and deletions notify after a delay', () => {
            const { unmount } = renderIntoContainer(<CommentsList />);
            act(() => {
                mediaStore.emit('comment_submit_fail');
                mediaStore.emit('comment_delete_fail', 'a');
                mediaStore.emit('comment_delete', 'a');
            });
            act(() => {
                jest.advanceTimersByTime(100);
            });
            const calls = (PageActions as any).addNotification.mock.calls;
            expect(calls).toEqual(
                expect.arrayContaining([
                    ['Comment submission failed', 'commentSubmitFail'],
                    ['Comment removal failed', 'commentDeleteFail'],
                    ['Comment removed', 'commentDelete'],
                ])
            );
            unmount();
            expect(mediaStore.listenerCount('comments_load')).toBe(0);
            expect(mediaStore.listenerCount('comment_submit')).toBe(0);
        });

        test('Delete popup dispatches deleteComment for the comment', () => {
            const { container, unmount } = renderIntoContainer(<CommentsList />);
            const removeWrap = container.querySelector('.comment .remove-comment') as HTMLElement;
            expect(removeWrap.querySelector('button')?.textContent).toBe('DELETE COMMENT');
            click(removeWrap.querySelector('button'));
            expect(removeWrap.querySelector('.popup-message-title')?.textContent).toBe('Comment removal');
            click(removeWrap.querySelector('.cancel-comment-removal'));
            expect(removeWrap.querySelector('.popup-message')).toBeNull();
            expect((MediaPageActions as any).deleteComment).not.toHaveBeenCalled();
            click(removeWrap.querySelector('button'));
            click(removeWrap.querySelector('.proceed-comment-removal'));
            expect((MediaPageActions as any).deleteComment).toHaveBeenCalledWith('b');
            unmount();
        });

        function addNoCommentAlert() {
            const alert = document.createElement('div');
            alert.className = 'alert info no-comment';
            pageMain.appendChild(alert);
            return alert;
        }

        function loadComments(list: any[]) {
            mediaStore.__set('media-comments', list);
            act(() => {
                mediaStore.emit('comments_load');
            });
        }

        test('Loading no comments removes a leftover no-comment alert when there is no post upload message', () => {
            const alert = addNoCommentAlert();
            const { unmount } = renderIntoContainer(<CommentsList />);
            expect(() => loadComments([])).not.toThrow();
            expect(alert.isConnected).toBe(false);
            unmount();
        });

        test('Loading comments removes the no-comment alert when a post upload message is configured', () => {
            (PageStore as any).__set('config-contents', { uploader: { postUploadMessage: 'Share it!' } });
            const alert = addNoCommentAlert();
            const { unmount } = renderIntoContainer(<CommentsList />);
            expect(() => loadComments([comment('a', '2024-01-01T00:00:00Z', 'hi')])).not.toThrow();
            expect(alert.isConnected).toBe(false);
            unmount();
        });

        test('The owner of an unlisted media without comments sees the post upload message', () => {
            (PageStore as any).__set('config-contents', { uploader: { postUploadMessage: 'Share it with your class' } });
            const ownProfile = (LinksContext as any)._currentValue.profile.media;
            mediaStore.__set('media-data', { enable_comments: true, state: 'unlisted', author_profile: ownProfile });
            const { unmount } = renderIntoContainer(<CommentsList />);
            expect(() => loadComments([])).not.toThrow();
            const alert = pageMain.querySelector('.no-comment');
            expect(alert?.textContent).toContain('Share it with your class');
            unmount();
        });

        test('Submitting a comment while a post upload message is configured does not throw', () => {
            (PageStore as any).__set('config-contents', { uploader: { postUploadMessage: 'Share it!' } });
            const { unmount } = renderIntoContainer(<CommentsList />);
            mediaStore.__set('media-comments', [comment('c', '2024-03-01T00:00:00Z', 'new')]);
            expect(() =>
                act(() => {
                    mediaStore.emit('comment_submit', 'c');
                })
            ).not.toThrow();
            unmount();
        });
    });
});
