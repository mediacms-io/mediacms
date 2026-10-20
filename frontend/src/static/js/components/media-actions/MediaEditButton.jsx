import React from 'react';
import { useUser } from '../../utils/hooks/';
import { MediaPageStore } from '../../utils/stores/';
import { CircleIconButton, MaterialIcon } from '../_shared/';
import { inEmbeddedApp, translateString } from '../../utils/helpers/';

export function MediaEditButton() {
  const { userCan } = useUser();

  if (!userCan.editMedia) {
    return null;
  }

  let link = MediaPageStore.get('media-data').edit_url;

  if (window.MediaCMS.site.devEnv) {
    link = '/edit-media.html';
  }

  if (link && inEmbeddedApp()) {
    link += '&mode=lms_embed_mode';
  }

  return (
    <div className="edit">
      <a href={link} rel="nofollow" title={translateString('Edit media')}>
        <CircleIconButton type="span">
          <MaterialIcon type="edit" />
        </CircleIconButton>
        <span>{translateString('EDIT')}</span>
      </a>
    </div>
  );
}
