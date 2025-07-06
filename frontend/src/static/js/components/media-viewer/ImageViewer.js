import React, { useContext, useEffect, useState } from 'react';
import { SiteContext } from '../../utils/contexts/';
import { MediaPageStore } from '../../utils/stores/';
import { SpinnerLoader } from '../_shared';
import Tooltip from '../_shared/ToolTip';

export default function ImageViewer() {
  const site = useContext(SiteContext);

  let initialImage = getImageUrl();

  initialImage = initialImage ? initialImage : MediaPageStore.get('media-data').thumbnail_url;
  initialImage = initialImage ? initialImage : '';

  const [image, setImage] = useState(initialImage);
  const [slideshowItems, setSlideshowItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isImgLoading, setIsImgLoading] = useState(true);

  const thumbnailRef = React.useRef();

  function onImageLoad() {
    setImage(getImageUrl());
  }

  function getImageUrl() {
    const media_data = MediaPageStore.get('media-data');

    let imgUrl =
      media_data.poster_url?.trim() ||
      media_data.thumbnail_url?.trim() ||
      MediaPageStore.get('media-original-url')?.trim() ||
      '#';

    return site.url + '/' + imgUrl.replace(/^\//g, '');
  }

  const fetchSlideShowItems = () => {
    const media_data = MediaPageStore.get('media-data');
    const items = media_data.slideshow_items;
    if (Array.isArray(items)) {
      setSlideshowItems(items);
    }
  };

  useEffect(() => {
    if (image) {
      fetchSlideShowItems();
    }
  }, [image]);

  useEffect(() => {
    MediaPageStore.on('loaded_image_data', onImageLoad);
    return () => MediaPageStore.removeListener('loaded_image_data', onImageLoad);
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, slideshowItems]);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowRight') handleNext();
    if (event.key === 'ArrowLeft') handlePrevious();
    if (event.key === 'Escape') onClose();
  };

  const onClose = () => setIsModalOpen(false);

  const handleNext = () => {
    setIsImgLoading(true);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % slideshowItems.length);
  };

  const handlePrevious = () => {
    setIsImgLoading(true);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + slideshowItems.length) % slideshowItems.length);
  };

  const handleDotClick = (index) => {
    setIsImgLoading(true);
    setCurrentIndex(index);
  };

  const handleImageClick = (index) => {
    const mediaPageUrl = site.url + slideshowItems[index]?.url;
    window.location.href = mediaPageUrl;
  };

  const scrollThumbnails = (direction) => {
    if (thumbnailRef.current) {
      const scrollAmount = 10;
      if (direction === 'left') {
        thumbnailRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else if (direction === 'right') {
        thumbnailRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  return !image ? null : (
    <div className="viewer-image-container">
      <Tooltip content={'load full-image'} position="center">
        <img src={image} alt={MediaPageStore.get('media-data').title || null} onClick={() => setIsModalOpen(true)} />
      </Tooltip>
      {isModalOpen && slideshowItems && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="slideshow-container" onClick={(e) => e.stopPropagation()}>
            {!isImgLoading && (
              <button className="arrow left" onClick={handlePrevious} aria-label="Previous slide">
                &#8249;
              </button>
            )}
            <div className="slideshow-image">
              {isImgLoading && <SpinnerLoader size="large" />}
              <img
                src={site.url + '/' + slideshowItems[currentIndex]?.original_media_url}
                alt={`Slide ${currentIndex + 1}`}
                onClick={() => handleImageClick(currentIndex)}
                onLoad={() => setIsImgLoading(false)}
                onError={() => setIsImgLoading(false)}
                style={{ display: isImgLoading ? 'none' : 'block' }}
              />
              {!isImgLoading && <div className="slideshow-title">{slideshowItems[currentIndex]?.title}</div>}
            </div>
            {!isImgLoading && (
              <button className="arrow right" onClick={handleNext} aria-label="Next slide">
                &#8250;
              </button>
            )}
            <div className="thumbnail-navigation">
              {slideshowItems.length > 5 && (
                <button className="arrow left" onClick={() => scrollThumbnails('left')} aria-label="Scroll left">
                  &#8249;
                </button>
              )}
              <div
                className={`thumbnail-container ${slideshowItems.length <= 5 ? 'center-thumbnails' : ''}`}
                ref={thumbnailRef}
              >
                {slideshowItems.map((item, index) => (
                  <img
                    key={index}
                    src={site.url + '/' + item.thumbnail_url}
                    alt={`Thumbnail ${index + 1}`}
                    className={`thumbnail ${currentIndex === index ? 'active' : ''}`}
                    onClick={() => handleDotClick(index)}
                  />
                ))}
              </div>
              {slideshowItems.length > 5 && (
                <button className="arrow right" onClick={() => scrollThumbnails('right')} aria-label="Scroll right">
                  &#8250;
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
