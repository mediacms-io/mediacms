import React from 'react';
import { Page } from './_Page';
import './Migrations.scss';
import { translateString } from '../utils/helpers/';
import {
  createMigration,
  updateMigration,
  getMigration,
  getServerTime,
  checkConnection,
  checkSavedConnection,
  controlMigration,
  listSavedSourceCategories,
  listSavedSourceRoles,
  listSourceCategories,
  listSourceRoles,
} from '../utils/api/migrations.js';

// what the API returns in place of a stored secret; it is never a usable value
const SECRET_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

const PROVIDERS = [
  { id: 'kaltura', label: 'Kaltura', available: true },
  { id: 'panopto', label: 'Panopto', available: false },
  { id: 'youtube', label: 'YouTube', available: false },
];

const PLACEHOLDER_TEXT = {
  panopto: 'Panopto migration is not implemented yet. Kaltura is the only source available today.',
  youtube: 'YouTube migration is not implemented yet. Kaltura is the only source available today.',
};

// keys that must be filled before a connection can be tested; mirrors each
// provider's required_connection_keys on the backend
const REQUIRED_CONNECTION_FIELDS = {
  kaltura: ['service_url', 'partner_id', 'app_token_id', 'app_token'],
  panopto: ['service_url', 'client_id', 'client_secret'],
  youtube: ['channel_id', 'api_key'],
};

const CONNECTION_FIELDS = {
  kaltura: [
    { key: 'service_url', label: 'Service URL', type: 'text' },
    { key: 'partner_id', label: 'Partner ID', type: 'text' },
    { key: 'app_token_id', label: 'App token ID', type: 'text' },
    { key: 'app_token', label: 'App token value', type: 'password' },
  ],
  panopto: [
    { key: 'service_url', label: 'Service URL', type: 'text' },
    { key: 'client_id', label: 'Client ID', type: 'text' },
    { key: 'client_secret', label: 'Client secret', type: 'password' },
  ],
  youtube: [
    { key: 'channel_id', label: 'Channel', type: 'text' },
    { key: 'api_key', label: 'API key', type: 'password' },
  ],
};

const OPTIONS = [
  {
    key: 'migrate_all_users',
    label: 'Migrate all users',
    help: 'Every account, not just the ones that own media.',
  },
  // With "migrate all users" off these two are alternatives, so each disappears once the
  // other is chosen. Neither chosen is a real setting in its own right: every media goes to
  // the fallback owner, which is why that field shows in exactly that case.
  {
    key: 'restrict_to_users',
    label: 'Only migrate specific users',
    help: 'Only these people\u2019s media. Good for a trial run.',
    shownWhen: [
      { key: 'migrate_all_users', is: false },
      { key: 'create_users', is: false },
    ],
  },
  {
    key: 'source_user_ids',
    label: 'Kaltura user ids, comma separated',
    isText: true,
    placeholder: 'jdoe@example.edu, 5f2c1b9ae4c7',
    help: 'Not always an email. Test connection counts each one, so a typo shows as zero.',
    shownWhen: [
      { key: 'migrate_all_users', is: false },
      { key: 'restrict_to_users', is: true },
    ],
  },
  {
    key: 'create_users',
    label: 'Only create users that have media',
    help: 'Owners are created as their media arrives.',
    shownWhen: [
      { key: 'migrate_all_users', is: false },
      { key: 'restrict_to_users', is: false },
    ],
  },
  {
    key: 'fallback_username',
    label: 'Fallback owner',
    isText: true,
    help: 'Nothing above is chosen, so everything lands here.',
    shownWhen: [
      { key: 'migrate_all_users', is: false },
      { key: 'restrict_to_users', is: false },
      { key: 'create_users', is: false },
    ],
  },
  {
    key: 'migrate_groups',
    label: 'Migrate groups',
    help: 'Kaltura groups become RBAC groups, members included. Needs RBAC on. A group grants nothing until attached to a category.',
  },
  { key: 'import_captions', label: 'Import captions', help: 'Caption assets become subtitles, as WebVTT. Plain text transcripts have no equivalent here and are only logged.' },
  { key: 'preserve_views', label: 'Preserve views', help: 'Play counts are copied onto the migrated media.' },
  { key: 'preserve_publish_state', label: 'Preserve publish state', help: 'Derived from the categories an entry is published through. Unmoderated media stays private. Full mapping in the docs.' },
  { key: 'skip_transcoding', label: 'Attempt to skip transcoding', help: 'Reuse Kaltura\u2019s flavors instead of re-encoding.' },
];

const DEFAULT_ROLE_MAP = [
  { id: '', name: 'Content Moderator (KMC)', role: 'editor' },
  { id: '', name: 'Content Uploader (KMC)', role: 'manager' },
  { id: '', name: 'Player Designer (KMC)', role: 'manager' },
  { id: '', name: 'Manager (KMC)', role: 'admin' },
  { id: '', name: 'Publisher Administrator (KMC)', role: 'admin' },
  { id: '', name: 'privateOnlyRole', role: '' },
  { id: '', name: 'adminRole', role: 'advancedUser' },
  { id: '', name: 'unmoderatedAdminRole', role: 'editor' },
];

const MEDIACMS_ROLES = [
  { value: '', label: 'Plain user' },
  { value: 'advancedUser', label: 'Advanced user' },
  { value: 'editor', label: 'Editor' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Super user and staff' },
];

const TABS = [
  { id: 'connection', label: 'Connection' },
  { id: 'options', label: 'Import options' },
  { id: 'roles', label: 'Global role mapping' },
  { id: 'schedule', label: 'Migration scheduling' },
];

const DEFAULT_OPTIONS = {
  migrate_all_users: true,
  // off, so that unticking "migrate all users" presents both alternatives unchosen rather
  // than silently having already made the choice
  create_users: false,
  fallback_username: 'admin',
  schedule_enabled: false,
  scheduled_at: '',
  import_captions: true,
  preserve_views: true,
  preserve_publish_state: true,
  skip_transcoding: true,
  migrate_groups: false,
  restrict_to_users: false,
  source_user_ids: '',
  source_category_ids: '',
  role_map: DEFAULT_ROLE_MAP,
};

function optionIsShown(option, options) {
  if (!option.shownWhen) {
    return true;
  }
  // an array means every condition has to hold, which is how two options that are
  // alternatives to each other hide one another once either is chosen
  const conditions = [].concat(option.shownWhen);
  return conditions.every((condition) => !!options[condition.key] === condition.is);
}

function migrationIdFromPath() {
  const match = window.location.pathname.match(/^\/migrations\/(\d+)\/edit$/);
  return match ? parseInt(match[1], 10) : null;
}

function providerFromPath() {
  const match = window.location.pathname.match(/^\/migrations\/new\/([\w-]+)$/);
  return match ? match[1] : null;
}

export class MigrationEditPage extends Page {
  constructor(props) {
    super(props, 'migration-edit');

    this.state = {
      id: migrationIdFromPath(),
      name: '',
      provider: providerFromPath(),
      status: null,
      connection: {},
      options: Object.assign({}, DEFAULT_OPTIONS),
      checking: false,
      checkResult: null,
      saving: false,
      error: null,
      activeTab: 'connection',
      loadingRoles: false,
      rolesError: null,
      loadingCategories: false,
      categoriesError: null,
      categories: null,
      serverTime: null,
    };

    this.onCheckClick = this.onCheckClick.bind(this);
    this.onLoadRolesClick = this.onLoadRolesClick.bind(this);
    this.onLoadCategoriesClick = this.onLoadCategoriesClick.bind(this);
    this.onSaveClick = this.onSaveClick.bind(this);
    this.onSaveAndStartClick = this.onSaveAndStartClick.bind(this);
  }

  componentDidMount() {
    // the portal's clock, not the browser's: a schedule is meaningless until the form knows
    // which "now" it is being measured against
    getServerTime()
      .then((response) => this.safeSetState({ serverTime: response.data }))
      .catch(() => {});

    if (this.state.id) {
      getMigration(this.state.id)
        .then((response) => {
          const data = response.data;
          this.safeSetState({
            name: data.name,
            provider: data.provider,
            status: data.status,
            connection: data.connection || {},
            options: Object.assign({}, DEFAULT_OPTIONS, data.options || {}),
          }, () => {
            // fill the picker straight away. A saved selection shown as a bare count with
            // no list under it looks like the page has lost it.
            this.onLoadCategoriesClick();
          });
        })
        .catch(() => this.safeSetState({ error: translateString('Could not load migration') }));
    }
  }

  componentWillUnmount() {
    this.unmounted = true;
  }

  safeSetState(state, callback) {
    // a request can land after the user has navigated away
    if (!this.unmounted) {
      this.setState(state, callback);
    }
  }

  setConnectionValue(key, value) {
    this.setState({ connection: Object.assign({}, this.state.connection, { [key]: value }) });
  }

  setOptionValue(key, value) {
    this.setState({ options: Object.assign({}, this.state.options, { [key]: value }) });
  }

  payload() {
    // post only the options this form knows about. A migration saved before an option was
    // removed still carries it, and echoing it back is how a load turns into a failed save
    const options = {};
    Object.keys(DEFAULT_OPTIONS).forEach((key) => {
      options[key] = this.state.options[key];
    });

    return {
      name: this.state.name,
      provider: this.state.provider,
      connection: this.state.connection,
      options,
    };
  }

  onLoadCategoriesClick() {
    // drop whatever is on screen first: a reload is a fresh answer from the source, not a
    // merge with the last one
    this.setState({ loadingCategories: true, categoriesError: null, categories: null });

    const stillMasked = Object.keys(this.state.connection).some(
      (key) => this.state.connection[key] === SECRET_MASK
    );
    const request =
      this.state.id && stillMasked
        ? listSavedSourceCategories(this.state.id)
        : listSourceCategories({ provider: this.state.provider, connection: this.state.connection });

    request
      .then((response) => {
        const data = response.data;
        if (!data.ok) {
          this.safeSetState({ loadingCategories: false, categoriesError: data.error });
          return;
        }
        this.safeSetState({ loadingCategories: false, categories: data.categories || [] });
      })
      .catch(() =>
        this.safeSetState({ loadingCategories: false, categoriesError: translateString('Request failed') })
      );
  }

  selectedCategoryIds() {
    return String(this.state.options.source_category_ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  toggleCategory(id) {
    const selected = this.selectedCategoryIds();
    const next = selected.indexOf(id) === -1 ? selected.concat([id]) : selected.filter((one) => one !== id);
    this.setOptionValue('source_category_ids', next.join(','));
  }

  onLoadRolesClick() {
    this.setState({ loadingRoles: true, rolesError: null });

    const stillMasked = Object.keys(this.state.connection).some(
      (key) => this.state.connection[key] === SECRET_MASK
    );
    const request =
      this.state.id && stillMasked
        ? listSavedSourceRoles(this.state.id)
        : listSourceRoles({ provider: this.state.provider, connection: this.state.connection });

    request
      .then((response) => {
        const data = response.data;
        if (!data.ok) {
          this.safeSetState({ loadingRoles: false, rolesError: data.error });
          return;
        }
        this.safeSetState({ loadingRoles: false, options: this.mergeRoles(data.roles || []) });
      })
      .catch(() => this.safeSetState({ loadingRoles: false, rolesError: translateString('Request failed') }));
  }

  mergeRoles(roles) {
    // Keep the choice already made for a role, matching stored rows on id first and name
    // second, the same order the importer uses. A role the portal does not have is
    // dropped, since it can only mislead once the real list is known.
    const stored = this.state.options.role_map || [];
    // the shipped rows label console roles "(KMC)" while the portal reports the bare name,
    // so the label comes off before comparing, exactly as the importer does it
    const bare = (name) => String(name || '').replace(/\s*\([^()]*\)\s*$/, '').trim().toLowerCase();
    const previous = (role) =>
      stored.find((row) => row.id && String(row.id) === String(role.id)) ||
      stored.find((row) => bare(row.name) === bare(role.name));

    const role_map = roles.map((role) => ({
      id: String(role.id),
      name: role.name,
      role: (previous(role) || {}).role || '',
    }));

    return Object.assign({}, this.state.options, { role_map });
  }

  setRoleFor(index, value) {
    const role_map = (this.state.options.role_map || []).map((row, position) =>
      position === index ? Object.assign({}, row, { role: value }) : row
    );
    this.setOptionValue('role_map', role_map);
  }

  onCheckClick() {
    this.setState({ checking: true, checkResult: null });

    // On a saved migration the secret comes back masked, so the values on screen
    // cannot authenticate. Ask the server to test its own stored credentials
    // instead. If the operator has typed a fresh secret, test what they typed.
    const stillMasked = Object.keys(this.state.connection).some(
      (key) => this.state.connection[key] === SECRET_MASK
    );
    const request =
      this.state.id && stillMasked
        ? checkSavedConnection(this.state.id, this.state.options)
        : checkConnection({
            provider: this.state.provider,
            connection: this.state.connection,
            options: this.state.options,
          });

    request
      .then((response) => {
        this.safeSetState({ checking: false, checkResult: response.data });
        // a working connection is exactly what the picker was waiting for, and a migration
        // cannot be saved until something is picked, so fetch the list now rather than
        // making the next step a second button
        if (response.data && response.data.ok) {
          this.onLoadCategoriesClick();
        }
      })
      .catch(() => this.safeSetState({ checking: false, checkResult: { ok: false, error: translateString('Request failed') } }));
  }

  save() {
    const { id } = this.state;
    this.setState({ saving: true, error: null });
    const request = id ? updateMigration(id, this.payload()) : createMigration(this.payload());
    return request.catch((error) => {
      const data = error.response && error.response.data;
      this.safeSetState({ saving: false, error: data ? JSON.stringify(data) : translateString('Could not save') });
      return Promise.reject(error);
    });
  }

  onSaveClick() {
    this.save()
      .then(() => {
        window.location.href = '/migrations';
      })
      .catch(() => {
        // already surfaced by save(); swallow so it is not an unhandled rejection
      });
  }

  onSaveAndStartClick() {
    this.save()
      .then((response) => {
        const id = this.state.id || response.data.id;
        controlMigration(id, 'start')
          .then(() => {
            window.location.href = '/migrations/' + id;
          })
          .catch((error) => {
            const detail = error.response && error.response.data && error.response.data.detail;
            this.safeSetState({ saving: false, error: detail || translateString('Could not start migration') });
          });
      })
      .catch(() => {
        // already surfaced by save(); swallow so it is not an unhandled rejection
      });
  }

  renderCheckResult() {
    const result = this.state.checkResult;
    if (this.state.checking) {
      return <span className="migrations-check">{translateString('Checking')}…</span>;
    }
    if (!result) {
      return null;
    }
    if (!result.ok) {
      return <span className="migrations-check migrations-check--error">{result.error}</span>;
    }
    const stats = result.stats || {};
    const perUser = stats.entries_per_user || null;
    return (
      <span className="migrations-check migrations-check--ok">
        {translateString('Connected')} — {stats.entries_are_an_upper_bound ? translateString('up to') + ' ' : ''}
        {stats.entries || 0} {translateString('entries')}, {stats.users || 0}{' '}
        {translateString('users')}, {stats.categories || 0} {translateString('categories')}
        {perUser ? (
          <span className="migration-edit-per-user">
            {Object.keys(perUser).map((userId) => (
              <span key={userId} className={perUser[userId] ? '' : 'is-empty'}>
                {userId}: {perUser[userId]} {translateString('entries')}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    );
  }

  saveProblem() {
    // the reason saving is blocked, or '' when it is not. The server checks all of this
    // too and is the one that counts: this only stops someone submitting a form that would
    // bounce straight back.
    if (!this.selectedCategoryIds().length) {
      return translateString('Pick at least one category to migrate.');
    }
    return this.scheduleProblem();
  }

  scheduleProblem() {
    const options = this.state.options;
    if (true !== options.schedule_enabled) {
      return '';
    }
    if (!options.scheduled_at) {
      return translateString('Pick the date and time to start this migration.');
    }
    const serverTime = this.state.serverTime;
    if (serverTime && options.scheduled_at <= serverTime.now) {
      return translateString('That time has already passed. Pick a later one.');
    }
    return '';
  }

  connectionIsComplete() {
    const required = REQUIRED_CONNECTION_FIELDS[this.state.provider] || [];
    return required.every((key) => String(this.state.connection[key] || '').trim() !== '');
  }

  renderCategories() {
    const selected = this.selectedCategoryIds();
    const categories = this.state.categories;

    return (
      <>
        <p className="migration-edit-help">
          {translateString('Pick at least one. Each brings everything beneath it.')}
        </p>

        <div className="migration-edit-check">
          <button onClick={this.onLoadCategoriesClick} disabled={this.state.loadingCategories || !this.connectionIsComplete()}>
            {this.state.loadingCategories
              ? translateString('Loading categories') + '…'
              : translateString('Reload categories')}
          </button>
          <span className="migrations-check">
            {selected.length
              ? selected.length + ' ' + translateString('selected')
              : translateString('nothing selected yet')}
          </span>
          {this.state.categoriesError ? (
            <span className="migrations-check migrations-check--error">{this.state.categoriesError}</span>
          ) : null}
        </div>

        {null === categories ? null : (
          <div className="migration-edit-categories">
            {categories.length ? (
              categories.map((category) => (
                <label className="migration-edit-category" key={category.id}>
                  <input
                    type="checkbox"
                    checked={-1 !== selected.indexOf(String(category.id))}
                    onChange={() => this.toggleCategory(String(category.id))}
                  />
                  <span className="migration-edit-option-text">
                    {category.name}
                    <span className="migration-edit-help">
                      {'' === category.kind
                        ? translateString('Media in no category. Arrives private.')
                        : 'lms' === category.kind
                        ? translateString('Learning platform tree. No permissions to carry over.')
                        : translateString('MediaSpace site. Category permissions are carried over.')}
                    </span>
                  </span>
                  <span className="migration-edit-category-count">
                    {category.entries} {translateString('media')}
                  </span>
                </label>
              ))
            ) : (
              <p className="migration-edit-help">
                {translateString('No top level categories to choose from.')}
              </p>
            )}
          </div>
        )}
      </>
    );
  }

  renderSchedule() {
    const serverTime = this.state.serverTime;
    const options = this.state.options;
    const scheduled = true === options.schedule_enabled;

    return (
      <>
        <p className="migration-edit-help">
          {translateString(
            'Starts on its own at the time you pick. Nobody needs to be here.'
          )}
        </p>

        <div className="migration-edit-options">
          <label>
            <input
              type="checkbox"
              checked={scheduled}
              onChange={(e) =>
                this.setState({
                  options: Object.assign({}, options, {
                    schedule_enabled: e.target.checked,
                    scheduled_at: e.target.checked ? options.scheduled_at || (serverTime ? serverTime.now : '') : '',
                  }),
                })
              }
            />
            <span className="migration-edit-option-text">
              {translateString('Schedule this migration')}
              <span className="migration-edit-help">
                {serverTime
                  ? translateString('The portal clock reads') +
                    ' ' +
                    serverTime.display +
                    ' (' +
                    serverTime.timezone +
                    '). ' +
                    translateString('Pick a time in that timezone, not your own.')
                  : translateString('Reading the portal clock') + '…'}
              </span>
            </span>
          </label>
        </div>

        {scheduled ? (
          <label className="migration-edit-name">
            <input
              type="datetime-local"
              value={options.scheduled_at || ''}
              min={serverTime ? serverTime.now : undefined}
              onChange={(e) => this.setOptionValue('scheduled_at', e.target.value)}
            />
            <span className="migration-edit-help">
              {this.scheduleProblem() || translateString('Saving is enough. You do not need to press Save and start.')}
            </span>
          </label>
        ) : null}
      </>
    );
  }

  renderRoleMap() {
    const rows = this.state.options.role_map || [];

    return (
      <>
        <p className="migration-edit-help">
          {translateString(
            'Load the portal\u2019s real roles and map them. Matched on id first, name second, so a rename at the source keeps its mapping.'
          )}
        </p>

        <div className="migration-edit-check">
          <button onClick={this.onLoadRolesClick} disabled={this.state.loadingRoles}>
            {this.state.loadingRoles
              ? translateString('Loading roles') + '…'
              : translateString('Load roles from the source')}
          </button>
          {this.state.rolesError ? (
            <span className="migrations-check migrations-check--error">{this.state.rolesError}</span>
          ) : null}
        </div>

        <div className="migration-edit-roles">
          <div className="migration-edit-role migration-edit-role--head">
            <span>{translateString('Source role id')}</span>
            <span>{translateString('Source role')}</span>
            <span>{translateString('MediaCMS role')}</span>
          </div>
          {rows.map((row, index) => (
            <div className="migration-edit-role" key={(row.id || '') + '-' + (row.name || '') + '-' + index}>
              <span className="is-mono">{row.id || '—'}</span>
              <span>{row.name}</span>
              <select value={row.role || ''} onChange={(e) => this.setRoleFor(index, e.target.value)}>
                {MEDIACMS_ROLES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {translateString(choice.label)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <p className="migration-edit-help">
          {translateString(
            'Applied only to accounts this migration creates. Existing accounts keep what they have.'
          )}
        </p>
      </>
    );
  }

  pageContent() {
    const { provider, connection, options } = this.state;
    if (!provider) {
      // an existing migration carries its source on the record, so it is only known
      // once the record has loaded
      return <p>{translateString('Loading')}…</p>;
    }

    const source = PROVIDERS.find((item) => item.id === provider) || { id: provider, label: provider };
    const fields = CONNECTION_FIELDS[provider] || [];
    const available = source.available;
    const canTest = available && this.connectionIsComplete() && !this.state.checking;
    const saveProblem = this.saveProblem();

    return (
      <div className="migration-edit-page">
        <div className="migration-edit-header">
          <h1>{this.state.id ? translateString('Migration settings') : translateString('New migration')}</h1>
          <span className="migration-edit-badge">{source.label}</span>
          {this.state.id ? null : (
            <a className="migration-edit-source-change" href="/migrations/new">
              {translateString('Choose a different source')}
            </a>
          )}
          <a className="migrations-back" href="/migrations">
            {translateString('All migrations')}
          </a>
        </div>

        {'running' === this.state.status ? (
          <p className="migration-edit-warning">
            {translateString(
              'Running. Changes apply only to what it has not reached yet, and the connection is locked until you pause it.'
            )}
          </p>
        ) : null}

        {available ? (
          <p className="migration-edit-intro">
            {translateString('Nothing is imported until you start the migration.')}
          </p>
        ) : (
          <p className="migration-edit-placeholder">{translateString(PLACEHOLDER_TEXT[provider])}</p>
        )}

        {available ? (
          <>
            <div className="migration-edit-tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={this.state.activeTab === tab.id}
                  className={this.state.activeTab === tab.id ? 'is-active' : ''}
                  onClick={() => this.setState({ activeTab: tab.id })}
                >
                  {translateString(tab.label)}
                </button>
              ))}
            </div>

            <div hidden={'connection' !== this.state.activeTab}>
            <p className="migration-edit-section">{translateString('Name')}</p>
            <label className="migration-edit-name">
              <input
                type="text"
                value={this.state.name}
                onChange={(e) => this.setState({ name: e.target.value })}
                placeholder={source.label}
              />
              <span className="migration-edit-help">
                {translateString('Only used to tell this migration apart in the list.')}
              </span>
            </label>

            <p className="migration-edit-section">{translateString('Connection')}</p>
            <p className="migration-edit-help">
              {translateString(
                'An app token, so the account\u2019s admin secret is never shared. It needs admin session type and a long expiry.'
              )}
            </p>
            <div className="migration-edit-connection">
              {fields.map((field) => (
                <label key={field.key}>
                  <span>{translateString(field.label)}</span>
                  <input
                    type={field.type}
                    value={connection[field.key] || ''}
                    onChange={(e) => this.setConnectionValue(field.key, e.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className="migration-edit-check">
              <button onClick={this.onCheckClick} disabled={!canTest}>
                {translateString('Test connection')}
              </button>
              {this.renderCheckResult()}
            </div>

            <p className="migration-edit-section">{translateString('Categories')}</p>
            {this.renderCategories()}

            </div>

            <div hidden={'options' !== this.state.activeTab}>
            <div className="migration-edit-options">
              {OPTIONS.filter((option) => optionIsShown(option, options)).map((option) => (
                <React.Fragment key={option.key}>
                  {option.isText ? (
                    <label className="migration-edit-nested">
                      <span>{translateString(option.label)}</span>
                      <input
                        type="text"
                        value={options[option.key] || ''}
                        placeholder={option.placeholder || undefined}
                        onChange={(e) => this.setOptionValue(option.key, e.target.value)}
                      />
                      <span className="migration-edit-help">{translateString(option.help)}</span>
                    </label>
                  ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={!!options[option.key]}
                      onChange={(e) => this.setOptionValue(option.key, e.target.checked)}
                    />
                    <span className="migration-edit-option-text">
                      {translateString(option.label)}
                      <span className="migration-edit-help">{translateString(option.help)}</span>
                    </span>
                  </label>
                  )}

                  {option.field && optionIsShown(option.field, options) ? (
                    <label className="migration-edit-nested">
                      <span>{translateString(option.field.label)}</span>
                      <input
                        type="text"
                        value={options[option.field.key] || ''}
                        onChange={(e) => this.setOptionValue(option.field.key, e.target.value)}
                      />
                      <span className="migration-edit-help">{translateString(option.field.help)}</span>
                    </label>
                  ) : null}
                </React.Fragment>
              ))}
            </div>

            </div>


            <div hidden={'roles' !== this.state.activeTab}>{this.renderRoleMap()}</div>

            <div hidden={'schedule' !== this.state.activeTab}>{this.renderSchedule()}</div>

            {this.state.error ? <p className="migrations-error">{this.state.error}</p> : null}

            <div className="migration-edit-actions">
              <button onClick={this.onSaveClick} disabled={this.state.saving || '' !== saveProblem}>
                {translateString('Save draft')}
              </button>
              <button onClick={this.onSaveAndStartClick} disabled={this.state.saving || '' !== saveProblem}>
                {translateString('Save and start migration')}
              </button>
              <span className="migration-edit-note">
                {saveProblem || translateString('Credentials are stored encrypted')}
              </span>
            </div>
          </>
        ) : null}
      </div>
    );
  }
}
