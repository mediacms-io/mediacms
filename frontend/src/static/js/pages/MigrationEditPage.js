import React from 'react';
import { Page } from './_Page';
import './Migrations.scss';
import { translateString } from '../utils/helpers/';
import {
  createMigration,
  updateMigration,
  getMigration,
  getServerTime,
  listLtiPlatforms,
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
  { id: 'kaltura', label: 'Kaltura', available: true, canImport: true },
  { id: 'panopto', label: 'Panopto', available: true, canImport: true },
  { id: 'youtube', label: 'YouTube', available: true, canImport: true },
];


const PLACEHOLDER_TEXT = {};

// keys that must be filled before a connection can be tested; mirrors each provider's
// required_connection_keys on the backend
const REQUIRED_CONNECTION_FIELDS = {
  kaltura: ['service_url', 'partner_id', 'app_token_id', 'app_token'],
  panopto: ['service_url', 'client_id', 'client_secret', 'username', 'password'],
  youtube: ['sources'],
};

const CONNECTION_FIELDS = {
  kaltura: [
    { key: 'service_url', label: 'Service URL', type: 'text' },
    { key: 'partner_id', label: 'Partner ID', type: 'text' },
    { key: 'app_token_id', label: 'App token ID', type: 'text' },
    { key: 'app_token', label: 'App token value', type: 'password' },
  ],
  panopto: [
    { key: 'service_url', label: 'Service URL', type: 'text', help: 'Your Panopto site, e.g. https://yourorg.cloud.panopto.eu' },
    { key: 'client_id', label: 'Client ID', type: 'text', help: 'From System \u2192 API Clients. Create it as a User-Based Server Application.' },
    { key: 'client_secret', label: 'Client secret', type: 'password' },
    { key: 'username', label: 'Service account', type: 'text', help: 'A local Panopto account the migration acts as. It sees only what that account sees, so give it admin rights.' },
    { key: 'password', label: 'Service account password', type: 'password' },
  ],
  youtube: [
    {
      key: 'sources',
      label: 'Videos, playlists or channels',
      type: 'textarea',
      wide: true,
      placeholder: 'https://www.youtube.com/watch?v=…\nhttps://www.youtube.com/playlist?list=…\nhttps://www.youtube.com/@handle/videos',
      help: 'One per line. A bare video id works too.',
    },
    {
      key: 'cookies',
      label: 'Cookies file contents',
      type: 'textarea',
      wide: true,
      help: 'For private or members-only video, and for a server YouTube bot checks. Export cookies.txt from a browser profile you then stop using: a jar from a session that keeps running is rotated out and breaks requests that would otherwise work.',
    },
  ],
};

const YOUTUBE_OPTIONS = [
  {
    key: 'fallback_username',
    label: 'Owner',
    isText: true,
    help: 'Every imported video is given to this existing MediaCMS user. YouTube uploader names do not become accounts.',
  },
  { key: 'import_captions', label: 'Import captions', help: 'The English subtitle, if the video has one. Auto-generated captions are ignored.' },
  { key: 'preserve_views', label: 'Preserve views', help: 'Copy the YouTube view count onto the imported video.' },
  {
    key: 'skip_transcoding',
    label: 'Attempt to skip transcoding',
    help: 'YouTube serves video and audio separately, so the two are muxed into one h264 mp4 and filed as a rendition. Turn this off to re-encode instead.',
  },
];

const USER_CHOICE = 'users';

const OPTIONS = [
  {
    key: 'migrate_all_users',
    group: USER_CHOICE,
    label: 'Migrate all users',
    help: 'All user accounts and media are migrated, and not just the ones that own media.',
  },
  {
    key: 'restrict_to_users',
    group: USER_CHOICE,
    label: 'Only migrate below listed users',
    help: 'Only media (entries) of these users will be migrated.',
    field: { key: 'source_user_ids', placeholder: 'jdoe@example.edu, 5f2c1b9ae4c7' },
  },
  {
    key: 'create_users',
    group: USER_CHOICE,
    label: 'Only migrate users that own media',
    help: 'Media owners are migrated together with their media.',
  },
  {
    key: 'migrate_playlists',
    label: 'Migrate playlists',
    help: 'All playlists, users owning playlist, and media associated with the playlists are migrated, irrespective of above selections of users to migrate.',
  },
  {
    key: 'lti_platform_id',
    label: 'LTI platform for LMS courses',
    isSelect: true,
    blankLabel: 'Not wired to LTI',
    help: 'Migrated LMS courses have to be linked to an LTI platform to ensure synchronisation with the LMS system. Can be set up under: MediaCMS Admin \u2192 LTI 1.3 Integration \u2192 LTI Platforms.',
  },
  {
    key: 'rollup_subcategories',
    label: 'Add entries in sub-categories to parent categories',
    help: 'In Kaltura, a KMS portal category also shows content of sub-categories to the user, whereas MediaCMS does not make use of sub-categories. Deselect if content of KMS sub-categories in Kaltura should not be added to the category in MediaCMS.',
  },
  {
    key: 'migrate_groups',
    label: 'Migrate groups',
    help: 'All groups and group members are migrated, irrespective of above selections of users to migrate. Needs RBAC on.',
  },
  { key: 'import_captions', label: 'Import captions', help: 'All captions for migrated media are migrated.' },
  {
    key: 'preserve_views',
    label: 'Import statistics (Plays/Views)',
    help: 'Play counts are migrated and added to migrated media.',
  },
  {
    key: 'preserve_publish_state',
    label: 'Maintain publish state of media',
    help: 'Publish state of media is transferred to migrated media (e.g. Private / Unlisted). Unmoderated media stays private.',
  },
  {
    key: 'skip_transcoding',
    label: 'Migrate media flavors / encodings',
    help: 'All flavor encodings of a Kaltura media entry are migrated, whereby re-encoding is avoided. Deselect to migrate only the original file and do the encoding in MediaCMS.',
  },
];

const DEFAULT_ROLE_MAP = [
  { id: '', name: 'Content Moderator (KMC)', role: 'editor' },
  { id: '', name: 'Content Uploader (KMC)', role: 'manager' },
  { id: '', name: 'Player Designer (KMC)', role: 'manager' },
  { id: '', name: 'Manager (KMC)', role: 'admin' },
  { id: '', name: 'Publisher Administrator (KMC)', role: 'admin' },
  { id: '', name: 'viewerRole', role: '' },
  { id: '', name: 'privateOnlyRole', role: '' },
  { id: '', name: 'adminRole', role: 'advancedUser' },
  { id: '', name: 'unmoderatedAdminRole', role: 'editor' },
  { id: '', name: 'unconfirmedViewerRole', role: '' },
];

// MediaSpace's own roles: Kaltura does not serve them, so Load must not drop them
const KMS_APPLICATION_ROLES = ['viewerRole', 'privateOnlyRole', 'adminRole', 'unmoderatedAdminRole', 'unconfirmedViewerRole'];

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
  { id: 'roles', label: 'Global role mapping', providers: ['kaltura'] },
  { id: 'schedule', label: 'Migration scheduling' },
];

function tabsFor(provider) {
  return TABS.filter((tab) => !tab.providers || -1 < tab.providers.indexOf(provider));
}

const SCHEDULE_DEFAULTS = {
  schedule_enabled: false,
  scheduled_at: '',
  quiet_hours_enabled: false,
  quiet_from: '08:00',
  quiet_to: '17:00',
  run_during_weekends: false,
};

const DEFAULT_OPTIONS = Object.assign({
  migrate_all_users: true,
  create_users: false,
  import_captions: true,
  preserve_views: true,
  preserve_publish_state: true,
  skip_transcoding: true,
  migrate_groups: false,
  migrate_playlists: false,
  rollup_subcategories: true,
  lti_platform_id: '',
  restrict_to_users: false,
  source_user_ids: '',
  source_category_ids: '',
  role_map: DEFAULT_ROLE_MAP,
}, SCHEDULE_DEFAULTS);

// scheduling is not a source's business, so it belongs to every provider
const YOUTUBE_DEFAULT_OPTIONS = Object.assign(
  {
    fallback_username: 'admin',
    import_captions: true,
    preserve_views: false,
    skip_transcoding: true,
  },
  SCHEDULE_DEFAULTS
);

const PANOPTO_OPTIONS = [
  {
    key: 'create_users',
    label: 'Only migrate users that own media',
    help: 'Panopto has no way to list its users through the API, so owners are created as the recordings that belong to them arrive.',
  },
  {
    key: 'fallback_username',
    label: 'Fallback owner',
    isText: true,
    help: 'Used for a recording whose owner Panopto does not name, and for every recording when the option above is off.',
  },
  {
    key: 'rollup_subfolders',
    label: 'Add recordings in sub-folders to parent-folders',
    help: 'A folder also holds what its sub-folders hold. MediaCMS categories are flat, so without this a parent folder shows fewer recordings than Panopto does.',
  },
  {
    key: 'import_captions',
    label: 'Import captions',
    help: 'Captions Panopto offers for a recording are migrated as subtitles.',
  },
];

const PANOPTO_DEFAULT_OPTIONS = Object.assign(
  {
    source_category_ids: '',
    create_users: true,
    fallback_username: 'admin',
    rollup_subfolders: true,
    import_captions: true,
  },
  SCHEDULE_DEFAULTS
);

// only the keys a provider knows are posted: the backend rejects an option it does not
// recognise
function defaultsFor(provider) {
  if ('youtube' === provider) {
    return YOUTUBE_DEFAULT_OPTIONS;
  }
  if ('panopto' === provider) {
    return PANOPTO_DEFAULT_OPTIONS;
  }
  return DEFAULT_OPTIONS;
}

function optionsFor(provider) {
  if ('youtube' === provider) {
    return YOUTUBE_OPTIONS;
  }
  if ('panopto' === provider) {
    return PANOPTO_OPTIONS;
  }
  return OPTIONS;
}

function postedKeys(provider) {
  const keys = Object.keys(defaultsFor(provider));
  optionsFor(provider).forEach((option) => {
    [option.key, option.field && option.field.key].forEach((key) => {
      if (key && -1 === keys.indexOf(key)) {
        keys.push(key);
      }
    });
  });
  return keys;
}

// the two sources whose media lives in a tree a person has to choose from
function picksCategories(provider) {
  return 'kaltura' === provider || 'panopto' === provider;
}

function optionIsShown(option, options) {
  if (!option.shownWhen) {
    return true;
  }
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
      ltiPlatforms: [],
      connection: {},
      options: Object.assign({}, defaultsFor(providerFromPath())),
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
    this.onOptionToggle = this.onOptionToggle.bind(this);
  }

  componentDidMount() {
    // the portal's clock, not the browser's: a schedule needs a "now" to be measured against
    getServerTime()
      .then((response) => this.safeSetState({ serverTime: response.data }))
      .catch(() => {});

    // empty on a portal without LTI, which is how the option knows to stay hidden
    listLtiPlatforms()
      .then((response) => this.safeSetState({ ltiPlatforms: response.data || [] }))
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
            options: Object.assign({}, defaultsFor(data.provider), data.options || {}),
          }, () => {
            // fill the picker straight away: a saved selection shown as a bare
            // count looks like the page has lost it
            if (picksCategories(this.state.provider)) {
              this.onLoadCategoriesClick();
            }
          });
        })
        .catch((error) => {
          const status = error && error.response && error.response.status;
          this.safeSetState({
            error: translateString(404 === status ? 'That migration no longer exists.' : 'Could not load migration'),
            missing: 404 === status,
          });
        });
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
    // post only the options this form knows about, and everything it renders: echoing back
    // one that has since been removed is how a load turns into a failed save
    const options = {};
    postedKeys(this.state.provider).forEach((key) => {
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
    // drop what is on screen first: a reload is a fresh answer, not a merge
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
    // Keep the choice already made, matching stored rows on id first and name second, as
    // the importer does. A console role the portal does not have is dropped.
    const stored = this.state.options.role_map || [];
    // the shipped rows label console roles "(KMC)" and the portal reports the bare name
    const bare = (name) => String(name || '').replace(/\s*\([^()]*\)\s*$/, '').trim().toLowerCase();
    const previous = (role) =>
      stored.find((row) => row.id && String(row.id) === String(role.id)) ||
      stored.find((row) => bare(row.name) === bare(role.name));

    const role_map = roles.map((role) => ({
      id: String(role.id),
      name: role.name,
      role: (previous(role) || {}).role || '',
    }));

    const loaded = role_map.map((row) => bare(row.name));
    KMS_APPLICATION_ROLES.forEach((name) => {
      if (-1 === loaded.indexOf(bare(name))) {
        const kept = stored.find((row) => bare(row.name) === bare(name));
        role_map.push({ id: '', name: name, role: (kept || {}).role || '' });
      }
    });

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

    // On a saved migration the secret comes back masked, so ask the server to test its own
    // stored credentials. A freshly typed secret is tested as typed.
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
        // a working connection is what the picker was waiting for, and nothing can be saved
        // until something is picked, so fetch the list rather than asking for a second click
        if (response.data && response.data.ok && picksCategories(this.state.provider)) {
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

  startAction() {
    // the mapping the listing and the dashboard already use, so the button cannot offer a
    // transition the server will refuse
    const status = this.state.status;
    if ('paused' === status) {
      return { action: 'resume', label: 'Save and resume migration' };
    }
    if ('success' === status || 'error' === status || 'aborted' === status) {
      return { action: 'rerun', label: 'Save and run migration again' };
    }
    return { action: 'start', label: 'Save and start migration' };
  }

  onSaveAndStartClick() {
    this.save()
      .then((response) => {
        const id = this.state.id || response.data.id;
        controlMigration(id, this.startAction().action)
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

  onOptionToggle(option, checked) {
    if (!option.group) {
      this.setOptionValue(option.key, checked);
      return;
    }

    const next = Object.assign({}, this.state.options);
    optionsFor(this.state.provider)
      .filter((entry) => entry.group === option.group)
      .forEach((entry) => {
        next[entry.key] = entry.key === option.key;
      });
    this.safeSetState({ options: next });
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
        {translateString('Success! Connected.')}
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

  scheduleNote() {
    // the consequence of the button, next to the button
    const options = this.state.options;
    if (true !== options.schedule_enabled || !options.scheduled_at) {
      return '';
    }
    const zone = this.state.serverTime ? ' (' + this.state.serverTime.timezone + ')' : '';
    return translateString('Starts') + ' ' + options.scheduled_at.replace('T', ', ') + zone;
  }

  saveProblem() {
    // the reason saving is blocked, or '' when it is not. The server checks it too and is
    // the one that counts: this only stops a form that would bounce straight back.
    if (picksCategories(this.state.provider) && !this.selectedCategoryIds().length) {
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
      return translateString('The time has already passed. Please, select a later time.');
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

    const panopto = 'panopto' === this.state.provider;

    return (
      <>
        <p className="migration-edit-help">
          {translateString(panopto ? 'Load it and select top level folders' : 'Load it and select root categories')}{' '}
          <span
            className="info-tooltip"
            title={translateString(
              panopto
                ? 'For each folder selected, its sub-folders are migrated too, and each recording is associated with the corresponding category in MediaCMS. Users is Panopto\u2019s own container for personal folders, so choosing it migrates what people keep in their own My Folder.'
                : 'For each root category selected, subordinated site categories and channels will be migrated. Media (entries) associated with each category or channel will likewise be associated with the corresponding category in MediaCMS'
            )}
          >
            ?
          </span>
        </p>

        <div className="migration-edit-check">
          <button onClick={this.onLoadCategoriesClick} disabled={this.state.loadingCategories || !this.connectionIsComplete()}>
            {this.state.loadingCategories
              ? translateString(panopto ? 'Loading folders' : 'Loading categories') + '…'
              : translateString(panopto ? 'Load top level folders from source' : 'Load root categories from source')}
          </button>
          <span className="migrations-check">
            {selected.length ? selected.length + ' ' + translateString('selected') : ''}
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
                      {'panopto' === category.kind
                        ? translateString('Panopto folder. Its sub-folders and their recordings are migrated with it.')
                        : '' === category.kind
                        ? translateString('Media in no category. Arrives private.')
                        : 'lms' === category.kind
                        ? translateString('Learning Management site (LMS). No permissions to migrate, as LMS channels in Kaltura have no permissions.')
                        : translateString('MediaSpace site (KMS). Category and channel permissions are migrated.')}
                    </span>
                  </span>
                  <span className="migration-edit-category-count">
                    {category.entries} {translateString('media')}
                  </span>
                </label>
              ))
            ) : (
              <p className="migration-edit-help">
                {translateString(panopto ? 'No top level folders to choose from.' : 'No top level categories to choose from.')}
              </p>
            )}
          </div>
        )}
      </>
    );
  }

  renderTotals() {
    const result = this.state.checkResult;
    if (!result || !result.ok) {
      return null;
    }
    const stats = result.stats || {};
    // captions are absent on purpose: counting them up front means fetching every entry id,
    // so the run counts them as it discovers them
    const rows =
      'youtube' === this.state.provider
        ? [['Media', stats.entries]]
        : 'panopto' === this.state.provider
        ? [
            ['Media', stats.entries],
            ['Folders', stats.folders],
          ]
        : [
            ['Users', stats.users],
            ['Groups', stats.groups],
            ['Media', stats.entries],
            ['Categories', stats.categories],
            ['Channels', stats.channels],
            ['Playlists', stats.playlists],
          ];

    return (
      <div className="migration-edit-totals">
        <p className="migration-edit-section">{translateString('Total count for migration')}</p>
        <div className="migration-edit-totals-row">
          {rows.map(([label, value]) => (
            <span key={label}>
              <strong>{value || 0}</strong> {translateString(label)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  renderSchedule() {
    const serverTime = this.state.serverTime;
    const options = this.state.options;
    const scheduled = true === options.schedule_enabled;
    const quiet = true === options.quiet_hours_enabled;

    return (
      <>
        <p className="migration-edit-help">{translateString('Migration runs during the time selected')}</p>

        <div className="migration-edit-panel">
          <div className="migration-edit-panel-section">
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
                        translateString('Below calendar follows this portal timezone!')
                      : translateString('Reading the portal clock') + '\u2026'}
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
              </label>
            ) : null}
          </div>

          <div className="migration-edit-panel-section">
            <div className="migration-edit-options">
              <label>
                <input
                  type="checkbox"
                  checked={quiet}
                  onChange={(e) => this.setOptionValue('quiet_hours_enabled', e.target.checked)}
                />
                <span className="migration-edit-option-text">{translateString('Do not run between')}</span>
              </label>
            </div>

            {quiet ? (
              <>
                <label className="migration-edit-name">
                  <span className="migration-edit-quiet-range">
                    <input
                      type="time"
                      value={options.quiet_from || ''}
                      onChange={(e) => this.setOptionValue('quiet_from', e.target.value)}
                    />
                    <span>{translateString('and')}</span>
                    <input
                      type="time"
                      value={options.quiet_to || ''}
                      onChange={(e) => this.setOptionValue('quiet_to', e.target.value)}
                    />
                  </span>
                  <span className="migration-edit-help">
                    {translateString('The migration is paused during the selected hours (portal time zone).')}
                  </span>
                </label>

                <div className="migration-edit-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={true === options.run_during_weekends}
                      onChange={(e) => this.setOptionValue('run_during_weekends', e.target.checked)}
                    />
                    <span className="migration-edit-option-text">
                      {translateString('Run unpaused during weekends (portal time zone)')}
                    </span>
                  </label>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {scheduled ? (
          <p className="migration-edit-help">{this.scheduleProblem() || translateString('Saving is enough.')}</p>
        ) : null}
      </>
    );
  }

  renderRoleMap() {
    const rows = this.state.options.role_map || [];

    return (
      <>
        <p className="migration-edit-help">
          {translateString('Load Kaltura\u2019s global roles and map them with MediaCMS\u2019s global roles.')}
          <br />
          {translateString(
            'They are matched on id first, name second, whereby renaming at the source preserves the mapping.'
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
              <span className={row.id ? 'is-mono' : undefined}>
                {row.id || translateString('MediaSpace')}
              </span>
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
            'Only applied to accounts created by this migration. Existing accounts retain their roles as they are.'
          )}
        </p>
      </>
    );
  }

  pageContent() {
    const { provider, connection, options } = this.state;
    if (!provider) {
      // an existing migration carries its source on the record, known once it has loaded.
      // A load that failed has to say so: without this the page loads for ever.
      if (this.state.error) {
        return (
          <div className="migration-edit-page">
            <div className="migration-edit-header">
              <h1>{translateString('Migration settings')}</h1>
              <a className="migrations-back" href="/migrations">
                {translateString('All migrations')}
              </a>
            </div>
            <p className="migrations-error">{this.state.error}</p>
          </div>
        );
      }
      return <p>{translateString('Loading')}…</p>;
    }

    const source = PROVIDERS.find((item) => item.id === provider) || { id: provider, label: provider };
    const fields = CONNECTION_FIELDS[provider] || [];
    const available = source.available;
    // configurable and testable is not the same as runnable
    const runnable = false !== source.canImport;
    const canTest = available && this.connectionIsComplete() && !this.state.checking;
    const saveProblem = this.saveProblem();
    const scheduled = true === options.schedule_enabled;

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
              {tabsFor(provider).map((tab) => (
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
            <p className="migration-edit-section">{translateString('Name migration session')}</p>
            <label className="migration-edit-name">
              <input
                type="text"
                value={this.state.name}
                onChange={(e) => this.setState({ name: e.target.value })}
                placeholder={source.label}
              />
            </label>

            <p className="migration-edit-section">{translateString('Connection')}</p>
            {'kaltura' === provider ? (
              <p className="migration-edit-help">
                {translateString('Create and add an app token, so the account admin\u2019s secret is never shared.')}{' '}
                <span
                  className="info-tooltip"
                  title={translateString('Check Kaltura migration page for how to generate the app token and for more info')}
                >
                  ?
                </span>
              </p>
            ) : null}
            <p className="migration-edit-help">{translateString('Credentials are stored encrypted')}</p>
            <div className="migration-edit-connection">
              {fields.map((field) => (
                <label key={field.key} className={field.wide ? 'migration-edit-field-wide' : undefined}>
                  <span>{translateString(field.label)}</span>
                  {'textarea' === field.type ? (
                    <textarea
                      rows={field.key === 'cookies' ? 3 : 4}
                      value={connection[field.key] || ''}
                      placeholder={field.placeholder ? translateString(field.placeholder) : undefined}
                      onChange={(e) => this.setConnectionValue(field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={connection[field.key] || ''}
                      onChange={(e) => this.setConnectionValue(field.key, e.target.value)}
                    />
                  )}
                  {field.help ? <span className="migration-edit-help">{translateString(field.help)}</span> : null}
                </label>
              ))}
            </div>

            <div className="migration-edit-check">
              <button onClick={this.onCheckClick} disabled={!canTest}>
                {translateString('Test connection')}
              </button>
              {this.renderCheckResult()}
            </div>

            {picksCategories(provider) ? (
              <>
                <p className="migration-edit-section">{translateString('Categories')}</p>
                {this.renderCategories()}
              </>
            ) : null}

            </div>

            <div hidden={'options' !== this.state.activeTab}>
            <div className="migration-edit-options">
              {optionsFor(provider)
                .filter((option) => optionIsShown(option, options))
                .filter((option) => !option.isSelect || this.state.ltiPlatforms.length)
                .map((option) => (
                <React.Fragment key={option.key}>
                  {option.isSelect ? (
                    <label className="migration-edit-nested">
                      <span>{translateString(option.label)}</span>
                      <select
                        value={options[option.key] || ''}
                        onChange={(e) => this.setOptionValue(option.key, e.target.value)}
                      >
                        <option value="">{translateString(option.blankLabel)}</option>
                        {this.state.ltiPlatforms.map((platform) => (
                          <option key={platform.id} value={platform.id}>
                            {platform.name}
                          </option>
                        ))}
                      </select>
                      {option.help ? <span className="migration-edit-help">{translateString(option.help)}</span> : null}
                    </label>
                  ) : option.isText ? (
                    <label className="migration-edit-nested">
                      <span>{translateString(option.label)}</span>
                      <input
                        type="text"
                        value={options[option.key] || ''}
                        placeholder={option.placeholder ? translateString(option.placeholder) : undefined}
                        onChange={(e) => this.setOptionValue(option.key, e.target.value)}
                      />
                      {option.help ? <span className="migration-edit-help">{translateString(option.help)}</span> : null}
                    </label>
                  ) : (
                  <label>
                    <input
                      type={option.group ? 'radio' : 'checkbox'}
                      name={option.group || undefined}
                      checked={!!options[option.key]}
                      onChange={(e) => this.onOptionToggle(option, e.target.checked)}
                    />
                    <span className="migration-edit-option-text">
                      {translateString(option.label)}
                      <span className="migration-edit-help">{translateString(option.help)}</span>
                      {option.field ? (
                        <input
                          type="text"
                          className="migration-edit-option-field"
                          value={options[option.field.key] || ''}
                          placeholder={option.field.placeholder ? translateString(option.field.placeholder) : undefined}
                          onChange={(e) => this.setOptionValue(option.field.key, e.target.value)}
                        />
                      ) : null}
                    </span>
                  </label>
                  )}
                </React.Fragment>
              ))}
            </div>

            </div>


            <div hidden={'roles' !== this.state.activeTab}>{this.renderRoleMap()}</div>

            <div hidden={'schedule' !== this.state.activeTab}>{this.renderSchedule()}</div>

            {this.state.error ? <p className="migrations-error">{this.state.error}</p> : null}

            {this.renderTotals()}

            <div className="migration-edit-actions">
              {scheduled ? (
                // saving is what arms the schedule, so starting now as well would be two
                // contradictory orders
                <button onClick={this.onSaveClick} disabled={this.state.saving || '' !== saveProblem}>
                  {translateString('Save and schedule migration')}
                </button>
              ) : (
                <>
                  <button onClick={this.onSaveClick} disabled={this.state.saving || '' !== saveProblem}>
                    {translateString('Save draft')}
                  </button>
                  {'running' === this.state.status || !runnable ? null : (
                    <button onClick={this.onSaveAndStartClick} disabled={this.state.saving || '' !== saveProblem}>
                      {translateString(this.startAction().label)}
                    </button>
                  )}
                </>
              )}
              <span className="migration-edit-note">{saveProblem || this.scheduleNote()}</span>
            </div>
          </>
        ) : null}
      </div>
    );
  }
}
