import React from 'react';
import { Page } from './_Page';
import './Migrations.scss';
import { translateString } from '../utils/helpers/';

const SOURCES = [
  {
    id: 'kaltura',
    label: 'Kaltura',
    available: true,
    description: 'Import media, captions, owners and galleries from a Kaltura portal.',
  },
  {
    id: 'panopto',
    label: 'Panopto',
    available: false,
    description: 'Not supported yet.',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    available: false,
    description: 'Not supported yet.',
  },
];

export class MigrationNewPage extends Page {
  constructor(props) {
    super(props, 'migration-new');
  }

  pageContent() {
    return (
      <div className="migration-new-page">
        <div className="migration-new-header">
          <h1>{translateString('New migration')}</h1>
          <a className="migration-new-back" href="/migrations">
            {translateString('Back to migrations')}
          </a>
        </div>

        <p className="migration-new-intro">
          {translateString('Choose the platform you are migrating from.')}
        </p>

        <div className="migration-new-sources">
          {SOURCES.map((source) => {
            const body = (
              <>
                <span className="migration-new-source-name">
                  {source.label}
                  {source.available ? null : (
                    <span className="migration-new-badge">{translateString('soon')}</span>
                  )}
                </span>
                <span className="migration-new-source-text">{translateString(source.description)}</span>
              </>
            );

            if (!source.available) {
              return (
                <div key={source.id} className="migration-new-source is-unavailable" aria-disabled="true">
                  {body}
                </div>
              );
            }

            return (
              <a key={source.id} className="migration-new-source" href={'/migrations/new/' + source.id}>
                {body}
              </a>
            );
          })}
        </div>
      </div>
    );
  }
}
