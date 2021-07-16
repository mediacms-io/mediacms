import React from 'react';
import { useTranslation } from 'react-i18next';
import { ApiUrlConsumer } from '../utils/contexts/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { Page } from './Page';

interface MembersPageProps {
  id?: string;
  title?: string;
}

export const MembersPage: React.FC<MembersPageProps> = ({ id = 'members', title }) => {
  const { t } = useTranslation();
  return (
    <Page id={id}>
      <ApiUrlConsumer>
        {(apiUrl) => (
          <MediaListWrapper title={title || t('Members')} className="items-list-ver">
            <LazyLoadItemListAsync requestUrl={apiUrl.users} />
          </MediaListWrapper>
        )}
      </ApiUrlConsumer>
    </Page>
  );
};
