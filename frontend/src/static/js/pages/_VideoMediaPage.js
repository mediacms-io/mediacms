import React from 'react';
// FIXME: 'VideoViewerStore' is used only in case of video media, but is included in every media page code.
import { PageStore, MediaPageStore, VideoViewerStore } from '../utils/stores/';
import { MediaPageActions } from '../utils/actions/';
import { inEmbeddedApp } from '../utils/helpers/';
import ViewerInfoVideo from '../components/media-page/ViewerInfoVideo';
import ViewerError from '../components/media-page/ViewerError';
import ViewerSidebar from '../components/media-page/ViewerSidebar';
import { Page } from './_Page';
import _MediaPage from './_MediaPage';

const wideLayoutBreakpoint = 1216;

export class _VideoMediaPage extends Page {
    constructor(props) {
        super(props, 'media');

        this.state = {
            wideLayout: wideLayoutBreakpoint <= window.innerWidth,
            mediaLoaded: false,
            mediaLoadFailed: false,
            isVideoMedia: false,
            theaterMode: false, // FIXME: Used only in case of video media, but is included in every media page code.
            pagePlaylistLoaded: false,
            pagePlaylistData: MediaPageStore.get('playlist-data'),
        };

        this.onWindowResize = this.onWindowResize.bind(this);
        this.onMediaLoad = this.onMediaLoad.bind(this);
        this.onMediaLoadError = this.onMediaLoadError.bind(this);
        this.onPagePlaylistLoad = this.onPagePlaylistLoad.bind(this);

        MediaPageStore.on('loaded_media_data', this.onMediaLoad);
        MediaPageStore.on('loaded_media_error', this.onMediaLoadError);
        MediaPageStore.on('loaded_page_playlist_data', this.onPagePlaylistLoad);
    }

    componentDidMount() {
        MediaPageActions.loadMediaData();
        // FIXME: Is not neccessary to check on every window dimension for changes...
        PageStore.on('window_resize', this.onWindowResize);
    }

    onWindowResize() {
        this.setState({
            wideLayout: wideLayoutBreakpoint <= window.innerWidth,
        });
    }

    onPagePlaylistLoad() {
        this.setState({
            pagePlaylistLoaded: true,
            pagePlaylistData: MediaPageStore.get('playlist-data'),
        });
    }

    onMediaLoad() {
        const isVideoMedia =
            'video' === MediaPageStore.get('media-type') || 'audio' === MediaPageStore.get('media-type');

        if (isVideoMedia) {
            this.onViewerModeChange = this.onViewerModeChange.bind(this);

            VideoViewerStore.on('changed_viewer_mode', this.onViewerModeChange);

            this.setState({
                mediaLoaded: true,
                isVideoMedia: isVideoMedia,
                theaterMode: VideoViewerStore.get('in-theater-mode'),
            });
        } else {
            this.setState({
                mediaLoaded: true,
                isVideoMedia: isVideoMedia,
            });
        }
    }

    onViewerModeChange() {
        this.setState({ theaterMode: VideoViewerStore.get('in-theater-mode') });
    }

    onMediaLoadError(a) {
        this.setState({ mediaLoadFailed: true });
    }

    pageContent() {
        const viewerClassname = 'cf viewer-section' + (this.state.theaterMode ? ' theater-mode' : ' viewer-wide');
        const viewerNestedClassname = 'viewer-section-nested' + (this.state.theaterMode ? ' viewer-section' : '');

        return this.state.mediaLoadFailed ? (
            <div className={viewerClassname}>
                <ViewerError />
            </div>
        ) : (
            <div className={viewerClassname}>
                {[
                    <div className="viewer-container" key="viewer-container">
                        {this.state.mediaLoaded && this.state.pagePlaylistLoaded
                            ? this.viewerContainerContent(MediaPageStore.get('media-data'))
                            : null}
                    </div>,
                    <div key="viewer-section-nested" className={viewerNestedClassname}>
                        {!this.state.wideLayout || (this.state.isVideoMedia && this.state.theaterMode)
                            ? [
                                  <ViewerInfoVideo key="viewer-info" />,
                                  !inEmbeddedApp() && this.state.pagePlaylistLoaded ? (
                                      <ViewerSidebar
                                          key="viewer-sidebar"
                                          mediaId={MediaPageStore.get('media-id')}
                                          playlistData={MediaPageStore.get('playlist-data')}
                                      />
                                  ) : null,
                              ]
                            : [
                                  !inEmbeddedApp() && this.state.pagePlaylistLoaded ? (
                                      <ViewerSidebar
                                          key="viewer-sidebar"
                                          mediaId={MediaPageStore.get('media-id')}
                                          playlistData={MediaPageStore.get('playlist-data')}
                                      />
                                  ) : null,
                                  <ViewerInfoVideo key="viewer-info" />,
                              ]}
                    </div>,
                ]}
            </div>
        );
    }
}
