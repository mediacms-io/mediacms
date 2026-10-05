import ItemsInlineSlider from '../../../../../src/static/js/components/item-list/includes/itemLists/ItemsInlineSlider';

function setSize(el: HTMLElement, props: { [key: string]: number }) {
    Object.entries(props).forEach(([key, value]) => {
        Object.defineProperty(el, key, { configurable: true, value });
    });
}

function buildWrapper(itemsCount: number, wrapperWidth = 300, itemWidth = 100) {
    const wrapper = document.createElement('div');
    for (let i = 0; i < itemsCount; i++) {
        const item = document.createElement('div');
        item.className = 'item';
        setSize(item, { offsetWidth: itemWidth });
        wrapper.appendChild(item);
    }
    setSize(wrapper, { offsetWidth: wrapperWidth, scrollWidth: itemsCount * itemWidth });
    return wrapper;
}

describe('components/item-list', () => {
    describe('ItemsInlineSlider', () => {
        test('Returns an empty instance without container', () => {
            const slider = new (ItemsInlineSlider as any)();
            expect(slider.data).toBeUndefined();
        });

        test('Computes fitting items and navigates slides', () => {
            const wrapper = buildWrapper(10);
            const slider = new (ItemsInlineSlider as any)(wrapper, '.item');
            slider.updateDataState(10, true);

            expect(slider.itemsFit()).toBe(3);
            expect(slider.currentSlide()).toBe(1);
            expect(slider.hasPreviousSlide()).toBe(false);
            expect(slider.hasNextSlide()).toBe(true);
            expect(slider.loadItemsToFit()).toBe(false);

            slider.nextSlide();
            expect(slider.currentSlide()).toBe(4);
            slider.scrollToCurrentSlide();
            expect(wrapper.scrollLeft).toBe(300);

            slider.nextSlide();
            expect(slider.currentSlide()).toBe(7);
            slider.scrollToCurrentSlide();
            expect(wrapper.scrollLeft).toBe(600);
            slider.nextSlide();
            expect(slider.currentSlide()).toBe(8);
            expect(slider.hasNextSlide()).toBe(false);
            expect(slider.loadMoreItems()).toBe(true);

            slider.scrollToCurrentSlide();
            slider.previousSlide();
            expect(slider.currentSlide()).toBe(5);
            expect(slider.hasPreviousSlide()).toBe(true);
        });

        test('Uses scroll position to calculate the current slide', () => {
            const wrapper = buildWrapper(10);
            const slider = new (ItemsInlineSlider as any)(wrapper, '.item');
            slider.updateDataState(10, false);
            wrapper.scrollLeft = 150;
            slider.previousSlide();
            expect(slider.currentSlide()).toBe(1);
            slider.nextSlide();
            expect(slider.currentSlide()).toBe(6);
        });

        test('Requests more items when fewer than two slides are loaded', () => {
            const slider = new (ItemsInlineSlider as any)(buildWrapper(4), '.item');
            slider.updateDataState(4, false);
            expect(slider.loadItemsToFit()).toBe(true);
            expect(slider.hasNextSlide()).toBe(true);
        });

        test('Keeps current slide within bounds after data updates and resize', () => {
            const wrapper = buildWrapper(10);
            const slider = new (ItemsInlineSlider as any)(wrapper, '.item');
            slider.updateDataState(10, true);
            slider.nextSlide();
            slider.nextSlide();
            expect(slider.currentSlide()).toBe(7);

            setSize(wrapper, { offsetWidth: 500 });
            slider.updateDataStateOnResize(10, true);
            expect(slider.itemsFit()).toBe(5);
            expect(slider.currentSlide()).toBe(6);

            slider.updateDataState(3, true);
            expect(slider.currentSlide()).toBe(1);
            expect(slider.hasNextSlide()).toBe(false);
        });

        test('Does not refresh measurements after initialization unless forced', () => {
            const wrapper = buildWrapper(10);
            const slider = new (ItemsInlineSlider as any)(wrapper, '.item');
            slider.updateDataState(10, false);
            setSize(wrapper, { offsetWidth: 600 });
            slider.updateDataState(10, false);
            expect(slider.itemsFit()).toBe(3);
            slider.updateDataState(10, false, true);
            expect(slider.itemsFit()).toBe(6);
        });
    });
});
