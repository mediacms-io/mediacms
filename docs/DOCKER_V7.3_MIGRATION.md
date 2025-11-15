# MediaCMS 7.3 Docker Architecture Migration Guide

## Overview

MediaCMS 7.3 introduces a modernized Docker architecture that removes supervisord and implements Docker best practices with one process per container.

## What Changed

### Old Architecture (pre-7.3)
- Single multi-purpose image with supervisord
- Environment variables (`ENABLE_UWSGI`, `ENABLE_NGINX`, etc.) to control services
- All services bundled in `deploy/docker/` folder
- File mounts required for all deployments

### New Architecture (7.3+)
- **Dedicated images** for each service:
  - `mediacms/mediacms:7.3` - Django/uWSGI application
  - `mediacms/mediacms-worker:7.3` - Celery workers
  - `mediacms/mediacms-worker:7.3-full` - Celery workers with extra codecs
  - `mediacms/mediacms-nginx:7.3` - Nginx web server
- **No supervisord** - Native Docker process management
- **Separated services**:
  - `migrations` - Runs database migrations on every startup
  - `nginx` - Serves static/media files and proxies to Django
  - `web` - Django application (uWSGI)
  - `celery_short` - Short-running tasks (thumbnails, etc.)
  - `celery_long` - Long-running tasks (video encoding)
  - `celery_beat` - Task scheduler
- **No ENABLE_* environment variables**
- **Config centralized** in `config/` directory
- **File mounts only for development** (`docker-compose-dev.yaml`)

## Directory Structure

```
config/
  ├── nginx/
  │   ├── nginx.conf              # Main nginx config
  │   ├── site.conf               # Virtual host config
  │   └── uwsgi_params            # uWSGI parameters
  ├── nginx-proxy/
  │   └── client_max_body_size.conf  # For production HTTPS proxy
  ├── uwsgi/
  │   └── uwsgi.ini               # uWSGI configuration
  └── imagemagick/
      └── policy.xml              # ImageMagick policy

scripts/
  ├── entrypoint-web.sh           # Web container entrypoint
  ├── entrypoint-worker.sh        # Worker container entrypoint
  └── run-migrations.sh           # Migration script

Dockerfile.new                    # Main Dockerfile (base, web, worker, worker-full)
Dockerfile.nginx                  # Nginx Dockerfile
docker-compose.yaml               # Production deployment
docker-compose-cert.yaml          # Production with HTTPS
docker-compose-dev.yaml           # Development with file mounts
```

## Migration Steps

### For Existing Production Systems

#### Step 1: Backup your data
```bash
# Backup database
docker exec mediacms_db_1 pg_dump -U mediacms mediacms > backup.sql

# Backup media files
cp -r media_files media_files.backup
```

#### Step 2: Update configuration location
```bash
# The client_max_body_size.conf has moved
# No action needed if you haven't customized it
```

#### Step 3: Pull latest images
```bash
docker pull mediacms/mediacms:7.3
docker pull mediacms/mediacms-worker:7.3
docker pull mediacms/mediacms-nginx:7.3
```

#### Step 4: Update docker-compose file
If using **docker-compose.yaml**:
- No changes needed, just use the new version

If using **docker-compose-cert.yaml** (HTTPS):
- Update `VIRTUAL_HOST`, `LETSENCRYPT_HOST`, and `LETSENCRYPT_EMAIL` in the nginx service
- Update the path to client_max_body_size.conf:
  ```yaml
  - ./config/nginx-proxy/client_max_body_size.conf:/etc/nginx/conf.d/client_max_body_size.conf:ro
  ```

#### Step 5: Restart services
```bash
docker compose down
docker compose up -d
```

### For Development Systems

Development now requires the `-dev` compose file:

```bash
# Old way (no longer works)
docker compose up

# New way (development)
docker compose -f docker-compose-dev.yaml up
```

## Deployment Options

### Standard Deployment (HTTP)

**File**: `docker-compose.yaml`

**Command**:
```bash
docker compose up -d
```

**Features**:
- Self-contained images (no file mounts)
- Nginx serves on port 80
- Separate containers for each service
- Named volumes for persistence

**Architecture**:
```
Client → nginx:80 → web:9000 (uWSGI)
                 ↓
            static_files (volume)
            media_files (volume)
```

### Production Deployment (HTTPS with Let's Encrypt)

**File**: `docker-compose-cert.yaml`

**Prerequisites**:
1. Domain name pointing to your server
2. Ports 80 and 443 open

**Setup**:
```bash
# 1. Edit docker-compose-cert.yaml
# Update these values in the nginx service:
#   VIRTUAL_HOST: 'your-domain.com'
#   LETSENCRYPT_HOST: 'your-domain.com'
#   LETSENCRYPT_EMAIL: 'your-email@example.com'

# 2. Start services
docker compose -f docker-compose-cert.yaml up -d

# 3. Check logs
docker compose -f docker-compose-cert.yaml logs -f nginx-proxy acme-companion
```

**Features**:
- Automatic HTTPS via Let's Encrypt
- Certificate auto-renewal
- Reverse proxy handles SSL termination

**Architecture**:
```
Client → nginx-proxy:443 (HTTPS) → nginx:80 → web:9000 (uWSGI)
```

### Development Deployment

**File**: `docker-compose-dev.yaml`

**Command**:
```bash
docker compose -f docker-compose-dev.yaml up
```

**Features**:
- Source code mounted for live editing
- Django debug mode enabled
- Django's `runserver` instead of uWSGI
- Frontend hot-reload on port 8088
- No nginx (direct Django access on port 80)

**Ports**:
- `80` - Django API
- `8088` - Frontend dev server

## Configuration

### Environment Variables

All configuration is done via environment variables or `cms/local_settings.py`.

**Key Variables**:
- `FRONTEND_HOST` - Your domain (e.g., `https://mediacms.example.com`)
- `PORTAL_NAME` - Your portal name
- `SECRET_KEY` - Django secret key
- `POSTGRES_*` - Database credentials
- `REDIS_LOCATION` - Redis connection string
- `DEBUG` - Enable debug mode (development only)

**Setting variables**:

Option 1: In docker-compose file:
```yaml
environment:
  FRONTEND_HOST: 'https://mediacms.example.com'
  PORTAL_NAME: 'My MediaCMS'
```

Option 2: Using .env file (recommended):
```bash
# Create .env file
cat > .env << EOF
FRONTEND_HOST=https://mediacms.example.com
PORTAL_NAME=My MediaCMS
SECRET_KEY=your-secret-key-here
EOF
```

### Customizing Settings

For advanced customization, you can build a custom image:

```dockerfile
# Dockerfile.custom
FROM mediacms/mediacms:7.3
COPY my_local_settings.py /home/mediacms.io/mediacms/cms/local_settings.py
```

## Celery Workers

### Standard Workers

By default, `celery_long` uses the standard image:
```yaml
celery_long:
  image: mediacms/mediacms-worker:7.3
```

### Full Workers (Extra Codecs)

To enable extra codecs for better transcoding (including Whisper for subtitles):

**Edit docker-compose file**:
```yaml
celery_long:
  image: mediacms/mediacms-worker:7.3-full  # Changed from :7.3
```

**Then restart**:
```bash
docker compose up -d celery_long
```

### Scaling Workers

You can scale workers independently:

```bash
# Scale short task workers
docker compose up -d --scale celery_short=3

# Scale long task workers
docker compose up -d --scale celery_long=2
```

## Troubleshooting

### Migrations not running
```bash
# Check migrations container logs
docker compose logs migrations

# Manually run migrations
docker compose run --rm migrations
```

### Static files not loading
```bash
# Ensure migrations completed (it runs collectstatic)
docker compose logs migrations

# Check nginx can access volumes
docker compose exec nginx ls -la /var/www/static
```

### Permission issues
```bash
# Check volume ownership
docker compose exec web ls -la /home/mediacms.io/mediacms/media_files

# If needed, rebuild images
docker compose build --no-cache
```

### Celery workers not processing tasks
```bash
# Check worker logs
docker compose logs celery_short celery_long

# Check Redis connection
docker compose exec redis redis-cli ping

# Restart workers
docker compose restart celery_short celery_long celery_beat
```

## Removed Components

The following are **no longer used** in 7.3:

- ❌ `deploy/docker/supervisord/` - Supervisord configs
- ❌ `deploy/docker/start.sh` - Start script
- ❌ `deploy/docker/entrypoint.sh` - Old entrypoint
- ❌ Environment variables: `ENABLE_UWSGI`, `ENABLE_NGINX`, `ENABLE_CELERY_BEAT`, `ENABLE_CELERY_SHORT`, `ENABLE_CELERY_LONG`, `ENABLE_MIGRATIONS`

**These are still available but moved**:
- ✅ `config/nginx/` - Nginx configs (moved from `deploy/docker/`)
- ✅ `config/uwsgi/` - uWSGI config (moved from `deploy/docker/`)
- ✅ `config/nginx-proxy/` - Reverse proxy config (moved from `deploy/docker/reverse_proxy/`)

## Persistent Volumes

MediaCMS 7.3 uses Docker named volumes for data persistence:

- **`media_files`** - All uploaded media (videos, images, thumbnails, HLS streams)
  - Mounted on: migrations, web, nginx, celery_beat, celery_short, celery_long
  - Persists across container restarts, updates, and image removals

- **`logs`** - Application and nginx logs
  - Mounted on: migrations, web, nginx, celery_beat, celery_short, celery_long
  - Nginx logs: `/var/log/mediacms/nginx.access.log`, `/var/log/mediacms/nginx.error.log`
  - Django/Celery logs: `/home/mediacms.io/mediacms/logs/`
  - Persists across container restarts, updates, and image removals

- **`static_files`** - Django static files (CSS, JS, images)
  - Mounted on: migrations, web, nginx
  - Regenerated during migrations via `collectstatic`

- **`postgres_data`** - PostgreSQL database
  - Mounted on: db
  - Persists across container restarts, updates, and image removals

**Important**: Use `docker compose down -v` to remove volumes (⚠️ causes data loss!)

## Benefits of New Architecture

1. **Better resource management** - Scale services independently
2. **Easier debugging** - Clear separation of concerns
3. **Faster restarts** - Restart only affected services
4. **Production-ready** - No file mounts, immutable images
5. **Standard Docker practices** - One process per container
6. **Clearer logs** - Each service has isolated logs, persistent storage
7. **Better health checks** - Per-service monitoring
8. **Data persistence** - media_files and logs survive all container operations

## Support

For issues or questions:
- GitHub Issues: https://github.com/mediacms-io/mediacms/issues
- Documentation: https://docs.mediacms.io
