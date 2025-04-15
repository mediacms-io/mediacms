import React from 'react';
import PropTypes from 'prop-types';
import { MediaPageStore } from '../../utils/stores/';
import { CircleIconButton } from '../_shared/';
import { translateString } from '../../utils/helpers/';

import './ChaptersView.scss';

export default class ChaptersView extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      expanded: true,
      activeChapter: null,
      // TODO: keep only chapters: props.chapters || [] after testing
      chapters: props.chapters || [
        {
          id: "ajc9CJ",
          title: "Introduction",
          timestamp: "00:00:04.000"
        },
        {
          id: "451a",
          title: "Main Content",
          timestamp: "00:00:12.235"
        },
        {
          id: "789b",
          title: "Conclusion",
          timestamp: "00:00:21.135"
        },
        {
          id: "123d",
          title: "Chapter 4",
          timestamp: "00:00:37.000"
        },
        {
          id: "456e",
          title: "Chapter 5",
          timestamp: "00:00:55.000"
        },
        {
          id: "789g",
          title: "Chapter 6",
          timestamp: "00:01:00.000"
        },
        {
          id: "123h",
          title: "Chapter 7",
          timestamp: "00:01:15.000"
        },
        {
          id: "456i",           
          title: "Chapter 8",
          timestamp: "00:01:30.000"
        },
        {
          id: "789j",
          title: "Chapter 9",
          timestamp: "00:01:45.000"
        },
        {
          id: "123k",
          title: "Chapter 10",
          timestamp: "00:02:00.000"
        }
      ],
    };

    this.onHeaderClick = this.onHeaderClick.bind(this);
    this.onTimeUpdate = this.onTimeUpdate.bind(this);
  }

  componentDidMount() {
    // Listen for video player initialization
    MediaPageStore.on('video_player_initialized', this.onTimeUpdate);
    // Also check if player is already initialized
    const videoPlayer = document.querySelector('video');
    if (videoPlayer) {
      videoPlayer.addEventListener('timeupdate', this.onTimeUpdate);
    }
  }

  componentWillUnmount() {
    MediaPageStore.removeListener('video_player_initialized', this.onTimeUpdate);
    const videoPlayer = document.querySelector('video');
    if (videoPlayer) {
      videoPlayer.removeEventListener('timeupdate', this.onTimeUpdate);
    }
  }

  onHeaderClick(ev) {
    this.setState({ expanded: !this.state.expanded });
  }

  onTimeUpdate() {
    const videoPlayer = document.querySelector('video');
    if (!videoPlayer) return;

    const currentTime = videoPlayer.currentTime;
    let activeChapter = null;

    // Find the current chapter based on video time
    for (let i = this.state.chapters.length - 1; i >= 0; i--) {
      const chapter = this.state.chapters[i];
      const timeArray = chapter.timestamp.split(':');
      let s = 0;
      let m = 1;

      while (timeArray.length > 0) {
        s += m * parseInt(timeArray.pop(), 10);
        m *= 60;
      }

      if (currentTime >= s) {
        activeChapter = chapter.id;
        break;
      }
    }

    if (activeChapter !== this.state.activeChapter) {
      this.setState({ activeChapter });
    }
  }

  updateUrlWithTimestamp(timestamp) {
    const url = new URL(window.location.href);
    url.searchParams.delete('t');
    window.history.pushState({}, '', url);
  }

  render() {
    if (this.state.chapters.length === 0) {
      return null;
    }

    return (
      <div className="chapters-view-wrap">
        <div className={'chapters-view' + (!this.state.expanded ? '' : ' chapters-expanded-view')}>
          <div className="chapters-header">
            <div className="chapters-title">{translateString("Chapters")}</div>
            <CircleIconButton className="toggle-chapters-view" onClick={this.onHeaderClick}>
              {this.state.expanded ? (
                <i className="material-icons">keyboard_arrow_up</i>
              ) : (
                <i className="material-icons">keyboard_arrow_down</i>
              )}
            </CircleIconButton>
          </div>

          {!this.state.expanded ? null : (
            <div className="chapters-list">
              {this.state.chapters.map((chapter, index) => {
                const timeArray = chapter.timestamp.split(':');
                let s = 0;
                let m = 1;

                while (timeArray.length > 0) {
                  s += m * parseInt(timeArray.pop(), 10);
                  m *= 60;
                }

                return (
                  <div 
                    key={chapter.id} 
                    className={'chapter-item' + (this.state.activeChapter === chapter.id ? ' active' : '')}
                  >
                    <button 
                      type="button"
                      data-timestamp={s} 
                      className="video-timestamp chapter-button"
                      onClick={() => this.updateUrlWithTimestamp(s)}
                    >
                      {chapter.title}
                      <span className="chapter-timestamp">{chapter.timestamp}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
}

ChaptersView.propTypes = {
  chapters: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      timestamp: PropTypes.string.isRequired
    })
  )
}; 