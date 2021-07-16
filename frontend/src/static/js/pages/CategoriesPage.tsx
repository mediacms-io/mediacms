import React from 'react';
import { useTranslation } from 'react-i18next';
import { ApiUrlConsumer } from '../utils/contexts/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { Page } from './Page';

interface CategoriesPageProps {
  id?: string;
  title?: string;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({ id = 'categories', title }) => {
  const { t } = useTranslation();
  return (
    <Page id={id}>
      <ApiUrlConsumer>
        {(apiUrl) => (
          <MediaListWrapper title={title || t('Categories')} className="items-list-ver">
            <LazyLoadItemListAsync
              singleLinkContent={true}
              inCategoriesList={true}
              requestUrl={apiUrl.archive.categories}
            />
          </MediaListWrapper>
        )}
      </ApiUrlConsumer>
    </Page>
  );
};
