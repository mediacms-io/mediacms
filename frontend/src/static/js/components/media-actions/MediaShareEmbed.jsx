import React, { useRef, useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { LinksContext, SiteConsumer } from '../../utils/contexts/';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import { CircleIconButton, MaterialIcon, NumericInputWithUnit } from '../_shared/';

export function MediaShareEmbed(props) {
  const embedVideoDimensions = PageStore.get('config-options').embedded.video.dimensions;

  const links = useContext(LinksContext);

  const aspectRatioValueRef = useRef(null);
  const onRightRef = useRef(null);
  const onRightTopRef = useRef(null);
  const onRightMiddleRef = useRef(null);
  const onRightBottomRef = useRef(null);

  const [maxHeight, setMaxHeight] = useState(window.innerHeight - 144 + 56);
  const [keepAspectRatio, setKeepAspectRatio] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showRelated, setShowRelated] = useState(true);
  const [showUserAvatar, setShowUserAvatar] = useState(true);
  const [linkTitle, setLinkTitle] = useState(true);
  const [responsive, setResponsive] = useState(true);
  const [startAt, setStartAt] = useState(false);
  const [startTime, setStartTime] = useState('0:00');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [embedWidthValue, setEmbedWidthValue] = useState(embedVideoDimensions.width);
  const [embedWidthUnit, setEmbedWidthUnit] = useState(embedVideoDimensions.widthUnit);
  const [embedHeightValue, setEmbedHeightValue] = useState(embedVideoDimensions.height);
  const [embedHeightUnit, setEmbedHeightUnit] = useState(embedVideoDimensions.heightUnit);
  const [rightMiddlePositionTop, setRightMiddlePositionTop] = useState(60);
  const [rightMiddlePositionBottom, setRightMiddlePositionBottom] = useState(60);
  const [unitOptions, setUnitOptions] = useState([
    { key: 'px', label: 'px' },
    { key: 'percent', label: '%' },
  ]);

  function onClickCopyMediaLink() {
    MediaPageActions.copyEmbedMediaCode(onRightMiddleRef.current.querySelector('textarea'));
  }

  function onClickEmbedShareExit() {
    if (void 0 !== props.triggerPopupClose) {
      props.triggerPopupClose();
    }
  }

  function onEmbedWidthValueChange(newVal) {
    newVal = '' === newVal ? 0 : newVal;

    const arr = aspectRatio.split(':');
    const x = arr[0];
    const y = arr[1];

    setEmbedWidthValue(newVal);
    setEmbedHeightValue(keepAspectRatio ? parseInt((newVal * y) / x, 10) : embedHeightValue);
  }

  function onEmbedWidthUnitChange(newVal) {
    setEmbedWidthUnit(newVal);
  }

  function onEmbedHeightValueChange(newVal) {
    newVal = '' === newVal ? 0 : newVal;

    const arr = aspectRatio.split(':');
    const x = arr[0];
    const y = arr[1];

    setEmbedHeightValue(newVal);
    setEmbedWidthValue(keepAspectRatio ? parseInt((newVal * x) / y, 10) : embedWidthValue);
  }

  function onEmbedHeightUnitChange(newVal) {
    setEmbedHeightUnit(newVal);
  }

  function onShowTitleChange() {
    setShowTitle(!showTitle);
  }

  function onShowRelatedChange() {
    setShowRelated(!showRelated);
  }

  function onShowUserAvatarChange() {
    setShowUserAvatar(!showUserAvatar);
  }

  function onLinkTitleChange() {
    setLinkTitle(!linkTitle);
  }

  function onResponsiveChange() {
    const nextResponsive = !responsive;
    setResponsive(nextResponsive);

    if (!nextResponsive) {
      const arr = aspectRatio.split(':');
      const x = arr[0];
      const y = arr[1];

      setKeepAspectRatio(true);
      setEmbedWidthUnit('px');
      setEmbedHeightUnit('px');
      setEmbedHeightValue(parseInt((embedWidthValue * y) / x, 10));
      setUnitOptions([{ key: 'px', label: 'px' }]);
    } else {
      setKeepAspectRatio(false);
      setUnitOptions([
        { key: 'px', label: 'px' },
        { key: 'percent', label: '%' },
      ]);
    }
  }

  function onStartAtChange() {
    setStartAt(!startAt);
  }

  function onStartTimeChange(e) {
    setStartTime(e.target.value);
  }

  function onAspectRatioChange() {
    const newVal = aspectRatioValueRef.current.value;

    const arr = newVal.split(':');
    const x = arr[0];
    const y = arr[1];

    setAspectRatio(newVal);
    setEmbedHeightValue(keepAspectRatio ? parseInt((embedWidthValue * y) / x, 10) : embedHeightValue);
  }

  function onWindowResize() {
    setMaxHeight(window.innerHeight - 144 + 56);
    setRightMiddlePositionTop(onRightTopRef.current.offsetHeight);
    setRightMiddlePositionBottom(onRightBottomRef.current.offsetHeight);
  }

  function onCompleteCopyMediaLink() {
    setTimeout(function () {
      PageActions.addNotification('Embed media code copied to clipboard', 'clipboardEmbedMediaCodeCopy');
    }, 100);
  }

  useEffect(() => {
    setMaxHeight(window.innerHeight - 144 + 56);
    setRightMiddlePositionTop(onRightTopRef.current.offsetHeight);
    setRightMiddlePositionBottom(onRightBottomRef.current.offsetHeight);
  });

  useEffect(() => {
    PageStore.on('window_resize', onWindowResize);
    MediaPageStore.on('copied_embed_media_code', onCompleteCopyMediaLink);
    return () => {
      PageStore.removeListener('window_resize', onWindowResize);
      MediaPageStore.removeListener('copied_embed_media_code', onCompleteCopyMediaLink);
    };
  }, []);

  function getEmbedCode() {
    const mediaId = MediaPageStore.get('media-id');
    const params = new URLSearchParams();
    if (showTitle) params.set('showTitle', '1');
    else params.set('showTitle', '0');
    
    if (showRelated) params.set('showRelated', '1');
    else params.set('showRelated', '0');
    
    if (showUserAvatar) params.set('showUserAvatar', '1');
    else params.set('showUserAvatar', '0');
    
    if (linkTitle) params.set('linkTitle', '1');
    else params.set('linkTitle', '0');

    if (startAt && startTime) {
      const parts = startTime.split(':').reverse();
      let seconds = 0;
      if (parts[0]) seconds += parseInt(parts[0], 10) || 0;
      if (parts[1]) seconds += (parseInt(parts[1], 10) || 0) * 60;
      if (parts[2]) seconds += (parseInt(parts[2], 10) || 0) * 3600;
      if (seconds > 0) params.set('t', seconds);
    }

    const separator = links.embed.includes('?') ? '&' : '?';
    const finalUrl = `${links.embed}${mediaId}${separator}${params.toString()}`;

    if (responsive) {
      return `<iframe src="${finalUrl}" width="100%" height="100%" frameBorder="0" allowFullScreen></iframe>`;
    }

    const width = 'percent' === embedWidthUnit ? embedWidthValue + '%' : embedWidthValue;
    const height = 'percent' === embedHeightUnit ? embedHeightValue + '%' : embedHeightValue;
    return `<iframe width="${width}" height="${height}" src="${finalUrl}" frameBorder="0" allowFullScreen></iframe>`;
  }

  return (
    <div className="share-embed" style={{ maxHeight: maxHeight + 'px' }}>
      <div className="share-embed-inner">
        <div className="on-left">
          <div className="media-embed-wrap">
            <SiteConsumer>
              {(site) => {
                const previewUrl = `${links.embed + MediaPageStore.get('media-id')}&showTitle=${showTitle ? '1' : '0'}&showRelated=${showRelated ? '1' : '0'}&showUserAvatar=${showUserAvatar ? '1' : '0'}&linkTitle=${linkTitle ? '1' : '0'}${startAt ? '&t=' + (startTime.split(':').reverse().reduce((acc, cur, i) => acc + (parseInt(cur, 10) || 0) * Math.pow(60, i), 0)) : ''}`;
                
                const style = {};
                style.width = '100%';
                style.height = '480px';
                style.overflow = 'hidden';

                return (
                  <div style={style}>
                    <iframe width="100%" height="100%" src={previewUrl} frameBorder="0" allowFullScreen></iframe>
                  </div>
                );
              }}
            </SiteConsumer>
          </div>
        </div>

        <div ref={onRightRef} className="on-right">
          <div ref={onRightTopRef} className="on-right-top">
            <div className="on-right-top-inner">
              <span className="ttl">Embed Video</span>
              <CircleIconButton type="button" onClick={onClickEmbedShareExit}>
                <MaterialIcon type="close" />
              </CircleIconButton>
            </div>
          </div>

          <div
            ref={onRightMiddleRef}
            className="on-right-middle"
            style={{ top: rightMiddlePositionTop + 'px', bottom: rightMiddlePositionBottom + 'px' }}
          >
            <textarea
              readOnly
              value={getEmbedCode()}
            ></textarea>

            <div className="iframe-config">
              <div className="iframe-config-options-title">Embed options</div>

              <div className="iframe-config-option">
                {/*<div className="option-title">
										<span>Dimensions</span>
									</div>*/}

                <div className="option-content">
                  <div className="ratio-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                    <div className="options-group">
                      <label style={{ minHeight: '36px', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={showTitle} onChange={onShowTitleChange} />
                        Show title
                      </label>
                    </div>

                    <div className="options-group">
                      <label style={{ minHeight: '36px', whiteSpace: 'nowrap', opacity: showTitle ? 1 : 0.5 }}>
                        <input type="checkbox" checked={linkTitle} onChange={onLinkTitleChange} disabled={!showTitle} />
                        Link title
                      </label>
                    </div>

                    <div className="options-group">
                      <label style={{ minHeight: '36px', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={showRelated} onChange={onShowRelatedChange} />
                        Show related
                      </label>
                    </div>

                    <div className="options-group">
                      <label style={{ minHeight: '36px', whiteSpace: 'nowrap', opacity: showTitle ? 1 : 0.5 }}>
                        <input type="checkbox" checked={showUserAvatar} onChange={onShowUserAvatarChange} disabled={!showTitle} />
                        Show user avatar
                      </label>
                    </div>

                    <div className="options-group" style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ minHeight: '36px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                        <input type="checkbox" checked={responsive} onChange={onResponsiveChange} />
                        Responsive
                      </label>
                    </div>

                    <div className="options-group" style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ minHeight: '36px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                        <input type="checkbox" checked={startAt} onChange={onStartAtChange} />
                        Start at
                      </label>
                      {startAt && (
                        <input 
                          type="text" 
                          value={startTime} 
                          onChange={onStartTimeChange} 
                          style={{ width: '60px', height: '28px', fontSize: '12px', padding: '2px 5px' }} 
                        />
                      )}
                    </div>

                    {!responsive && (
                      <div className="options-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '12px', marginBottom: '4px', color: 'rgba(0,0,0,0.6)' }}>Aspect Ratio</div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <select 
                            ref={aspectRatioValueRef} 
                            onChange={onAspectRatioChange} 
                            value={aspectRatio}
                            style={{ height: '28px', fontSize: '12px' }}
                          >
                            <optgroup label="Horizontal orientation">
                              <option value="16:9">16:9</option>
                              <option value="4:3">4:3</option>
                              <option value="3:2">3:2</option>
                            </optgroup>
                            <optgroup label="Vertical orientation">
                              <option value="9:16">9:16</option>
                              <option value="3:4">3:4</option>
                              <option value="2:3">2:3</option>
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <br />

                  {!responsive && (
                    <>
                      <div className="options-group">
                        <NumericInputWithUnit
                          valueCallback={onEmbedWidthValueChange}
                          unitCallback={onEmbedWidthUnitChange}
                          label={'Width'}
                          defaultValue={parseInt(embedWidthValue, 10)}
                          defaultUnit={embedWidthUnit}
                          minValue={1}
                          maxValue={99999}
                          units={unitOptions}
                        />
                      </div>

                      <div className="options-group">
                        <NumericInputWithUnit
                          valueCallback={onEmbedHeightValueChange}
                          unitCallback={onEmbedHeightUnitChange}
                          label={'Height'}
                          defaultValue={parseInt(embedHeightValue, 10)}
                          defaultUnit={embedHeightUnit}
                          minValue={1}
                          maxValue={99999}
                          units={unitOptions}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div ref={onRightBottomRef} className="on-right-bottom">
            <button onClick={onClickCopyMediaLink}>COPY</button>
          </div>
        </div>
      </div>
    </div>
  );
}

MediaShareEmbed.propTypes = {
  triggerPopupClose: PropTypes.func,
};
