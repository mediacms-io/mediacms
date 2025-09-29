import React, { useRef, useState, useEffect } from 'react';
import { ShareOptionsContext } from '../../utils/contexts/';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import ItemsInlineSlider from '../item-list/includes/itemLists/ItemsInlineSlider';
import { CircleIconButton } from '../_shared/';

function shareOptionsList() {
  const socialMedia = ShareOptionsContext._currentValue;
  const mediaUrl = MediaPageStore.get('media-url');
  const mediaTitle = MediaPageStore.get('media-data').title;

  const ret = {};

  let i = 0;

  while (i < socialMedia.length) {
    switch (socialMedia[i]) {
      case 'embed':
        if ('video' === MediaPageStore.get('media-data').media_type || 'audio' === MediaPageStore.get('media-data').media_type) {
          ret[socialMedia[i]] = {};
        }
        break;
      case 'email':
        ret[socialMedia[i]] = {
          title: 'Email',
          shareUrl: 'mailto:?body=' + mediaUrl,
        };
        break;
    }

    i += 1;
  }

  return ret;
}

function ShareOptions() {
  const shareOptions = shareOptionsList();

  const compList = [];

  for (let k in shareOptions) {
    if (shareOptions.hasOwnProperty(k)) {
      if (k === 'embed') {
        compList.push(
          <div key={'share-' + k} className={'sh-option share-' + k + '-opt'}>
            <button className="sh-option change-page" data-page-id="shareEmbed">
              <span>
                <i className="material-icons">code</i>
              </span>
              <span>Embed</span>
            </button>
          </div>
        );
      } else if (k === 'email') {
        compList.push(
          <div key="share-email" className="sh-option share-email">
            <a href={shareOptions[k].shareUrl} title="">
              <span>
                <i className="material-icons">email</i>
              </span>
              <span>{shareOptions[k].title}</span>
            </a>
          </div>
        );
      } else {
        compList.push(
          <div key={'share-' + k} className={'sh-option share-' + k}>
            <a href={shareOptions[k].shareUrl} title="" target="_blank" rel="noreferrer">
              <span></span>
              <span>{shareOptions[k].title}</span>
            </a>
          </div>
        );
      }
    }
  }

  return compList;
}

function NextSlideButton({ onClick }) {
  return (
    <span className="next-slide">
      <CircleIconButton buttonShadow={true} onClick={onClick}>
        <i className="material-icons">keyboard_arrow_right</i>
      </CircleIconButton>
    </span>
  );
}

function PreviousSlideButton({ onClick }) {
  return (
    <span className="previous-slide">
      <CircleIconButton buttonShadow={true} onClick={onClick}>
        <i className="material-icons">keyboard_arrow_left</i>
      </CircleIconButton>
    </span>
  );
}

function updateDimensions() {
  return {
    maxFormContentHeight: window.innerHeight - (56 + 4 * 24 + 44),
    maxPopupWidth: 518 > window.innerWidth - 2 * 40 ? window.innerWidth - 2 * 40 : null,
  };
}

function getTimestamp() {
  const videoPlayer = document.getElementsByTagName("video");
  return videoPlayer[0]?.currentTime;
}

function ToHHMMSS (timeInt) {
  let sec_num = parseInt(timeInt, 10);
  let hours   = Math.floor(sec_num / 3600);
  let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  let seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours   < 10) {hours   = "0"+hours;}
  if (minutes < 10) {minutes = "0"+minutes;}
  if (seconds < 10) {seconds = "0"+seconds;}
  return hours >= 1 ? hours + ':' + minutes + ':' + seconds : minutes + ':' + seconds;
}

export function MediaShareOptions(props) {
  const containerRef = useRef(null);
  const shareOptionsInnerRef = useRef(null);
  const mediaUrl = MediaPageStore.get('media-url');

  const [inlineSlider, setInlineSlider] = useState(null);
  const [sliderButtonsVisible, setSliderButtonsVisible] = useState({ prev: false, next: false });

  const [dimensions, setDimensions] = useState(updateDimensions());
  const [shareOptions] = useState(ShareOptions());

  const [timestamp, setTimestamp] = useState(0);
  const [formattedTimestamp, setFormattedTimestamp] = useState(0);
  const [startAtSelected, setStartAtSelected] = useState(false);

  const [shareMediaLink, setShareMediaLink] = useState(mediaUrl);

  function onWindowResize() {
    setDimensions(updateDimensions());
  }

  function onClickCopyMediaLink() {
    MediaPageActions.copyShareLink(containerRef.current.querySelector('.copy-field input'));
  }

  function onCompleteCopyMediaLink() {
    // FIXME: Without delay throws conflict error [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(function () {
      PageActions.addNotification('Link copied to clipboard', 'clipboardLinkCopy');
    }, 100);
  }

  function updateSlider() {
    inlineSlider.scrollToCurrentSlide();
    updateSliderButtonsView();
  }

  function updateSliderButtonsView() {
    setSliderButtonsVisible({
      prev: inlineSlider.hasPreviousSlide(),
      next: inlineSlider.hasNextSlide(),
    });
  }

  function updateStartAtCheckbox() {
    setStartAtSelected(!startAtSelected);
    updateShareMediaLink();
  }

  function updateShareMediaLink()
  {
      const newLink = startAtSelected ? mediaUrl : mediaUrl + "&t=" + Math.trunc(timestamp);
      setShareMediaLink(newLink);
  }

  function nextSlide() {
    inlineSlider.nextSlide();
    updateSlider();
  }

  function prevSlide() {
    inlineSlider.previousSlide();
    updateSlider();
  }

  useEffect(() => {
    setInlineSlider(new ItemsInlineSlider(shareOptionsInnerRef.current, '.sh-option'));
  }, [shareOptions]);

  useEffect(() => {
    if (inlineSlider) {
      inlineSlider.updateDataStateOnResize(shareOptions.length, true, true);
      updateSlider();
    }
  }, [dimensions, inlineSlider]);

  useEffect(() => {
    PageStore.on('window_resize', onWindowResize);
    MediaPageStore.on('copied_media_link', onCompleteCopyMediaLink);
    
    const localTimestamp = getTimestamp();
    setTimestamp(localTimestamp);
    setFormattedTimestamp(ToHHMMSS(localTimestamp));

    return () => {
      PageStore.removeListener('window_resize', onWindowResize);
      MediaPageStore.removeListener('copied_media_link', onCompleteCopyMediaLink);
      setInlineSlider(null);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={null !== dimensions.maxPopupWidth ? { maxWidth: dimensions.maxPopupWidth + 'px' } : null}
    >
      <div
        className="scrollable-content"
        style={null !== dimensions.maxFormContentHeight ? { maxHeight: dimensions.maxFormContentHeight + 'px' } : null}
      >
        <div className="share-popup-title">Share media</div>
        {shareOptions.length ? (
          <div className="share-options">
            {sliderButtonsVisible.prev ? <PreviousSlideButton onClick={prevSlide} /> : null}
            <div ref={shareOptionsInnerRef} className="share-options-inner">
              {shareOptions}
            </div>
            {sliderButtonsVisible.next ? <NextSlideButton onClick={nextSlide} /> : null}
          </div>
        ) : null}
      </div>
      <div className="copy-field">
        <div>
          <input type="text" readOnly value={shareMediaLink} />
          <button onClick={onClickCopyMediaLink}>COPY</button>
        </div>
      </div>
      <div className="start-at">
          <label>
            <input 
              type="checkbox" 
              name="start-at-checkbox" 
              id="id-start-at-checkbox"
              checked={startAtSelected} 
              onChange={updateStartAtCheckbox}
            />
            Start at {formattedTimestamp}
          </label>
        </div>
    </div>
  );
}