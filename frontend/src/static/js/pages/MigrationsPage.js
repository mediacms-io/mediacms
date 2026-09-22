import React from 'react';
import { Page } from './_Page';
import './Migrations.scss';
import { translateString } from '../utils/helpers/';
import { MaterialIcon } from '../components/_shared/';
import { listMigrations, controlMigration, deleteMigration } from '../utils/api/migrations.js';

const STATUS_LABELS = {
  pending: translateString('Draft'),
  running: translateString('Running'),
  paused: translateString('Paused'),
  error: translateString('Error'),
  success: translateString('Completed'),
  aborted: translateString('Aborted'),
};

function migrationProgress(migration) {
  const totals = migration.totals || {};
  const migrated = totals.media_migrated || 0;
  const skipped = totals.media_skipped || 0;
  const failed = totals.media_failed || 0;
  const discovered = totals.media_discovered || 0;
  const handled = migrated + skipped + failed;
  const percent = discovered ? Math.min(100, Math.round((handled / discovered) * 100)) : 0;
  return { handled, discovered, failed, percent };
}

function armedSchedule(migration) {
  const options = migration.options || {};
  if (true !== options.schedule_enabled || !options.scheduled_at) {
    return '';
  }
  return String(options.scheduled_at).replace('T', ', ');
}

function primaryAction(status) {
  if ('running' === status) return { action: 'pause', icon: 'pause', label: translateString('Pause') };
  if ('paused' === status) return { action: 'resume', icon: 'play_arrow', label: translateString('Resume') };
  if ('pending' === status) return { action: 'start', icon: 'play_arrow', label: translateString('Start') };
  if ('success' === status || 'error' === status || 'aborted' === status) {
    // a finished run can be swept again: what was imported is skipped, so this retries
    // the failures and picks up anything new at the source
    return { action: 'rerun', icon: 'refresh', label: translateString('Run again') };
  }
  return null;
}

export class MigrationsPage extends Page {
  constructor(props) {
    super(props, 'migrations');
    this.state = { migrations: [], loading: true, error: null };
    this.load = this.load.bind(this);
    this.onControlClick = this.onControlClick.bind(this);
    this.onDeleteClick = this.onDeleteClick.bind(this);
  }

  componentDidMount() {
    this.load();
    this.timer = setInterval(this.load, 10000);
  }

  componentWillUnmount() {
    this.unmounted = true;
    clearInterval(this.timer);
  }

  safeSetState(state) {
    // a poll or a control request can land after the user has navigated away
    if (!this.unmounted) {
      this.setState(state);
    }
  }

  load() {
    listMigrations()
      .then((response) => {
        const data = response.data;
        this.safeSetState({ migrations: data.results || data, loading: false, error: null });
      })
      .catch(() => this.safeSetState({ loading: false, error: translateString('Could not load migrations') }));
  }

  onDeleteClick(migration) {
    // the records go with it, so a later run of the same source cannot tell what this one
    // already brought over. Worth saying out loud before it happens.
    const warning =
      translateString('Delete the migration') +
      ' "' +
      migration.name +
      '"? ' +
      translateString('The media it imported stays in the portal, but its record of what it imported is deleted, so a later migration of the same source will not know what is already here.');
    if (!window.confirm(warning)) {
      return;
    }

    deleteMigration(migration.id)
      .then(this.load)
      .catch((error) => {
        const detail = error.response && error.response.data && error.response.data.detail;
        this.safeSetState({ error: detail || translateString('Could not delete migration') });
      });
  }

  onControlClick(id, action) {
    controlMigration(id, action)
      .then(this.load)
      .catch((error) => {
        const detail = error.response && error.response.data && error.response.data.detail;
        this.safeSetState({ error: detail || translateString('Action failed') });
      });
  }

  renderRow(migration) {
    const progress = migrationProgress(migration);
    const action = primaryAction(migration.status);
    const armed = armedSchedule(migration);
    const connection = migration.connection || {};
    const source = migration.provider + (connection.partner_id ? ' · partner ' + connection.partner_id : '');

    return (
      <div className="migrations-row" key={migration.id}>
        <div className="migrations-name">
          <a href={'/migrations/' + migration.id}>{migration.name}</a>
          <span className="migrations-source">{source}</span>
        </div>
        <div className="migrations-status">
          <span className={'migrations-badge migrations-badge--' + migration.status}>
            {STATUS_LABELS[migration.status] || migration.status}
          </span>
          {armed ? (
            <span className="migrations-armed">
              {translateString('Runs at')} {armed}
            </span>
          ) : null}
        </div>
        <div className="migrations-progress">
          {progress.discovered ? (
            <>
              <div className="migrations-bar">
                <div className="migrations-bar-fill" style={{ width: progress.percent + '%' }} />
              </div>
              <span>
                {progress.handled} / {progress.discovered} {translateString('items')}
                {progress.failed ? ' · ' + progress.failed + ' ' + translateString('errors') : ''}
              </span>
            </>
          ) : (
            <span>{translateString('Not started')}</span>
          )}
        </div>
        <div className="migrations-activity">{migration.last_activity || '—'}</div>
        <div className="migrations-actions">
          {action ? (
            <button
              className="migrations-icon"
              title={action.label}
              aria-label={action.label}
              onClick={() => this.onControlClick(migration.id, action.action)}
            >
              <MaterialIcon type={action.icon} />
            </button>
          ) : null}
          <a
            className="migrations-icon"
            href={'/migrations/' + migration.id + '/edit'}
            title={translateString('Edit settings')}
            aria-label={translateString('Edit settings')}
          >
            <MaterialIcon type="settings" />
          </a>
          {'running' === migration.status ? null : (
            <button
              className="migrations-icon is-danger"
              title={translateString('Delete migration')}
              aria-label={translateString('Delete migration')}
              onClick={() => this.onDeleteClick(migration)}
            >
              <MaterialIcon type="delete" />
            </button>
          )}
        </div>
      </div>
    );
  }

  pageContent() {
    const { migrations, loading, error } = this.state;

    return (
      <div className="migrations-page">
        <div className="migrations-header">
          <h1>{translateString('Content migration')}</h1>
          <a className="migrations-new btn" href="/migrations/new">
            {translateString('New migration')}
          </a>
        </div>

        {error ? <p className="migrations-error">{error}</p> : null}
        {loading ? <p>{translateString('Loading')}…</p> : null}

        {!loading ? (
          <p className="migrations-empty">
            <span>
              {translateString(
                'A migration copies media, users and categories from another video platform into this MediaCMS installation. Nothing is imported until you start it, and you can pause and resume at any time.'
              )}
            </span>
            <span className="migrations-supported">
              {translateString('Kaltura, YouTube and Panopto are supported.')}
            </span>
          </p>
        ) : null}

        {migrations.length ? (
          <div className="migrations-table">{migrations.map((migration) => this.renderRow(migration))}</div>
        ) : null}
      </div>
    );
  }
}
