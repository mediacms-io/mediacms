# MediaCMS Docker Restructure Summary - Version 7.3

## Overview

MediaCMS 7.3 introduces a complete Docker architecture restructure, moving from a monolithic supervisord-based setup to modern microservices with proper separation of concerns.

**⚠️ BREAKING CHANGES** - See [`UPGRADE_TO_7.3.md`](./UPGRADE_TO_7.3.md) for migration guide.

## Architecture Comparison

### Before (7.x) - Monolithic
```
┌─────────────────────────────────────┐
│   Single Container                  │
│   ┌──────────┐                     │
│   │Supervisor│                     │
│   └────┬─────┘                     │
│        ├─── nginx (port 80)        │
│        ├─── uwsgi (Django)         │
│        ├─── celery beat            │
│        ├─── celery workers         │
│        └─── migrations             │
│                                     │
│  Volumes: ./ mounted to container  │
└─────────────────────────────────────┘
```

### After (7.3) - Microservices
```
┌────────┐  ┌─────┐  ┌───────────┐  ┌──────────┐
│ nginx  │→ │ web │  │celery_beat│  │  celery  │
│        │  │uwsgi│  │           │  │ workers  │
└────────┘  └─────┘  └───────────┘  └──────────┘
                │
        ┌───────┴────────┐
        │  db   │  redis │
        └───────┴────────┘

Volumes: Named volumes + custom/ bind mount
```

## What Changed

### 1. Container Services

| Component | Before (7.x) | After (7.3) |
|-----------|-------------|-------------|
| **nginx** | Inside main container | Separate container |
| **Django/uWSGI** | Inside main container | Dedicated `web` container |
| **Celery Beat** | Inside main container | Dedicated container |
| **Celery Workers** | Inside main container | Separate containers (short/long) |
| **Migrations** | Via environment flag | Init container (runs once) |

### 2. Volume Strategy

| Data | Before (7.x) | After (7.3) |
|------|-------------|-------------|
| **Application code** | Bind mount `./` | **Built into image** |
| **Media files** | `./media_files` | **Named volume** `media_files` |
| **Static files** | `./static` | **Built into image** (collectstatic at build) |
| **Logs** | `./logs` | **Named volume** `logs` |
| **PostgreSQL** | `../postgres_data` | **Named volume** `postgres_data` |
| **Custom config** | `cms/local_settings.py` | **Bind mount** `./custom/` |

### 3. Removed Components

- ❌ supervisord and all supervisord configs
- ❌ docker-entrypoint.sh (permission fixing script)
- ❌ `ENABLE_*` environment variables
- ❌ Runtime collectstatic
- ❌ nginx from base image

### 4. New Components

- ✅ `custom/` directory for user customizations
- ✅ Multi-stage Dockerfile (base, web, worker, worker-full)
- ✅ Separate nginx image (`Dockerfile.nginx`)
- ✅ Build-time collectstatic
- ✅ USER www-data (non-root containers)
- ✅ Health checks for all services
- ✅ Makefile with common tasks

## Key Improvements

### Security
- ✅ Containers run as `www-data` (UID 33), not root
- ✅ Read-only mounts where possible
- ✅ Smaller attack surface per container
- ✅ No privilege escalation needed

### Performance
- ✅ Named volumes have better I/O than bind mounts
- ✅ Static files built into image (no runtime collection)
- ✅ Faster container startups
- ✅ No chown on millions of files at startup

### Scalability
- ✅ Scale web and workers independently
- ✅ Ready for load balancing
- ✅ Can use Docker Swarm or Kubernetes
- ✅ Horizontal scaling: `docker compose scale celery_short=3`

### Maintainability
- ✅ One process per container (proper separation)
- ✅ Clear service dependencies
- ✅ Standard Docker patterns
- ✅ Easier debugging (service-specific logs)
- ✅ Immutable images

### Developer Experience
- ✅ Separate dev compose with hot reload
- ✅ `custom/` directory for all customizations
- ✅ Clear documentation and examples
- ✅ Makefile targets for common tasks

## New Customization System

### The `custom/` Directory

All user customizations now go in a dedicated directory:

```
custom/
├── README.md                    # Full documentation
├── local_settings.py.example    # Template file
├── local_settings.py            # Your Django settings (gitignored)
└── static/
    ├── images/                  # Custom logos (gitignored)
    │   └── logo_dark.png
    └── css/                     # Custom CSS (gitignored)
        └── custom.css
```

**Benefits:**
- Clear separation from core code
- Works out-of-box (empty directory is fine)
- Gitignored customizations
- Well documented with examples

See [`custom/README.md`](./custom/README.md) for usage guide.

## Docker Images

### Images to Build

```bash
# Web image (Django + uWSGI)
docker build --target web -t mediacms/mediacms:7.3 .

# Worker image (Celery)
docker build --target worker -t mediacms/mediacms-worker:7.3 .

# Worker-full image (Celery with extra codecs)
docker build --target worker-full -t mediacms/mediacms-worker:7.3-full .

# Nginx image
docker build -f Dockerfile.nginx -t mediacms/mediacms-nginx:7.3 .
```

### Image Sizes

| Image | Approximate Size |
|-------|-----------------|
| mediacms:7.3 | ~800MB |
| mediacms-worker:7.3 | ~800MB |
| mediacms-worker:7.3-full | ~1.2GB |
| mediacms-nginx:7.3 | ~50MB |

## Deployment Scenarios

### 1. Development

```bash
docker compose -f docker-compose-dev.yaml up
```

**Features:**
- File mounts for live editing
- Django runserver with DEBUG=True
- Frontend hot reload
- Immediate code changes

### 2. Production (HTTP)

```bash
docker compose up -d
```

**Features:**
- Immutable images
- Named volumes for data
- Production-ready
- Port 80

### 3. Production (HTTPS with Let's Encrypt)

```bash
docker compose -f docker-compose.yaml -f docker-compose-cert.yaml up -d
```

**Features:**
- Automatic SSL certificates
- Auto-renewal
- nginx-proxy + acme-companion
- Production-ready

## Minimal Deployment (No Code Required!)

**Version 7.3 requires ONLY:**

1. ✅ `docker-compose.yaml` file
2. ✅ Docker images (from Docker Hub)
3. ⚠️ `custom/` directory (optional, only if customizing)

**No git repo needed!** Download docker-compose.yaml from release/docs and start.

## Migration Requirements

### Breaking Changes

⚠️ **Not backward compatible** - Manual migration required

**What needs migration:**
1. ✅ PostgreSQL database (dump and restore)
2. ✅ Media files (copy to named volume)
3. ✅ Custom settings → `custom/local_settings.py` (if you had them)
4. ✅ Custom logos/CSS → `custom/static/` (if you had them)
5. ⚠️ Backup scripts (new volume paths)
6. ⚠️ Monitoring (new container names)

### Migration Steps

See [`UPGRADE_TO_7.3.md`](./UPGRADE_TO_7.3.md) for complete guide.

**Quick overview:**
```bash
# 1. Backup
docker compose exec db pg_dump -U mediacms mediacms > backup.sql
tar -czf media_backup.tar.gz media_files/
cp docker-compose.yaml docker-compose.yaml.old

# 2. Download new docker-compose.yaml
wget https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/docker-compose.yaml

# 3. Create custom/ if needed
mkdir -p custom/static/{images,css}
# Copy your old settings/logos if you had them

# 4. Pull images and start
docker compose pull
docker compose up -d

# 5. Restore data
cat backup.sql | docker compose exec -T db psql -U mediacms mediacms
# (See full guide for media migration)
```

## Configuration Files

### Created/Reorganized

```
├── Dockerfile                    # Multi-stage (base, web, worker)
├── Dockerfile.nginx             # Nginx image
├── docker-compose.yaml          # Production
├── docker-compose-cert.yaml     # Production + HTTPS
├── docker-compose-dev.yaml      # Development
├── Makefile                     # Common tasks
├── custom/                      # User customizations
│   ├── README.md
│   ├── local_settings.py.example
│   └── static/
├── config/
│   ├── imagemagick/policy.xml
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── site.conf
│   ├── nginx-proxy/
│   │   └── client_max_body_size.conf
│   └── uwsgi/
│       └── uwsgi.ini
└── scripts/
    └── run-migrations.sh
```

## Makefile Targets

New Makefile with common operations:

```bash
make backup-db              # PostgreSQL dump with timestamp
make admin-shell            # Quick Django shell access
make build-frontend         # Rebuild frontend assets
make test                   # Run test suite
```

## Rollback Strategy

If migration fails:

```bash
# 1. Stop new version
docker compose down

# 2. Checkout old version
git checkout main

# 3. Restore old compose
git checkout main docker-compose.yaml

# 4. Restore data from backups
# (See UPGRADE_TO_7.3.md for details)

# 5. Start old version
docker compose up -d
```

## Testing Checklist

Before production deployment:

- [ ] Migrations run successfully
- [ ] Static files load correctly
- [ ] Media files upload/download work
- [ ] Video transcoding works (check celery_long logs)
- [ ] Admin panel accessible
- [ ] Custom settings loaded (if using custom/)
- [ ] Database persists across restarts
- [ ] Media persists across restarts
- [ ] Logs accessible via `docker compose logs`
- [ ] Health checks pass: `docker compose ps`

## Common Post-Upgrade Tasks

### View Logs
```bash
# Before: tail -f logs/uwsgi.log
# After:
docker compose logs -f web
docker compose logs -f celery_long
```

### Access Shell
```bash
# Before: docker exec -it <container> bash
# After:
make admin-shell
# Or: docker compose exec web bash
```

### Restart Service
```bash
# Before: docker restart <container>
# After:
docker compose restart web
```

### Scale Workers
```bash
# New capability:
docker compose up -d --scale celery_short=3 --scale celery_long=2
```

### Database Backup
```bash
# Before: Custom script
# After:
make backup-db
```

## Performance Considerations

### Startup Time
- **Before**: Slower (chown on all files)
- **After**: Faster (no permission fixing)

### I/O Performance
- **Before**: Bind mount overhead
- **After**: Named volumes (better performance)

### Memory Usage
- **Before**: Single large container
- **After**: Multiple smaller containers (better resource allocation)

## New Volume Management

### List Volumes
```bash
docker volume ls | grep mediacms
```

### Inspect Volume
```bash
docker volume inspect mediacms_media_files
```

### Backup Volume
```bash
docker run --rm \
  -v mediacms_media_files:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/media_backup.tar.gz -C /data .
```

## Documentation

- **Upgrade Guide**: [`UPGRADE_TO_7.3.md`](./UPGRADE_TO_7.3.md)
- **Customization**: [`custom/README.md`](./custom/README.md)
- **Admin Docs**: `docs/admins_docs.md`

## Timeline Estimates

| Instance Size | Expected Migration Time |
|---------------|------------------------|
| Small (<100 videos) | 30-60 minutes |
| Medium (100-1000 videos) | 1-3 hours |
| Large (>1000 videos) | 3-8 hours |

**Plan accordingly and schedule during low-traffic periods!**

## Getting Help

1. Read [`UPGRADE_TO_7.3.md`](./UPGRADE_TO_7.3.md) thoroughly
2. Check [`custom/README.md`](./custom/README.md) for customization
3. Search GitHub Issues
4. Test in staging first
5. Keep backups for at least 1 week post-upgrade

## Next Steps

1. ✅ Read [`UPGRADE_TO_7.3.md`](./UPGRADE_TO_7.3.md)
2. ✅ Test in development: `docker compose -f docker-compose-dev.yaml up`
3. ✅ Backup production data
4. ✅ Test migration in staging
5. ✅ Plan maintenance window
6. ✅ Execute migration
7. ✅ Monitor for 24-48 hours

---

**Ready to upgrade?** Start with: [`UPGRADE_TO_7.3.md`](./UPGRADE_TO_7.3.md)
