import React, { useState, useEffect, useRef, useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLayout, usePopup } from '../../../utils/hooks';
import { LinksContext } from '../../../utils/contexts';
import { MaterialIcon, PopupMain } from '../../_shared';
import { translateString } from '../../../utils/helpers';
import './SearchField.scss';
import { AppDispatch, RootState } from '../../../utils/stores/store';
import { requestPredictions, setPredictions, setSearchQuery } from '../../../utils/stores/actions/search';

// TODO: move this to helpers file
function getUrlQueryParam(name: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function SearchPredictionItemList({ children }: { children: React.ReactNode }) {
  const [maxHeight, setMaxHeight] = useState(window.innerHeight - 1.75 * 56);

  useEffect(() => {
    const onWindowResize = () => setMaxHeight(window.innerHeight - 1.75 * 56);
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, []);

  return (
    <div className="search-predictions-list" style={{ maxHeight: `${maxHeight}px` }}>
      {children || null}
    </div>
  );
}

function SearchPredictionItem({ value, onSelect }: { value: string; onSelect: (val: string) => void }) {
  return (
    <div tabIndex={0} className="search-predictions-item" onClick={() => onSelect(value)}>
      <span>{value}</span>
    </div>
  );
}

export function SearchField() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [localQuery, setLocalQuery] = useState('');
  // const navigate = useNavigate(); // Hook for navigation

  const [popupContentRef, PopupContent] = usePopup();
  const dispatch = useDispatch<AppDispatch>();

  const predictions = useSelector((state: RootState) => state.search.predictions);
  const searchQuery = useSelector((state: RootState) => state.search.searchQuery);
  const { visibleMobileSearch } = useLayout();

  const links = useContext(LinksContext) as { search: { base: string } };

  useEffect(() => {
    const queryFromUrl = getUrlQueryParam('q');
    if (queryFromUrl) {
      dispatch(setSearchQuery(queryFromUrl));
      setLocalQuery(queryFromUrl);
    }
  }, [dispatch]);

  useEffect(() => {
    if (predictions.length > 0) {
      popupContentRef.current?.tryToShow();
    } else {
      popupContentRef.current?.tryToHide();
    }
  }, [predictions]);

  useEffect(() => {
    if (visibleMobileSearch) {
      searchInputRef.current?.focus();
    }
  }, [visibleMobileSearch]);

  function onQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setLocalQuery(value);

    if (value.trim() === '') {
      dispatch(setPredictions([]));
      popupContentRef.current?.tryToHide();
      return;
    }

    dispatch(requestPredictions(value));
  }

  function onPredictionSelect(value: string) {
    setLocalQuery(value);
    popupContentRef.current?.tryToHide();
    window.location.href = `${links.search.base}?q=${encodeURIComponent(value)}`;
  }

  function onFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = searchInputRef.current?.value.trim();

    if (!value) return;

    dispatch(setSearchQuery(value));
    formRef.current?.submit();
  }

  return (
    <div className="search-field-wrap">
      <div>
        <form ref={formRef} method="get" action={links.search.base} autoComplete="off" onSubmit={onFormSubmit}>
          <div>
            <div className="text-field-wrap">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={translateString('Search')}
                aria-label="Search"
                name="q"
                value={localQuery}
                onChange={onQueryChange}
              />

              <PopupContent contentRef={popupContentRef}>
                <PopupMain>
                  <SearchPredictionItemList>
                    {predictions.map((prediction, index) => (
                      <SearchPredictionItem key={index} value={prediction} onSelect={onPredictionSelect} />
                    ))}
                  </SearchPredictionItemList>
                </PopupMain>
              </PopupContent>
            </div>
            <button type="submit" aria-label="Search">
              <MaterialIcon type="search" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
