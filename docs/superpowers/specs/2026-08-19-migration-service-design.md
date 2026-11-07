# Migration Service — Design

Date: 2026-08-19
Status: approved, ready for implementation planning

## 1. Purpose

Give MediaCMS administrators a way to fully migrate an existing installation of another
video platform — media files, metadata, users and categories — into MediaCMS.

Kaltura is implemented. Panopto and YouTube are placeholders that appear in the UI but
raise `NotImplementedError`, so the provider interface is proven by having a second and
third slot rather than by having a second and third implementation.

A migration is a long-running, resumable job. It can be paused, resumed and aborted, it
logs every object it touches, and every object it creates is recorded in a mapping table
so that the source ID and the MediaCMS ID stay linked after the fact.

## 2. Scope

In scope:

- Kaltura media entries, users, categories (KMS galleries and channels), caption assets, tags.
- Application-wide role mapping, for accounts the migration itself creates.
- Preserving views, publish state and creation dates.
- Skipping MediaCMS transcoding by importing Kaltura flavors directly as MediaCMS encodings.
- An admin-only three-page UI: list, settings, running dashboard.
- A source-ID to MediaCMS-ID mapping table supporting monitoring, rerun, verification and
  (later) reversal.

Out of scope for this version:

- **Kaltura access control.** Category privacy, `categoryUser` membership, owners and
  permission levels are not carried over. Every imported category is a plain public
  MediaCMS category: `is_rbac_category` is never set, and no `RBACGroup` or
  `RBACMembership` is created. What survives is the *media's* own visibility —
  public, unlisted or private — which is derived from the privacy of the categories
  an entry belongs to.
- **Categories with no media.** A Kaltura gallery or channel that contains nothing is
  never copied. Categories are created only as the media that belong to them arrive.
- Kaltura custom thumbnails as posters. MediaCMS generates its own frame grab.
- Chapters / cue points.
- Playlists and comments.
- A revert action. The mapping table records everything needed to build one; the action
  itself is deliberately not shipped in this version.
- **Plain-text transcripts.** In Kaltura these are attachment assets, a different thing
  from timed caption assets. MediaCMS has no model to hold un-timed transcript text, so
  they are not fetched at all — one fewer API call per entry, and no misleading `skipped`
  rows in the mapping table.

## 3. Architecture

A new Django app, `migrationservice`.

```
migrationservice/
  __init__.py
  apps.py
  models.py            # MigrationService, MigrationRecord, credential encryption helpers
  serializers.py       # per-provider connection/options validation + API serializers
  views.py             # DRF viewset (admin only) + Django page views
  urls.py
  tasks.py             # run_migration orchestrator, migrate_* item tasks
  admin.py
  providers/
    __init__.py        # get_provider(name)
    base.py            # BaseProvider interface
    kaltura.py         # client, adapter and mapping functions, one file
    panopto.py         # stub
    youtube.py         # stub
  migrations/
  tests/
templates/cms/
  migrations.html
  migration_edit.html
  migration_detail.html
frontend/src/static/js/pages/
  MigrationsPage.tsx
  MigrationEditPage.tsx
  MigrationDetailPage.tsx
```

`files/` is already 1100 lines of models and 1109 lines of tasks. A separate app keeps the
provider code, its tasks and its API out of that, and makes the whole feature removable.

One file per provider. `kaltura.py` holds the HTTP client, the provider adapter and the
mapping functions together; the mapping functions stay module-level and pure — plain dicts
in, plain values out — so the rules that are easiest to get wrong are still the cheapest to
test, without needing a package to say so.

Page templates live in `templates/cms/` alongside `manage_media.html`, following the
existing convention rather than introducing an app-specific template directory.

### Provider interface (`providers/base.py`)

```python
class BaseProvider:
    def __init__(self, connection: dict, options: dict): ...
    def check_connection(self) -> dict          # {ok, error, stats: {...}}
    def iter_users(self, cursor) -> Iterator     # yields (source_id, payload, next_cursor)
    def iter_categories(self, cursor) -> Iterator
    def iter_media(self, cursor) -> Iterator
    def fetch_media(self, source_id) -> dict     # entry + flavors + captions + categories
    def download(self, url, dest_path) -> int    # streamed, returns bytes written
```

Cursors are opaque JSON-serialisable dicts owned by the provider. The orchestrator stores
and returns them without interpreting them.

## 4. Data model

### MigrationService

| field | type | notes |
| --- | --- | --- |
| `name` | CharField(100) | |
| `provider` | CharField, choices kaltura/panopto/youtube | |
| `source_system` | CharField(255), db_index | normalised identity of the source install, derived on save |
| `connection` | JSONField | credentials; secret values encrypted at rest |
| `options` | JSONField | the import options |
| `status` | CharField, choices | `pending` (default), `running`, `paused`, `error`, `success`, `aborted` |
| `cursor` | JSONField, default dict | resume position |
| `totals` | JSONField, default dict | discovered/migrated/failed counts per object type |
| `log` | TextField | phase-level events, appended |
| `created_at` | DateTimeField auto_now_add | |
| `started_at` | DateTimeField null | first start |
| `ended_at` | DateTimeField null | set on success/error/aborted |
| `last_activity` | DateTimeField null | heartbeat, drives "Last activity" column |

Storing per-provider connection details and options as JSON is right — the fields differ
per provider and a relational schema would be mostly nulls. The safeguard is that neither
field is free-form in practice: each is validated by a provider-specific DRF serializer on
write, so a malformed value fails at save time rather than five hours into a run.

Everything that is queried, filtered or displayed in a list — `provider`, `status`,
`last_activity`, counts — is a real column, not a JSON key.

`source_system` is the same idea applied to the duplicate check. It is derived from the
provider's connection details on save — for Kaltura,
`kaltura:{partner_id}@{normalised service_url host}` — so "have we already imported this
object from this system?" is an indexed column comparison rather than a query digging
through JSON. Two migrations pointing at the same Kaltura share a `source_system`; two
migrations pointing at different installations do not.

#### `connection` schema (Kaltura)

```json
{
  "service_url": "https://kaltura.example.edu",
  "partner_id": "342",
  "app_token_id": "0_abc123",
  "app_token": "<encrypted>"
}
```

`app_token` is encrypted with Fernet using a key derived from `settings.SECRET_KEY`.
The encrypt/decrypt helpers are two module-level functions in `models.py`, applied to the
provider's declared secret keys when `connection` is written and read. It is `write_only`
in the API and read back as a mask.

#### `options` schema (Kaltura)

| key | default | meaning |
| --- | --- | --- |
| `create_users` | `true` | create MediaCMS users from Kaltura users |
| `fallback_username` | `"admin"` | owner when `create_users` is false, or when the owner cannot be resolved |
| `create_categories` | `true` | create a category for each gallery or channel the imported media belong to |
| `import_captions` | `true` | caption assets → Subtitle |
| `preserve_views` | `true` | copy play counts |
| `preserve_publish_state` | `true` | derive public/unlisted/private |
| `skip_transcoding` | `true` | import flavors as encodings instead of re-encoding |
| `created_after` | `null` | optional filter, unix timestamp |
| `created_before` | `null` | optional filter, unix timestamp |
| `root_category` | `null` | optional: restrict to entries under a category |
| `max_items` | `null` | optional cap, for dry runs. Not exposed in the UI. |
| `restrict_to_users` | `false` | when on, fetch only media owned by `source_user_ids` |
| `source_user_ids` | `""` | comma separated Kaltura user ids, as stored on the entry |

The dry-run cap is what makes iterating on a 12,000-entry migration tolerable. It applies
to the media phase only — users and categories are cheap and are always imported in full,
since capping them would leave the capped media without owners or categories.

### MigrationRecord

| field | type | notes |
| --- | --- | --- |
| `service` | FK MigrationService, CASCADE | |
| `object_type` | CharField, choices | `media`, `user`, `category`, `caption` |
| `source_id` | CharField(255), db_index | Kaltura entry/user/category/asset id |
| `target_id` | IntegerField null | MediaCMS pk, retained even if the object is deleted |
| `media` | FK files.Media, SET_NULL, null | |
| `user` | FK users.User, SET_NULL, null | |
| `category` | FK files.Category, SET_NULL, null | |
| `status` | CharField, choices | `success`, `failed`, `skipped` |
| `log` | CharField(500) | one line: result or error |
| `created_at` | DateTimeField auto_now_add | |

Constraints and indexes:

- `unique_together = (service, object_type, source_id)`
- index on `(object_type, source_id)` for the cross-migration duplicate check
- index on `(service, status)` for the dashboard's errors-only filter

The record is generic rather than media-only because the mapping table in the dashboard
shows media, user and category rows alike, and because reversal and verification need all
three.

Keeping both `target_id` and a `SET_NULL` foreign key is deliberate: when the FK becomes
null while `target_id` still holds a value, that is exactly the signal that an object was
migrated and later deleted. That is what a verification pass reports on.

## 5. Kaltura client

The client half of `providers/kaltura.py`, built on `requests` (already a dependency). No
new package.

- All calls: `POST {service_url}/api_v3/service/{service}/action/{action}?format=1`,
  form-encoded, flattening nested filter/pager params into Kaltura's
  `filter:createdAtGreaterThanOrEqual` notation.
- Responses containing `"objectType": "KalturaAPIException"` raise `KalturaAPIError` with
  the Kaltura error code and message.
- Sessions come from an **app token**, not the administrator secret, which never has to
  leave the Kaltura account. `session.startWidgetSession` obtains an unprivileged session,
  then `appToken.startSession` exchanges it for a real one by presenting
  `hash(widget_ks + token)`. Kaltura does not reveal a token's `hashType` before a session
  exists, so the usable algorithms are tried in turn (SHA256 first) and the one that works
  is remembered; `app_token_hash_type` in the connection pins it. The client tracks issue
  time and transparently re-issues on expiry or on an `INVALID_KS` error, since a
  12,000-entry migration outlasts any single session.
- Retries with exponential backoff on connection errors, timeouts and 5xx. Kaltura API
  errors are not retried; they are real answers.

### Pagination and the resume key

Kaltura caps `pageIndex × pageSize` at 10,000 results. Any realistic migration exceeds
that, so `iter_entries()` cannot simply increment the page index.

Instead it pages by creation time:

1. `filter.orderBy = "+createdAt"`, `pager.pageSize = 500`.
2. `filter.createdAtGreaterThanOrEqual = <cursor.created_at>`.
3. After each page, set the cursor to the last entry's `createdAt`.
4. Because several entries can share a `createdAt`, the boundary is deduplicated by
   entry id — the cursor also carries `last_source_id`, and the `MigrationRecord`
   unique constraint makes any residual overlap a no-op.

This cursor is simultaneously the pagination mechanism and the resume state. It is stored
on `MigrationService.cursor` as `{"phase": "media", "created_at": 1683800000,
"last_source_id": "1_x8kq2p"}`.

### Connection check

`check_connection()` starts a session and issues three `pageSize=1` list calls, reading
`totalCount` from each:

- `media.list` → total entries
- `user.list` → total users
- `category.list` → total categories

Three cheap calls, and the media total is what the dashboard's progress bar needs up
front. The check is available at any time from both the create form and the detail page.

### Services used

| purpose | call |
| --- | --- |
| session | `session.startWidgetSession`, `appToken.startSession` |
| entries | `media.list`, `baseEntry.get` |
| flavors | `flavorAsset.getByEntryId`, `flavorAsset.getUrl` |
| captions | `captionAsset.list`, `captionAsset.getUrl` |
| users | `user.list`, `userRole.list` |
| categories | `category.list`, `categoryEntry.list`, `categoryUser.list` |

## 6. Task flow

`tasks.run_migration(service_id)` on the `long_tasks` queue.

Phases run in order and each is independently resumable:

1. **users** — only if `create_users` is true
2. **media** — captions and categories happen inline per entry

There is deliberately **no categories phase**. Categories are created as the media that
belong to them arrive, so a Kaltura gallery holding no media is never copied across.

### The orchestrator loop

```
run_migration(service_id):
    service = load and lock
    if service.status != "running": return
    page = provider.iter_<phase>(service.cursor, page_size=10)
    if page is empty:
        advance to next phase, or finish
    dispatch chord(
        group(migrate_item.s(service_id, phase, source_id) for source_id in page),
        run_migration.si(service_id)          # callback advances the cursor
    )
```

Page size is **10**. Media files can be large — a page of 50 could mean tens of gigabytes
in flight at once. Ten keeps memory, disk and network bounded and makes pause responsive.

The cursor advances **in the chord callback**, after the page has completed. A worker crash
mid-page therefore replays that page, and the unique constraint makes the already-done
items no-ops. One page is in flight at a time, so the `long_tasks` queue stays usable for
normal MediaCMS work, and no single task approaches `CELERY_SOFT_TIME_LIMIT` (2 hours).

### Pause, resume, abort

Every `migrate_item` task begins with a single cheap read:

```python
status = MigrationService.objects.filter(pk=service_id).values_list("status", flat=True).first()
if status != "running":
    return
```

- **Pause** sets `status="paused"`. In-flight items finish; the chord callback sees the
  status and does not re-queue. Pause takes effect within one page.
- **Resume** sets `status="running"` and dispatches `run_migration` again. It picks up from
  `cursor`.
- **Abort** sets `status="aborted"`. Identical mechanics, but the migration is considered
  finished; `ended_at` is set. The cursor is preserved and already-migrated content stays,
  so an aborted migration can still be restarted from where it stopped.

`last_activity` is touched by the orchestrator on every page, which drives the list page's
"Last activity" column and lets a stale `running` state be recognised.

### Skipping work that is already done

Before anything is downloaded, `migrate_item` checks the mapping table:

1. **Same migration**: a `MigrationRecord` for `(service, object_type, source_id)` with
   status `success` or `skipped` → return immediately. Status `failed` → retry it.
2. **Same source system, different migration**: a `MigrationRecord` for
   `(object_type, source_id)` belonging to any service with the same `source_system`,
   whose target still exists → record this one as `skipped` with a log line naming the
   earlier migration, and return.

   "Whose target still exists" means `target_id` is set *and* the nullable FK is not null.
   An object that was migrated and later deleted from MediaCMS is therefore re-imported
   rather than skipped, which is the behaviour an admin re-running a migration expects.
   Scoping on `source_system` rather than on `provider` alone means migrating two separate
   Kaltura installations never silently drops media over an entry-id coincidence.

Both checks happen before any bytes are fetched. Re-running a migration costs list calls
and nothing else. This is unconditional behaviour rather than an option: re-importing an
object that is already in MediaCMS is never the desired outcome.

Retrying failed items on resume falls out of the same rule — `failed` records are the only
ones that are re-attempted.

## 7. Importing one media entry

1. **Resolve the owner.** With `create_users` on, look up or create the MediaCMS user for
   `entry.userId`; otherwise use `options.fallback_username`. Existing users are matched by
   email first, then username, and are linked rather than duplicated.
2. **Download the source flavor** to a temp file, streamed, and attach it as
   `Media.media_file`. The source flavor is kept in addition to the transcoded flavors, so
   the pristine original survives the migration and `SHOW_ORIGINAL_MEDIA` / downloads
   behave as they would for a native upload.

   Kaltura installations often purge the source flavor. When no flavor has `isOriginal`,
   the highest-resolution ready flavor is used as `media_file` instead, and a log line
   records the substitution. That flavor still gets its own `Encoding` row in step 5, so
   the file is downloaded once and stored twice — as the original and as its profile's
   encoding.
3. **Create the Media.** Set `_do_not_transcode = True` when `skip_transcoding` is on, then
   save. The post_save signal runs `media_init()`, which does the ffprobe metadata pass,
   the thumbnail grab and the sprite generation, but not `encode()`.
4. **Second save** applies `state`, `views` and `add_date`. This is a separate save because
   `Media.save()` overrides `state` with `get_default_state()` only on creation.
5. **Flavors → encodings.** For each ready, non-source flavor, find the nearest **active**
   `EncodeProfile` (see §8). Then, per flavor:
   - create `Encoding(media, profile, status="pending")` — the `Encoding` post_save
     receiver does nothing for a pending non-chunk encoding;
   - download and attach `media_file`;
   - `Encoding.objects.filter(pk=...).update(status="success", progress=100, size=...)`,
     which bypasses signals entirely.
6. **HLS, once.** After all encodings are in place, call
   `media.post_encode_actions(encoding=<an h264 encoding>, action="add")` a single time.
   That sets `encoding_status`, saves, and triggers exactly one `create_hls` task.

   This step exists because `Encoding`'s post_save receiver calls `post_encode_actions` for
   every successful h264 encoding, which would otherwise launch HLS packaging once per
   flavor — five times per media. HLS itself is wanted: it is a remux rather than a
   transcode, and MediaCMS playback expects it, so migrated media should have it just like
   natively uploaded media.
7. **Captions** (if `import_captions`): download each caption asset, convert to WebVTT with
   `pysubs2`, `get_or_create` the `Language` from Kaltura's language code, create the
   `Subtitle`. Note that MediaCMS ships no seeded `Language` rows, so they are created on
   demand.
8. **Categories** from `categoryEntry.list`, **tags** from `entry.tags`.
9. **Record** the result in `MigrationRecord` — one row, one line of log.

Any exception is caught per entry: the record is written with status `failed` and a
one-line message, the error counter increments, and the migration continues.

### Non-video entries

`media.list` returns images and audio alongside video. Steps 5 and 6 are video-only:
`MediaCMS` sets `encoding_status = "success"` directly for images, and for audio during
`set_media_type()`, so neither needs encodings or HLS. Image and audio entries therefore
download their single asset, create the Media, and skip straight to captions, categories
and tags. Entry types MediaCMS does not support are recorded as `skipped` with the reason.

## 8. Mapping rules

### Flavors → EncodeProfile

Only **active** `EncodeProfile` rows are considered, resolved at runtime rather than
hard-coded — the shipped defaults are h264 at 144/240/360/480/720/1080 plus the gif
preview, but an installation may differ.

For each flavor:

- match on extension (`mp4`/`webm`) and codec;
- choose the profile minimising `|flavor_height − profile.resolution|`, preferring a
  profile at or below the flavor height on a tie;
- one flavor per profile — if two flavors map to the same profile, the closer match wins
  and the other is skipped with a log line;
- flavors that are not ready, or have no plausible profile, are skipped and logged.

If an entry ends up with no encodings at all — no transcoded flavors survive, or none map
to an active profile — the file used as `media_file` is itself attached as an encoding
against its nearest active profile. Without at least one successful mp4 or webm encoding,
`set_encoding_status()` leaves the media `pending` and `listable` stays false, which would
make the media invisible. This fallback guarantees every imported video is playable.

### Categories

Only KMS **galleries** and **channels** are imported, as a flat list. The Kaltura tree is
not reproduced as a tree, and a category is created only when a media that belongs to it
is imported.

- **Title**: the leaf name of the Kaltura category.
- **Description**: the full path with `>` replaced by `: ` — `Engineer: 1. Term: Electronics`.
  Everything up to and including the `galleries` or `channels` segment is dropped as KMS
  scaffolding, but only when that segment sits directly under a `site` segment — so a real
  top level category named "Channels" survives intact.
- **Collisions**: `Category.get_absolute_url()` builds `?c={title}`, so titles act as
  identifiers. On a title collision the parent name is appended:
  `Electronics (Engineering)`. Deterministic across reruns, and only fires when needed.
  Titles are truncated to the model's 100 characters.

**Which categories are in scope is decided without configuration.** An entry belongs to
every category it was published to, which on a KMS install includes housekeeping ones. The
rule is root agnostic, so an installation hosting several KMS instances side by side needs
no setting:

| Kaltura `fullName` | Imported? |
| --- | --- |
| contains `>site>galleries>` or `>site>channels>` | yes |
| any other path containing `>site` (the container itself, `nestedFilters`) | no |
| `private`, `unlisted`, `archive`, `playlists` directly under a root | no |
| anything else (a portal not using KMS at all) | yes |

A category whose `fullName` is missing is kept: the source did not say where it sits, and
guessing "out of scope" would silently drop a real one.

### Access control is deliberately not migrated

Kaltura's category privacy, `categoryUser` membership, owners and permission levels are
read but never written. Every imported category is a plain public MediaCMS category —
`is_rbac_category` is never set, no `RBACGroup` or `RBACMembership` is created, and
`categoryUser.list` is never called.

Category privacy is still *read*, because it is the only way to know whether a media
should be public: Kaltura has no public/private field on an entry. So privacy determines
the media's visibility and nothing else.

### Application-wide roles

| Kaltura role | MediaCMS |
| --- | --- |
| `viewerRole`, `privateOnlyRole` | plain user |
| `adminRole`, `unmoderatedAdminRole` | `advancedUser` |
| `partnerAdminRole` | `is_manager` |

`is_superuser` and `is_staff` are never granted by an import. Kaltura role names are
per-partner strings, so this table is the default value of a `KALTURA_ROLE_MAP` setting and
can be overridden per installation. Roles are applied through the existing
`User.set_role_from_mapping()`.

Roles are applied **only to accounts the migration creates**. An account matched to an
existing MediaCMS user keeps whatever permissions it already had — a migration has no
business elevating someone who merely shares an email address with a Kaltura admin.

### Publish state

Kaltura entries carry no direct public/private flag, so state is derived:

- in at least one category with privacy `ALL` → `public`
- in at least one category, all of them restricted → `unlisted`
- in no category → `private`
- `entry.displayInSearch == NONE` overrides to `unlisted`

Only applied when `preserve_publish_state` is on; otherwise MediaCMS defaults apply.

### Other fields

| Kaltura | MediaCMS |
| --- | --- |
| `entry.name` | `Media.title` (truncated to 100) |
| `entry.description` | `Media.description` |
| `entry.createdAt` | `Media.add_date` |
| `entry.plays` / `entry.views` | `Media.views` (if `preserve_views`) |
| `entry.tags` | `Media.tags` |
| `entry.userId` | `Media.user` |

## 9. API

Under `/api/v1/migrations/`, DRF, permission class requiring `is_superuser` — matching
`IS_MEDIACMS_ADMIN` in `files/context_processors.py`, which is what the frontend's
`user.is.admin` resolves to.

| method | path | purpose |
| --- | --- | --- |
| GET, POST | `/api/v1/migrations/` | list, create |
| GET, PUT, DELETE | `/api/v1/migrations/{id}/` | detail, update, delete |
| POST | `/api/v1/migrations/check_connection/` | validate an unsaved payload — makes the button work before the first save |
| POST | `/api/v1/migrations/{id}/check_connection/` | validate a saved migration |
| POST | `/api/v1/migrations/{id}/start/` | pending/paused/aborted → running |
| POST | `/api/v1/migrations/{id}/pause/` | running → paused |
| POST | `/api/v1/migrations/{id}/resume/` | paused → running |
| POST | `/api/v1/migrations/{id}/abort/` | running/paused → aborted |
| GET | `/api/v1/migrations/{id}/records/` | mapping table and log; filterable by type and status, paginated |
| GET | `/api/v1/migrations/{id}/progress/` | small polling payload: status, counts per type, last N log lines |

Secret values in `connection` are `write_only` and are returned masked. `progress/` is
deliberately separate from the detail endpoint so a 5-second poll stays cheap.

State transitions are validated server-side; an invalid transition returns 409 rather than
silently doing nothing.

## 10. UI

Three React pages, matching the mockups.

| page | route | contents |
| --- | --- | --- |
| `MigrationsPage` | `/migrations` | table of migrations: name/source, status badge, progress bar, last activity, per-row action (Pause / Resume / Edit), plus "New migration" |
| `MigrationEditPage` | `/migrations/new`, `/migrations/{id}/edit` | provider picker (Kaltura active; Panopto and YouTube shown with placeholder copy), connection fields, Test connection with inline result, import options, Save draft / Save and start |
| `MigrationDetailPage` | `/migrations/{id}` | status header with Pause and Abort, four stat tiles, progress by type, live log with auto-refresh and errors-only filter, ID mapping table |

Wiring:

- `frontend/config/mediacms.config.pages.js` — three new page entries
- `frontend/src/templates/config/core/url.config.js` — `migrations: './migrations.html'`
- `templates/config/core/url.html` — `{% if IS_MEDIACMS_ADMIN %}migrations: "/migrations",{% endif %}`
- `frontend/src/static/js/utils/contexts/HeaderContext.js` — a nav item in
  `popupBottomNavItems()` immediately after "MediaCMS administration", gated on
  `user.is.admin`
- Django views render `templates/cms/migration*.html`, mirroring the pattern of
  `files/views/pages.py:manage_media`, and redirect non-superusers to `/`

The frontend build is run by the maintainer (`make build-frontend`); the implementation
does not run it.

## 11. Changes to existing code

Kept to the minimum, five files:

1. **`files/models/media.py`** — `media_init()` honours a per-instance
   `self._do_not_transcode` flag alongside the global `settings.DO_NOT_TRANSCODE_VIDEO`.
   The global setting cannot be used because it would disable transcoding site-wide.

   Note that the other use of that setting, `encodings_info`, short-circuits to the
   original file *only when the global setting is on*. With the global setting off and the
   per-media flag on, `encodings_info` iterates real `Encoding` rows, so the imported
   Kaltura flavors are served by the player exactly like locally-produced encodings. No
   change is needed there.

2. **`users/models.py`** — the new-user admin notification in `post_user_create` honours
   `instance._skip_admin_notification`. Without this, importing 214 users sends 214 emails
   to the admin list.

3. **`cms/settings.py`** — add the app to `INSTALLED_APPS`, plus `KALTURA_ROLE_MAP` and
   `MIGRATION_PAGE_SIZE = 10`, `MIGRATION_DOWNLOAD_TIMEOUT`, `MIGRATION_MAX_RETRIES`.

4. **`cms/urls.py`** — include `migrationservice.urls`.

5. **Frontend** — the three wiring points listed in §10.

Django migrations are generated with `makemigrations`. None are hand-written or faked.

## 12. Testing

| area | approach |
| --- | --- |
| mapping functions | direct unit tests — publish state derivation, role map, category title collisions, flavor→profile matching. Pure functions, no DB, no network. |
| Kaltura client | recorded JSON fixtures in `tests/fixtures/`, with the client's `_post` patched. Covers cursor pagination across a page boundary, tie handling on `createdAt`, KS re-issue on `INVALID_KS`, and error raising. |
| orchestration | `CELERY_TASK_ALWAYS_EAGER` with a fake provider: pause mid-run stops within a page, resume continues from the cursor, rerun is idempotent, a failed item is retried while successful ones are skipped. |
| media import | a fake provider serving a small fixture video: media created without transcoding, encodings attached to active profiles, exactly one `create_hls` triggered, captions converted, record written. |
| API | permissions (non-superuser → 403), secret masking on read, invalid state transitions → 409. |

Tests live in `migrationservice/tests/` and run under the existing pytest configuration.

## 13. Open items for later versions

- Panopto and YouTube provider implementations.
- A revert action, building on the mapping table.
- A verification pass reporting records whose target object no longer exists.
- Custom thumbnails, chapters, playlists and comments.
- A home for plain-text transcripts.
