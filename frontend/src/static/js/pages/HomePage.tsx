import React, { useState } from 'react';
import { ApiUrlConsumer, LinksConsumer } from '../utils/contexts/';
import { PageStore } from '../utils/stores/';
import { MediaListRow } from '../components/MediaListRow';
import { MediaMultiListWrapper } from '../components/MediaMultiListWrapper';
import { ItemListAsync } from '../components/item-list/ItemListAsync.jsx';
import { InlineSliderItemListAsync } from '../components/item-list/InlineSliderItemListAsync.jsx';
import { Page } from './Page';

const EmptyMedia: React.FC = ({}) => {
  return (
    <LinksConsumer>
      {(links) => (
        <div className="empty-media">
          <div className="welcome-title">Welcome to MediaCMS!</div>
          <div className="start-uploading">Start uploading media and sharing your work!</div>
          <a href={links.user.addMedia} title="Upload media" className="button-link">
            <i className="material-icons" data-icon="video_call"></i>UPLOAD MEDIA
          </a>
        </div>
      )}
    </LinksConsumer>
  );
};

interface HomePageProps {
  id?: string;
  latest_title: string;
  featured_title: string;
  recommended_title: string;
  latest_view_all_link: boolean;
  featured_view_all_link: boolean;
  recommended_view_all_link: boolean;
}

interface TranslatedMediaObject {
  friendly_token: string;
  url: string;
  api_url: string;
  user: string;
  title: string,
  description: string;
  add_date: string;
  views: number;
  media_type: string;
  state: string;
  duration: number;
  thumbnail_url: string;
  is_reviewed: boolean;
  author_name: string;
  author_profile: string;
  author_thumbnail: string;
  encoding_status: string;
  likes: number;
  dislikes: number;
  featured: boolean;
  user_featured: boolean;
  size: string;
}

interface TranslatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TranslatedMediaObject[];
}

export const HomePage: React.FC<HomePageProps> = ({
  id = 'home',
  featured_title = PageStore.get('config-options').pages.home.sections.featured.title,
  recommended_title = PageStore.get('config-options').pages.home.sections.recommended.title,
  latest_title = PageStore.get('config-options').pages.home.sections.latest.title,
  latest_view_all_link = false,
  featured_view_all_link = true,
  recommended_view_all_link = true,
}) => {
  const [zeroMedia, setZeroMedia] = useState(false);
  const [visibleLatest, setVisibleLatest] = useState(false);
  const [visibleFeatured, setVisibleFeatured] = useState(false);
  const [visibleLive, setVisibleLive] = useState(false);
  const [visibleRecommended, setVisibleRecommended] = useState(false);

  const onLoadLatest = (length: number) => {
    setVisibleLatest(0 < length);
    setZeroMedia(0 === length);
  };
  
  const translateLive = (response: any): object => {
    let translatedResponse:TranslatedResponse = {
        count: 0,
        next: null,
        previous: null,
        results: []
      };
    if (response.data.online) {
      translatedResponse.count = 1;
      translatedResponse.results.push({
          "friendly_token": "*********",
          "url": window.MediaCMS.site.livestream.uri,
          "api_url": window.MediaCMS.site.livestream.uri,
          "user": "live",
          "title": (response.data.streamTitle || "Live now"),
          "description": "Watch live now",
          "add_date": response.data.lastConnectTime,
          "views": response.data.viewerCount,
          "media_type": "video",
          "state": "public",
          "duration": Math.floor(((new Date()).getTime() - new Date(Date.parse(response.data.lastConnectTime)).getTime()) / 1000),
          "thumbnail_url": (window.MediaCMS.site.livestream.uri + "/thumbnail.jpg"),
          "is_reviewed": true,
          "author_name": "Live stream",
          "author_profile": window.MediaCMS.site.livestream.uri,
          "author_thumbnail": "/media/userlogos/user.jpg",
          "encoding_status": "success",
          "likes": 1,
          "dislikes": 0,
          "featured": true,
          "user_featured": false,
          "size": "999MB"
        });
    }
    return {
        "data": translatedResponse,
        "status": response.status,
        "statusText": response.statusText
      };
  };

  const onLoadLive = (length: number) => {
    setVisibleLive(0 < length);
  };

  const onLoadFeatured = (length: number) => {
    setVisibleFeatured(0 < length);
  };

  const onLoadRecommended = (length: number) => {
    setVisibleRecommended(0 < length);
  };

  return (
    <Page id={id}>
      <LinksConsumer>
        {(links) => (
          <ApiUrlConsumer>
            {(apiUrl) => (
              <MediaMultiListWrapper className="items-list-ver">
                {window.MediaCMS.site.livestream && window.MediaCMS.site.livestream.backend == "owncast" && 
                  window.MediaCMS.site.livestream.uri && (
                    <MediaListRow
                      title="Live"
                      style={!visibleLive ? { display: 'none' } : undefined}
                    >
                      <InlineSliderItemListAsync
                        requestUrl={window.MediaCMS.site.livestream.uri + "/api/status"}
                        translateCallback={translateLive}
                        itemsCountCallback={onLoadLive}
                        hideViews={!PageStore.get('config-media-item').displayViews}
                        hideAuthor={!PageStore.get('config-media-item').displayAuthor}
                        hideDate={!PageStore.get('config-media-item').displayPublishDate}
                      />
                    </MediaListRow>
                  )}

                {PageStore.get('config-enabled').pages.featured &&
                  PageStore.get('config-enabled').pages.featured.enabled && (
                    <MediaListRow
                      title={featured_title}
                      style={!visibleFeatured ? { display: 'none' } : undefined}
                      viewAllLink={featured_view_all_link ? links.featured : null}
                    >
                      <InlineSliderItemListAsync
                        requestUrl={apiUrl.featured}
                        itemsCountCallback={onLoadFeatured}
                        hideViews={!PageStore.get('config-media-item').displayViews}
                        hideAuthor={!PageStore.get('config-media-item').displayAuthor}
                        hideDate={!PageStore.get('config-media-item').displayPublishDate}
                      />
                    </MediaListRow>
                  )}

                {PageStore.get('config-enabled').pages.recommended &&
                  PageStore.get('config-enabled').pages.recommended.enabled && (
                    <MediaListRow
                      title={recommended_title}
                      style={!visibleRecommended ? { display: 'none' } : undefined}
                      viewAllLink={recommended_view_all_link ? links.recommended : null}
                    >
                      <InlineSliderItemListAsync
                        requestUrl={apiUrl.recommended}
                        itemsCountCallback={onLoadRecommended}
                        hideViews={!PageStore.get('config-media-item').displayViews}
                        hideAuthor={!PageStore.get('config-media-item').displayAuthor}
                        hideDate={!PageStore.get('config-media-item').displayPublishDate}
                      />
                    </MediaListRow>
                  )}

                <MediaListRow
                  title={latest_title}
                  style={!visibleLatest ? { display: 'none' } : undefined}
                  viewAllLink={latest_view_all_link ? links.latest : null}
                >
                  <ItemListAsync
                    pageItems={30}
                    requestUrl={apiUrl.media}
                    itemsCountCallback={onLoadLatest}
                    hideViews={!PageStore.get('config-media-item').displayViews}
                    hideAuthor={!PageStore.get('config-media-item').displayAuthor}
                    hideDate={!PageStore.get('config-media-item').displayPublishDate}
                  />
                </MediaListRow>

                {zeroMedia && <EmptyMedia />}
              </MediaMultiListWrapper>
            )}
          </ApiUrlConsumer>
        )}
      </LinksConsumer>
    </Page>
  );
};
