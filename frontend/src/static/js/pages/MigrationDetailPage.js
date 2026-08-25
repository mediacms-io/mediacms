import React from 'react';
import { Page } from './_Page';
import './Migrations.scss';
import { translateString } from '../utils/helpers/';
import { MaterialIcon } from '../components/_shared/';
import { getMigration, getProgress, getRecords, controlMigration } from '../utils/api/migrations.js';

const POLL_INTERVAL = 5000;
const SEARCH_DEBOUNCE = 400;

// The KMC entry page is the one place an admin can always open a Kaltura entry
// from just the service URL and the entry id.
function kalturaEntryUrl(connection, sourceId) {
  const base = ((connection || {}).service_url || '').replace(/\/+$/, '');
  if (!base || !sourceId) {
    return null;
  }
  return base + '/index.php/kmcng/content/entries/entry/' + encodeURIComponent(sourceId) + '/';
}

const TYPES = [
  { key: 'user', label: translateString('Users') },
  { key: 'category', label: translateString('Categories') },
  { key: 'media', label: translateString('Media') },
  { key: 'caption', label: translateString('Captions') },
];

function counts(totals, type) {
  const migrated = totals[type + '_migrated'] || 0;
  const skipped = totals[type + '_skipped'] || 0;
  const failed = totals[type + '_failed'] || 0;
  const discovered = totals[type + '_discovered'] || 0;
  const handled = migrated + skipped + failed;
  const percent = discovered ? Math.min(100, Math.round((handled / discovered) * 100)) : 0;
  return { migrated, skipped, failed, discovered, handled, percent };
}

export class MigrationDetailPage extends Page {
  constructor(props) {
    super(props, 'migration-detail');

    this.state = {
      id: window.MIGRATION_ID,
      migration: null,
      progress: null,
      records: [],
      recordsCount: 0,
      recordsPage: 1,
      // the server owns the page size; it is learned from the first full page
      // rather than duplicated here, where it would silently drift
      recordsPerPage: 0,
      recordsHasNext: false,
      recordsHasPrev: false,
      errorsOnly: false,
      search: '',
      error: null,
    };

    this.poll = this.poll.bind(this);
    this.onErrorsOnlyClick = this.onErrorsOnlyClick.bind(this);
    this.onPageClick = this.onPageClick.bind(this);
    this.onSearchChange = this.onSearchChange.bind(this);
  }

  componentDidMount() {
    getMigration(this.state.id)
      .then((response) => this.safeSetState({ migration: response.data }))
      .catch(() => this.safeSetState({ error: translateString('Could not load migration') }));
    this.poll();
    this.timer = setInterval(this.poll, POLL_INTERVAL);
  }

  componentWillUnmount() {
    this.unmounted = true;
    clearInterval(this.timer);
    clearTimeout(this.searchTimer);
  }

  safeSetState(state) {
    // a poll or a control request can land after the user has navigated away
    if (!this.unmounted) {
      this.setState(state);
    }
  }

  poll() {
    getProgress(this.state.id)
      // clear any earlier error: a transient blip must not leave a permanent
      // banner on a dashboard that is now updating fine
      .then((response) => this.safeSetState({ progress: response.data, error: null }))
      .catch(() => this.safeSetState({ error: translateString('Could not load progress') }));

    const params = this.state.errorsOnly ? { status: 'failed' } : {};
    if (this.state.search) {
      params.search = this.state.search;
    }
    if (1 < this.state.recordsPage) {
      params.page = this.state.recordsPage;
    }
    getRecords(this.state.id, params)
      .then((response) => {
        const data = response.data;
        const results = data.results || data;
        const page = this.state.recordsPage;
        this.safeSetState({
          records: results,
          recordsCount: undefined === data.count ? results.length : data.count,
          recordsHasNext: !!data.next,
          recordsHasPrev: !!data.previous,
          recordsPerPage: 1 === page && data.next ? results.length : this.state.recordsPerPage,
        });
      })
      .catch((error) => {
        // the page fell off the end: a filter shrank the set, or rows were removed
        // under us. drop back to the first page rather than showing an error
        if (error.response && 404 === error.response.status && 1 < this.state.recordsPage) {
          this.setState({ recordsPage: 1 }, this.poll);
          return;
        }
        this.safeSetState({ error: translateString('Could not load records') });
      });
  }

  onErrorsOnlyClick() {
    this.setState({ errorsOnly: !this.state.errorsOnly, recordsPage: 1 }, this.poll);
  }

  onPageClick(delta) {
    this.setState({ recordsPage: Math.max(1, this.state.recordsPage + delta) }, this.poll);
  }

  onSearchChange(event) {
    // debounced: a request per keystroke would fight the 5s poll for the table
    const search = event.target.value;
    clearTimeout(this.searchTimer);
    this.setState({ search }, () => {
      this.searchTimer = setTimeout(() => this.setState({ recordsPage: 1 }, this.poll), SEARCH_DEBOUNCE);
    });
  }

  onControlClick(action) {
    controlMigration(this.state.id, action)
      .then(this.poll)
      .catch((error) => {
        const detail = error.response && error.response.data && error.response.data.detail;
        this.safeSetState({ error: detail || translateString('Action failed') });
      });
  }

  renderControls(status) {
    // one action per status, plus edit, as icon buttons: the labels were long enough to
    // wrap the header onto a second line
    const actions = [];
    if ('running' === status) {
      actions.push({ action: 'pause', icon: 'pause', label: translateString('Pause') });
    }
    if ('paused' === status) {
      actions.push({ action: 'resume', icon: 'play_arrow', label: translateString('Resume') });
    }
    if ('pending' === status) {
      actions.push({ action: 'start', icon: 'play_arrow', label: translateString('Start') });
    }
    if ('success' === status || 'error' === status || 'aborted' === status) {
      actions.push({ action: 'rerun', icon: 'refresh', label: translateString('Run again') });
    }

    const editLabel = translateString('Edit settings');

    return (
      <div className="migration-detail-controls">
        {actions.map((item) => (
          <button
            key={item.action}
            className="migrations-icon"
            title={item.label}
            aria-label={item.label}
            onClick={() => this.onControlClick(item.action)}
          >
            <MaterialIcon type={item.icon} />
          </button>
        ))}

        <a
          className="migrations-icon"
          href={'/migrations/' + this.state.id + '/edit'}
          title={editLabel}
          aria-label={editLabel}
        >
          <MaterialIcon type="settings" />
        </a>

        {'running' === status || 'paused' === status ? (
          <button
            className="migrations-icon is-danger"
            title={translateString('Abort')}
            aria-label={translateString('Abort')}
            onClick={() => this.onControlClick('abort')}
          >
            <MaterialIcon type="stop" />
          </button>
        ) : null}
      </div>
    );
  }

  renderRecordsRange() {
    const { records, recordsCount, recordsPage, recordsPerPage } = this.state;
    if (!recordsCount) {
      return null;
    }
    if (!recordsPerPage) {
      return recordsCount + ' ' + translateString('records');
    }
    const first = (recordsPage - 1) * recordsPerPage + 1;
    return (
      translateString('showing') + ' ' + first + '–' + (first + records.length - 1) + ' ' + translateString('of') + ' ' + recordsCount
    );
  }

  renderPager() {
    const { recordsPage, recordsHasNext, recordsHasPrev } = this.state;
    if (!recordsHasNext && !recordsHasPrev) {
      return null;
    }
    return (
      <div className="migration-detail-pager">
        <button disabled={!recordsHasPrev} onClick={() => this.onPageClick(-1)}>
          {translateString('Previous')}
        </button>
        <span>
          {translateString('page')} {recordsPage}
        </span>
        <button disabled={!recordsHasNext} onClick={() => this.onPageClick(1)}>
          {translateString('Next')}
        </button>
      </div>
    );
  }

  pageContent() {
    const { migration, progress, records } = this.state;
    if (!migration || !progress) {
      return <p>{translateString('Loading')}…</p>;
    }

    const totals = progress.totals || {};
    const media = counts(totals, 'media');

    return (
      <div className="migration-detail-page">
        <div className="migration-detail-header">
          <h1>{migration.name}</h1>
          <span className={'migrations-badge migrations-badge--' + progress.status}>{progress.status}</span>
          <a className="migrations-back" href="/migrations">
            {translateString('All migrations')}
          </a>
          {this.renderControls(progress.status)}
        </div>

        {this.state.error ? <p className="migrations-error">{this.state.error}</p> : null}

        <div className="migration-detail-tiles">
          <div>
            <p>{translateString('Items migrated')}</p>
            <strong>{media.migrated}</strong>
            <span>{translateString('of')} {media.discovered || translateString('unknown')} {translateString('discovered')}</span>
          </div>
          <div>
            <p>{translateString('Skipped')}</p>
            <strong>{media.skipped}</strong>
            <span>{translateString('already in MediaCMS')}</span>
          </div>
          <div>
            <p>{translateString('Errors')}</p>
            <strong className="is-danger">{media.failed}</strong>
            <span>{translateString('retried on the next run')}</span>
          </div>
          <div>
            <p>{translateString('Phase')}</p>
            <strong>{progress.cursor_phase || '—'}</strong>
            <span>{translateString('started')} {progress.started_at || '—'}</span>
          </div>
        </div>

        <p className="migration-detail-section">{translateString('Progress by type')}</p>
        <div className="migration-detail-progress">
          {TYPES.map((type) => {
            const typeCounts = counts(totals, type.key);
            return (
              <div key={type.key}>
                <span>{type.label}</span>
                {typeCounts.discovered ? (
                  <div className="migrations-bar">
                    <div className="migrations-bar-fill" style={{ width: typeCounts.percent + '%' }} />
                  </div>
                ) : (
                  // no up front total for this type - captions are discovered per
                  // media as the run proceeds. An always empty bar would read as
                  // "stalled" rather than "total unknown".
                  <span className="migration-detail-no-total">so far</span>
                )}
                <span>
                  {typeCounts.handled}
                  {typeCounts.discovered ? ' / ' + typeCounts.discovered : ''}
                </span>
              </div>
            );
          })}
        </div>

        <div className="migration-detail-section-row">
          <p className="migration-detail-section">{translateString('Live log')}</p>
          <span>{translateString('auto-refresh 5s')}</span>
        </div>
        <pre className="migration-detail-log">{(progress.log || []).join('\n')}</pre>

        <div className="migration-detail-section-row">
          <p className="migration-detail-section">{translateString('ID mapping')}</p>
          <span>{this.renderRecordsRange()}</span>
          <input
            className="migration-detail-search"
            type="search"
            value={this.state.search}
            onChange={this.onSearchChange}
            placeholder={translateString('Search ID, title, user, category or error')}
          />
          <button onClick={this.onErrorsOnlyClick}>
            {this.state.errorsOnly ? translateString('All records') : translateString('Errors only')}
          </button>
        </div>
        <div className="migration-detail-records">
          <div className="migration-detail-record migration-detail-record--head">
            <span>{translateString('Type')}</span>
            <span>{translateString('Source ID')}</span>
            <span>{translateString('MediaCMS ID')}</span>
            <span>{translateString('Status')}</span>
            <span>{translateString('Migrated at')}</span>
          </div>
          {records.map((record) => {
            const sourceUrl =
              'media' === record.object_type ? kalturaEntryUrl(migration.connection, record.source_id) : null;
            return (
              <div className="migration-detail-record" key={record.id}>
                <span>{record.object_type}</span>
                <span className="is-mono">
                  {sourceUrl ? (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" title={translateString('Open in Kaltura')}>
                      {record.source_id}
                    </a>
                  ) : (
                    record.source_id
                  )}
                </span>
                <span className="is-mono">
                  {record.target_url ? (
                    <a
                      href={record.target_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={translateString('Open in MediaCMS')}
                    >
                      {record.target_label || record.target_id}
                    </a>
                  ) : record.target_id === null ? (
                    '—'
                  ) : (
                    record.target_label || record.target_id
                  )}
                </span>
                <span className={'is-' + record.status}>{record.status}</span>
                <span>{record.created_at}</span>
              </div>
            );
          })}
        </div>
        {this.renderPager()}
      </div>
    );
  }
}
