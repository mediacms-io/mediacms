import React from 'react';
import { PageStore, MediaPageStore } from '../utils/stores/';
import { MediaPageActions } from '../utils/actions/';
import { inEmbeddedApp } from '../utils/helpers/';
import ViewerError from '../components/media-page/ViewerError';
import ViewerInfo from '../components/media-page/ViewerInfo';
import ViewerSidebar from '../components/media-page/ViewerSidebar';
import { Page } from './_Page';
import '../components/media-page/MediaPage.scss';

const wideLayoutBreakpoint = 1216;

export class _MediaPage extends Page {
    constructor(props) {
        super(props, 'media');

        const isWideLayout = wideLayoutBreakpoint <= window.innerWidth;

        this.state = {
            mediaLoaded: false,
            mediaLoadFailed: false,
            wideLayout: isWideLayout,
            infoAndSidebarViewType: !isWideLayout ? 0 : 1,
            viewerClassname: 'cf viewer-section viewer-wide',
            viewerNestedClassname: 'viewer-section-nested',
            pagePlaylistLoaded: false,
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

    onPagePlaylistLoad() {
        this.setState({
            pagePlaylistLoaded: true,
        });
    }

    onWindowResize() {
        const isWideLayout = wideLayoutBreakpoint <= window.innerWidth;

        this.setState({
            wideLayout: isWideLayout,
            infoAndSidebarViewType: !isWideLayout || (MediaPageStore.isVideo() && this.state.theaterMode) ? 0 : 1,
        });
    }

    onMediaLoad() {
        this.setState({ mediaLoaded: true });
    }

    onMediaLoadError() {
        this.setState({ mediaLoadFailed: true });
    }

    viewerContainerContent() {
        return null;
    }

    mediaType() {
        return null;
    }

    pageContent() {
        return this.state.mediaLoadFailed ? (
            <div className={this.state.viewerClassname}>
                <ViewerError />
            </div>
        ) : (
            <div className={this.state.viewerClassname}>
                <div className="viewer-container" key="viewer-container">
                    {this.state.mediaLoaded ? this.viewerContainerContent() : null}
                </div>
                <div key="viewer-section-nested" className={this.state.viewerNestedClassname}>
                    {!this.state.infoAndSidebarViewType
                        ? [
                              <ViewerInfo key="viewer-info" />,
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
                              <ViewerInfo key="viewer-info" />,
                          ]}
                </div>
            </div>
        );
    }
}
