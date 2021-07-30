import React, { useRef, useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { LinksContext } from '../../utils/contexts/';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import { CircleIconButton, MaterialIcon, NumericInputWithUnit } from '../_shared/';
import VideoViewer from '../media-viewer/VideoViewer';

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

  function onKeepAspectRatioChange() {
    const newVal = !keepAspectRatio;

    const arr = aspectRatio.split(':');
    const x = arr[0];
    const y = arr[1];

    setKeepAspectRatio(newVal);
    setEmbedWidthUnit(newVal ? 'px' : embedWidthUnit);
    setEmbedHeightUnit(newVal ? 'px' : embedHeightUnit);
    setEmbedHeightValue(newVal ? parseInt((embedWidthValue * y) / x, 10) : embedHeightValue);
    setUnitOptions(
      newVal
        ? [{ key: 'px', label: 'px' }]
        : [
          { key: 'px', label: 'px' },
          { key: 'percent', label: '%' },
        ]
    );
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

  return (
    <div className="share-embed" style={{ maxHeight: maxHeight + 'px' }}>
      <div className="share-embed-inner">
        <div className="on-left">
          <div className="media-embed-wrap">
            <VideoViewer data={MediaPageStore.get('media-data')} inEmbed={true} />
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
              value={
                '<iframe width="' +
                ('percent' === embedWidthUnit ? embedWidthValue + '%' : embedWidthValue) +
                '" height="' +
                ('percent' === embedHeightUnit ? embedHeightValue + '%' : embedHeightValue) +
                '" src="' +
                links.embed +
                MediaPageStore.get('media-id') +
                '" frameborder="0" allowfullscreen></iframe>'
              }
            ></textarea>

            <div className="iframe-config">
              <div className="iframe-config-options-title">Embed options</div>

              <div className="iframe-config-option">
                {/*<div className="option-title">
										<span>Dimensions</span>
									</div>*/}

                <div className="option-content">
                  <div className="ratio-options">
                    <div className="options-group">
                      <label style={{ minHeight: '36px' }}>
                        <input type="checkbox" checked={keepAspectRatio} onChange={onKeepAspectRatioChange} />
                        Keep aspect ratio
                      </label>
                    </div>

                    {!keepAspectRatio ? null : (
                      <div className="options-group">
                        <select ref={aspectRatioValueRef} onChange={onAspectRatioChange} value={aspectRatio}>
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
                    )}
                  </div>

                  <br />

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
