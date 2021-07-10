function calcCurrentSlide(wrapperDom, itemWidth, currentSlide) {
  return wrapperDom.scrollLeft ? 1 + Math.ceil(wrapperDom.scrollLeft / itemWidth) : currentSlide;
}

export default function ItemsInlineSlider(container, itemSelector) {
  if (void 0 === container) {
    return;
  }

  this.data = {
    dom: {
      wrapper: container,
      firstItem: container.querySelector(itemSelector),
    },
    item: {
      // selector: itemSelector,
      width: null,
    },
  };

  this.data.item.width = this.data.dom.firstItem.offsetWidth;

  this.state = {
    initedAllStateValues: false,
    currentSlide: 1,
    maxSlideIndex: null,
    slideItemsFit: null,
    slideItems: null,
    totalItems: null,
    wrapper: {
      width: null,
      scrollWidth: null,
    },
  };
}

ItemsInlineSlider.prototype.updateDataStateOnResize = function (totalItems, itemsLoadedAll) {
  this.data.item.width = this.data.dom.firstItem.offsetWidth;

  this.state.wrapper.width = this.data.dom.wrapper.offsetWidth;
  this.state.wrapper.scrollWidth = this.data.dom.wrapper.scrollWidth;
  this.state.slideItemsFit = Math.floor(this.state.wrapper.width / this.data.item.width);

  this.state.slideItems = Math.max(1, this.state.slideItemsFit);

  if (itemsLoadedAll && this.state.slideItems <= this.state.slideItemsFit) {
    this.state.itemsLengthFit = this.state.slideItems;
  }

  this.state.totalItems = totalItems;

  this.state.maxSlideIndex = Math.max(1 + (this.state.totalItems - this.state.slideItemsFit));

  this.state.currentSlide = Math.min(this.state.currentSlide, this.state.maxSlideIndex || 1);
  this.state.currentSlide = 0 >= this.state.currentSlide ? 1 : this.state.currentSlide;
};

ItemsInlineSlider.prototype.updateDataState = function (totalItems, itemsLoadedAll, forcedRefresh) {
  if (forcedRefresh || !this.state.initedAllStateValues) {
    this.state.initedAllStateValues = true;

    this.state.wrapper.width = this.data.dom.wrapper.offsetWidth;
    this.state.wrapper.scrollWidth = this.data.dom.wrapper.scrollWidth;
    this.state.slideItemsFit = Math.floor(this.state.wrapper.width / this.data.item.width);

    this.state.slideItems = Math.max(1, this.state.slideItemsFit);

    if (itemsLoadedAll && this.state.slideItems <= this.state.slideItemsFit) {
      this.state.itemsLengthFit = this.state.slideItems;
    }
  }

  this.state.totalItems = totalItems;

  this.state.maxSlideIndex = Math.max(1, 1 + (this.state.totalItems - this.state.slideItemsFit));

  this.state.currentSlide = Math.min(this.state.currentSlide, this.state.maxSlideIndex);
  this.state.currentSlide = 0 >= this.state.currentSlide ? 1 : this.state.currentSlide;
};

ItemsInlineSlider.prototype.nextSlide = function () {
  this.state.currentSlide = Math.min(
    calcCurrentSlide(this.data.dom.wrapper, this.data.item.width, this.state.currentSlide) + this.state.slideItems,
    this.state.maxSlideIndex
  );
};

ItemsInlineSlider.prototype.previousSlide = function () {
  this.state.currentSlide = Math.max(
    1,
    calcCurrentSlide(this.data.dom.wrapper, this.data.item.width, this.state.currentSlide) - this.state.slideItems
  );
};

ItemsInlineSlider.prototype.scrollToCurrentSlide = function () {
  this.data.dom.wrapper.scrollLeft = this.data.item.width * (this.state.currentSlide - 1);
};

ItemsInlineSlider.prototype.hasNextSlide = function () {
  return this.state.currentSlide < this.state.maxSlideIndex;
};

ItemsInlineSlider.prototype.hasPreviousSlide = function () {
  return 1 < this.state.currentSlide;
};

ItemsInlineSlider.prototype.currentSlide = function () {
  return this.state.currentSlide;
};

ItemsInlineSlider.prototype.loadItemsToFit = function () {
  // Set slider minimum items length ( 2 * this.state.slideItemsFit ).
  return 2 * this.state.slideItemsFit > this.state.totalItems;
};

ItemsInlineSlider.prototype.loadMoreItems = function () {
  return this.state.currentSlide + this.state.slideItemsFit >= this.state.maxSlideIndex;
};

ItemsInlineSlider.prototype.itemsFit = function () {
  return this.state.slideItemsFit;
};
