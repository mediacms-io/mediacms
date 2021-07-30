import React from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync.jsx';
import { Page } from './Page';

interface MembersPageProps {
  id?: string;
  title?: string;
}

export const MembersPage: React.FC<MembersPageProps> = ({ id = 'members', title = 'Members' }) => (
  <Page id={id}>
    <ApiUrlConsumer>
      {(apiUrl) => (
        <MediaListWrapper title={title} className="items-list-ver">
          <LazyLoadItemListAsync requestUrl={apiUrl.users} />
        </MediaListWrapper>
      )}
    </ApiUrlConsumer>
  </Page>
);
