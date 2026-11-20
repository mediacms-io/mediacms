# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

MediaCMS is an open source video and media CMS built with **Django + React**, exposing a REST API. It supports video/audio/image/PDF media, automatic transcoding (multiple resolutions/profiles, HLS), Whisper-based auto-transcription, RBAC, SAML/LTI integrations, and more. See `README.md` for the full feature list.

## Tech Stack

- **Backend**: Python 3.13 (Dockerfile), Django 5.2, Django REST Framework, Celery (task queue), Redis (cache/broker), PostgreSQL 17.2 (dev compose; psycopg3), django-allauth (auth)
- **Frontend**: React 19 + TypeScript/JavaScript, Webpack, SCSS; Node 24 (dev compose `frontend` service)
- **Packaging**: Docker (supervisord manages gunicorn/nginx/celery inside the image; migrations run at startup via `prestart.sh`, not under supervisord)

## Repository Layout

| Path | Purpose |
|---|---|
| `cms/` | Django project: `settings.py` (all portal configuration lives here), `urls.py`, `celery.py`, `dev_settings.py`, `test_settings.py` |
| `files/` | Main Django app: `models/` (media, category, comment, encoding, playlist, subtitle...), `views/`, `serializers.py`, `forms.py`, `tasks.py` (Celery tasks), `management/` (custom management commands), `frontend_translations/` |
| `frontend/` | React app; entry points in `src/entries/<name>.js` are built to `static/js/<name>.js` and loaded by matching Django templates. Pages in `src/static/js/pages/`, components in `src/static/js/components/` |
| `templates/` | Django templates (e.g. `templates/cms/`, `templates/config/installation/features.html`) |
| `static/` | Collected static files served by the app (js/css bundles built from `frontend/dist/`) |
| `tests/` | Pytest test suite (mirrors app structure: `api/`, `models/`, `rbac/`, `saml/`, ...) |
| `frontend/tests/` | Frontend Jest tests |
| `deploy/docker/` | Docker entrypoints, `local_settings.py` used by docker-compose installs |
| `docker-compose-dev.yaml` | Development environment (see below) |
| `docs/` | Admin docs (`admins_docs.md`), developer docs (`developers_docs.md`), `dev_exp.md`, transcoding, migrations, SAML setup guides |
| `actions/`, `admin_customizations/` | Additional Django apps |
| `cli-tool/` | CLI tooling |

## Development Environment

Development is Docker-based. From the repo root:

```bash
docker compose -f docker-compose-dev.yaml build
docker compose -f docker-compose-dev.yaml up
```

This starts: Django dev server (`runserver`, auto-reloads) on **http://localhost:80**, webpack dev server (hot reload) on **http://localhost:8088**, PostgreSQL 17, Redis, and a Celery worker. Default credentials: `admin`/`admin`.

- The webpack dev server on port 8088 proxies all pages/API requests to Django (`MEDIACMS_BACKEND=http://web` in `frontend/.env`), so you see real Django pages with live frontend bundles.
- Backend Python changes auto-reload; if Django breaks (e.g. syntax error), restart with `docker compose -f docker-compose-dev.yaml restart web`.
- **Frontend changes are only visible on port 80 after building**: run `make build-frontend` (or `docker compose -f docker-compose-dev.yaml exec -T frontend npm run dist` then `cp -r frontend/dist/static/* static/`).
- Shared styles go in `static/css/_commons.css`; per-entry styles in `static/css/<name>.css`.

## Common Commands

Makefile targets (require the dev compose stack to be running):

```bash
make test                 # backend pytest, parallelized
make test-coverage        # backend pytest with coverage
make test-frontend        # frontend Jest tests (CI mode)
make test-frontend-coverage
make build-frontend       # build frontend bundles + copy to static/ + restart web
make admin-shell          # shell into the web container
```

Direct equivalents:

```bash
# Backend tests — cms/test_settings.py sets TESTING=True and eager Celery
# automatically; CI and the docs still pass it explicitly (harmless, keep doing it)
docker compose -f docker-compose-dev.yaml exec --env TESTING=True -T web pytest

# Single test file
docker compose -f docker-compose-dev.yaml exec --env TESTING=True -T web pytest tests/test_fixtures.py

# Frontend tests
docker compose -f docker-compose-dev.yaml exec -T frontend npm run test -- --ci
```

All `manage.py` commands run inside the web container (`docker compose -f docker-compose-dev.yaml exec -T web ...`) — running them on the host fails.

## Code Style & Linting

- **Python**: `black` (formatting), `isort` (black profile), `flake8` — enforced via pre-commit.
- Before committing: run `pre-commit run --all` and fix everything. Install the hook once with `pre-commit install`.
- **Frontend**: a `.prettierrc` exists but is not enforced — pre-commit and CI run Python hooks only.

## Commit Conventions

This repo uses **semantic-release with Conventional Commits** (`.releaserc.json`). Commit messages must use types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `depr`. Releases are automated from `main` — do not manually bump versions or edit `CHANGELOG.md`.

## Pull requests

- PR titles follow the commit conventions above (enforced by CI).
- The PR template's AI assistance disclosure and attestation are the human submitter's statements: fill them in yourself — never let an AI agent tick them on your behalf.

## Testing Notes

- `pytest.ini` uses `cms/test_settings.py` as the Django settings module.
- `conftest.py` blocks network access to non-local hosts during tests and cleans up temp media dirs — do not make tests hit external services.
- Coverage config in `.coveragerc` (migrations, tests, frontend, etc. are omitted).

## Key Domain Knowledge

### Configuration pattern

All portal configuration is in `cms/settings.py`. Overrides go in `cms/local_settings.py` (never edit `settings.py` for a deployment). **Docker installs:** the container entrypoint (`deploy/docker/entrypoint.sh`) copies `deploy/docker/local_settings.py` over `cms/local_settings.py` at every startup — edit the `deploy/docker/` copy (or pass environment variables), or your changes will be lost on restart. **Any settings change requires a restart** — dev stack: `docker compose -f docker-compose-dev.yaml restart web celery_worker` (no `celery_beat` service in dev); production compose: `docker compose restart web celery_worker celery_beat`. Notable settings:

- `PORTAL_WORKFLOW`: `public` / `private` / `unlisted` — what happens to newly uploaded media
- `CAN_ADD_MEDIA`, `CAN_COMMENT`: `"all"` / `"email_verified"` / `"advancedUser"`
- `MEDIA_IS_REVIEWED`: set `False` to require editor review before media appears in listings
- `USE_RBAC`, `USE_SAML`, `USE_IDENTITY_PROVIDERS`, `USE_WHISPER_TRANSCRIBE`, `DO_NOT_TRANSCODE_VIDEO`
- `ALLOWED_MEDIA_UPLOAD_TYPES` (default `["video", "audio", "image", "pdf"]`), `NUMBER_OF_MEDIA_USER_CAN_UPLOAD`, `UPLOAD_MAX_SIZE`

### Video transcoding pipeline (Encoding objects)

Originals are uploaded to the app server as FileFields. Videos longer than `CHUNKIZE_VIDEO_DURATION` (default: 5 minutes) are split into chunks; one `Encoding` object is created per chunk per enabled `EncodeProfile`. Celery workers transcode chunks; when all chunks of a resolution succeed they are concatenated into one `Encoding` object (`chunk=False`, `status='success'`) which is what gets served/downloaded. An HLS version (`.ts` segments) is then generated. The `Encoding` model doubles as in-progress tracking (`chunk=True`, `status='pending'`) and final output storage. Encode profiles (resolutions 144p–1080p, h264/h265/vp9) are managed via Django admin at `/admin/files/encodeprofile/`. Workers must share the same filesystem (localhost or NFS/EFS).

### Translations — MANDATORY workflow

**No PR will be accepted that skips this.** When adding a translatable string:

1. Mark it translatable in code (Django templates: see `templates/cms/about.html`; React: see how `translateString` is used in `frontend/`).
2. Add the string to `files/frontend_translations/en.py` **first**.
3. Run `docker compose -f docker-compose-dev.yaml exec -T web python manage.py process_translations` to populate the string across all language files (all `manage.py` commands run inside the web container).
4. Then translate into your language in `files/frontend_translations/<lang>.py`.

Django template changes don't need a frontend rebuild; frontend string changes do (`make build-frontend`).

### API

REST API is documented with Swagger at `/swagger/` (e.g. https://demo.mediacms.io/swagger/). Auth works via session or basic auth; uploads POST to `/api/v1/media` with `media_file`, `title`, `description`.

### Frontend build serving

Django templates load bundles from `static/js/<name>.js`. After `npm run dist`, bundles land in `frontend/dist/static/` and must be copied to `static/` (the `make build-frontend` target does build + copy + restart).

## Gotchas

- pytest runs via `cms/test_settings.py` (`pytest.ini`), which sets `TESTING=True` and eager Celery automatically — never run tests against non-test settings (Celery tasks would hit a broker that isn't running).
- The frontend dev server (8088) and the "real" app (80) can look out of sync — the real app only shows built bundles.
- Whisper transcription only works with the `mediacms/mediacms:full` image or `docker-compose.full.yaml`.
- PostgreSQL data dirs are incompatible across major versions — check the admins docs (section 3) before a major upgrade.
- The repo root `package.json` version is managed by semantic-release — don't edit it manually.

## Useful Docs

- `docs/developers_docs.md` — architecture, contributing, Docker tips, testing, transcoding
- `docs/admins_docs.md` — installation, deployment options, full settings reference, RBAC/SAML setup
- `docs/dev_exp.md` — local Docker development walkthrough
- `docs/transcoding.md`, `docs/media_permissions.md`, `docs/kaltura_migration.md`, `docs/youtube_migration.md`, `docs/panopto_migration.md`, `docs/saml_entraid_setup.md`
- `CODE_OF_CONDUCT.md` — required reading before contributing

The docs files above are large — load only the section you need (grep for the heading) rather than the whole file.
