# MediaCMS Docker Restructure Summary

## Overview

This document summarizes the complete Docker architecture restructure for MediaCMS 7.3, eliminating supervisord and implementing modern Docker best practices.

## What Was Created

### New Files

#### Dockerfiles
- `Dockerfile` - Multi-stage Dockerfile with targets (replaced old Dockerfile):
  - `build-image` - FFmpeg and Bento4 builder
  - `base` - Python/Django base image
  - `web` - uWSGI web server
  - `worker` - Celery worker (standard)
  - `worker-full` - Celery worker with extra codecs

- `Dockerfile.nginx` - Vanilla nginx with MediaCMS configs baked in

#### Docker Compose Files
- `docker-compose.yaml` - Production deployment (no file mounts) - REPLACED
- `docker-compose-cert.yaml` - Production with HTTPS (Let's Encrypt) - REPLACED
- `docker-compose-dev.yaml` - Development with file mounts and hot reload - REPLACED

#### Scripts
- `scripts/entrypoint-web.sh` - Web container entrypoint
- `scripts/entrypoint-worker.sh` - Worker container entrypoint
- `scripts/run-migrations.sh` - Migration runner script

#### Configuration
- `config/nginx/nginx.conf` - Main nginx config (from deploy/docker/)
- `config/nginx/site.conf` - Virtual host config (from deploy/docker/nginx_http_only.conf)
- `config/nginx/uwsgi_params` - uWSGI params (from deploy/docker/)
- `config/nginx-proxy/client_max_body_size.conf` - For nginx-proxy (from deploy/docker/reverse_proxy/)
- `config/uwsgi/uwsgi.ini` - uWSGI configuration (from deploy/docker/)
- `config/imagemagick/policy.xml` - ImageMagick policy (from deploy/docker/)

#### Documentation
- `docs/DOCKER_V7.3_MIGRATION.md` - Complete migration guide
- Updated `docs/admins_docs.md` - Sections 4 and 5

## Architecture Changes

### Before (Old Architecture)
```
Single Container (supervisord managing multiple processes)
├── nginx (port 80)
├── uwsgi (port 9000)
├── celery beat
├── celery short workers
└── celery long workers

Controlled by ENABLE_* environment variables
```

### After (New Architecture)
```
Dedicated Containers (one process per container)
├── nginx (port 80) → web:9000
├── web (uwsgi on port 9000)
├── celery_beat
├── celery_short (scalable)
├── celery_long (scalable, optional :full image)
├── migrations (runs on startup)
├── db (PostgreSQL)
└── redis

Volumes:
- static_files (nginx ← web)
- media_files (nginx ← web, workers)
- postgres_data
```

## Key Improvements

### 1. **Removed Components**
- ❌ supervisord and all configs in `deploy/docker/supervisord/`
- ❌ `deploy/docker/start.sh`
- ❌ `deploy/docker/entrypoint.sh`
- ❌ All `ENABLE_*` environment variables

### 2. **Separated Services**
- Nginx runs in its own container
- Django/uWSGI in dedicated web container
- Celery workers split by task duration
- Migrations run automatically on every startup

### 3. **Production Ready**
- No file mounts in production (immutable images)
- Named volumes for data persistence
- Proper health checks
- Individual service scaling

### 4. **Development Friendly**
- Separate `-dev` compose file with file mounts
- Django debug mode
- Frontend hot reload
- Live code editing

## Images to Build

For production, these images need to be built and pushed to Docker Hub:

```bash
# Build base and web image
docker build --target web -t mediacms/mediacms:7.3 .

# Build worker image
docker build --target worker -t mediacms/mediacms-worker:7.3 .

# Build worker-full image
docker build --target worker-full -t mediacms/mediacms-worker:7.3-full .

# Build nginx image
docker build -f Dockerfile.nginx -t mediacms/mediacms-nginx:7.3 .
```

## Deployment Options

### 1. Development
```bash
docker compose -f docker-compose-dev.yaml up
```
- File mounts for live editing
- Django runserver
- Frontend dev server

### 2. Production (HTTP)
```bash
# Rename .new files first
mv docker-compose.yaml.new docker-compose.yaml

docker compose up -d
```
- Immutable images
- No file mounts
- Port 80

### 3. Production (HTTPS)
```bash
# Rename .new files first
mv docker-compose-cert.yaml.new docker-compose-cert.yaml

# Edit and set your domain/email
docker compose -f docker-compose-cert.yaml up -d
```
- Automatic Let's Encrypt certificates
- Auto-renewal

## Migration Path for Existing Systems

### For Production Systems Currently Running

1. **Backup first**
   ```bash
   docker exec <db_container> pg_dump -U mediacms mediacms > backup.sql
   ```

2. **Update compose file**
   - Replace old docker-compose files with new ones
   - Update domain settings in cert file if using HTTPS

3. **Pull new images**
   ```bash
   docker pull mediacms/mediacms:7.3
   docker pull mediacms/mediacms-worker:7.3
   docker pull mediacms/mediacms-nginx:7.3
   ```

4. **Restart**
   ```bash
   docker compose down
   docker compose up -d
   ```

### Breaking Changes

1. **No more ENABLE_* variables** - Remove from any custom configs
2. **deploy/docker/local_settings.py** - Now use environment variables or custom image
3. **Service names changed**:
   - `celery_worker` → `celery_short` + `celery_long`
   - Added `nginx` service

## Testing Checklist

Before deploying to production, test:

- [ ] Migrations run successfully
- [ ] Static files served correctly
- [ ] Media files served correctly
- [ ] Django admin accessible
- [ ] Video upload works
- [ ] Video transcoding works (celery_long)
- [ ] Thumbnail generation works (celery_short)
- [ ] HTTPS redirects work (if using cert file)
- [ ] Database persistence across restarts
- [ ] Media files persistence across restarts

## Configuration Examples

### Use Full Worker Image
```yaml
celery_long:
  image: mediacms/mediacms-worker:7.3-full
```

### Set Custom Domain
```yaml
environment:
  FRONTEND_HOST: 'https://videos.example.com'
  PORTAL_NAME: 'My Video Portal'
```

### Scale Workers
```bash
docker compose up -d --scale celery_short=3 --scale celery_long=2
```

## Files to Review Before Finalizing

1. **Dockerfile** - Review Python/Django/uWSGI configuration
2. **config/nginx/site.conf** - Review nginx paths and proxy settings
3. **docker-compose.yaml** - Review volume mounts and service dependencies
4. **scripts/run-migrations.sh** - Review migration logic

## Next Steps

To finalize this restructure:

1. **Test locally** with docker-compose-dev.yaml
2. **Build images** and push to Docker Hub
3. **Update CI/CD** to build new images
4. **Test in staging environment**
5. **Create release notes** referencing migration guide

## Backup

Old Docker files have been backed up to `.docker-backup/` directory.

## Rollback Plan

If issues arise, rollback by:
1. Reverting to old docker-compose files
2. Using old image tags
3. Restoring database from backup if needed

Old files are preserved in `.docker-backup/` directory.

## Support

- Migration Guide: `docs/DOCKER_V7.3_MIGRATION.md`
- Admin Docs: `docs/admins_docs.md` (updated sections 4, 5)
- Issues: https://github.com/mediacms-io/mediacms/issues
