import React, { useContext, useEffect, useState } from 'react';
import { SiteContext } from '../../utils/contexts/';
import { MediaPageStore } from '../../utils/stores/';

export default function ImageViewer() {
  const site = useContext(SiteContext);

  let initialImage = getImageUrl();

  initialImage = initialImage ? initialImage : MediaPageStore.get('media-data').thumbnail_url;
  initialImage = initialImage ? initialImage : '';

  const [image, setImage] = useState(initialImage);
  const [slideshowItems, setSlideshowItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

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
    if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'ArrowLeft') {
      handlePrevious();
    }
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % slideshowItems.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + slideshowItems.length) % slideshowItems.length);
  };

  const handleDotClick = (index) => setCurrentIndex(index);

  const handleImageClick = (index) => {
    const mediaPageUrl = site.url + slideshowItems[index]?.url;
    window.location.href = mediaPageUrl;
  };

  return !image ? null : (
    <div className="viewer-image-container">
      <img src={image} alt={MediaPageStore.get('media-data').title || null} onClick={() => setIsModalOpen(true)} />
      {/* {slideshowItems && <div>{slideshowItems.map((i)=><li>{i.poster_url}</li>)}</div>} */}
      {isModalOpen && slideshowItems && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="slideshow-container" onClick={(e) => e.stopPropagation()}>
            <button className="arrow left" onClick={handlePrevious} aria-label="Previous slide">
              &#8249;
            </button>
            <div className="slideshow-image">
              <img
                src={site.url + '/' + slideshowItems[currentIndex]?.original_media_url}
                alt={`Slide ${currentIndex + 1}`}
                onClick={() => handleImageClick(currentIndex)}
              />
            </div>
            <button className="arrow right" onClick={handleNext} aria-label="Next slide">
              &#8250;
            </button>
            <div className="dots">
              {slideshowItems.map((_, index) => (
                <span
                  key={index}
                  className={`dot ${currentIndex === index ? 'active' : ''}`}
                  onClick={() => handleDotClick(index)}
                ></span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
