# Upgrade Guide: MediaCMS 7.x to 7.3

**IMPORTANT: This is a major architectural change. Read this entire guide before upgrading.**

---

## 🎯 Fresh Install (Not Upgrading)?

If you're starting fresh with 7.3, you don't need this guide!

**All you need:**
```bash
# 1. Download docker-compose.yaml
wget https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/docker-compose.yaml

# 2. Start (creates everything automatically)
docker compose up -d

# 3. Done! Visit http://localhost
```

**Optional: Add customizations**
```bash
# Create custom/ directory
mkdir -p custom/static/{images,css}

# Download example settings
wget -O custom/local_settings.py.example \
  https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/custom/local_settings.py.example

# Edit and use
cp custom/local_settings.py.example custom/local_settings.py
nano custom/local_settings.py

# Restart
docker compose restart web
```

See [`custom/README.md`](https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/custom/README.md) for customization options.

---

## ⚠️ Upgrading from 7.x? Continue reading...

## What Changed in 7.3

### Architecture Changes
- **Before**: Monolithic container (supervisor + nginx + uwsgi + celery in one)
- **After**: Microservices (separate nginx, web, celery_beat, celery_short, celery_long containers)

### Volume Strategy Changes
- **Before**: Entire project directory mounted (`./:/home/mediacms.io/mediacms/`)
- **After**: Named volumes for data, bind mount only for `custom/` directory

### Specific Changes

| Component | Before (7.x) | After (7.3) |
|-----------|-------------|-------------|
| media_files | Bind mount `./media_files` | Named volume `media_files` |
| static files | Bind mount `./static` | Named volume `static_files` (built into image) |
| logs | Bind mount `./logs` | Named volume `logs` |
| postgres_data | `../postgres_data` | Named volume `postgres_data` |
| Custom config | `cms/local_settings.py` in mounted dir | `custom/local_settings.py` bind mount |
| Static collection | Runtime (via entrypoint) | Build time (in Dockerfile) |
| User | Root with gosu switch | www-data from start |

## What You Need for 7.3

**Minimal deployment - NO CODE REQUIRED:**

1. ✅ `docker-compose.yaml` (download from release or docs)
2. ✅ Docker images (pulled from Docker Hub)
3. ⚠️ `custom/` directory (only if you have customizations)

**That's it!** No git repo, no code checkout needed.

## Pre-Upgrade Checklist

### 1. Backup Everything

```bash
# Stop services
docker compose down

# Backup media files
tar -czf backup_media_$(date +%Y%m%d).tar.gz media_files/

# Backup database
docker compose up -d db
docker compose exec db pg_dump -U mediacms mediacms > backup_db_$(date +%Y%m%d).sql
docker compose down

# Backup logs (optional)
tar -czf backup_logs_$(date +%Y%m%d).tar.gz logs/

# Backup local settings if you had them
cp cms/local_settings.py backup_local_settings.py 2>/dev/null || echo "No local_settings.py found"

# Backup current docker-compose.yaml
cp docker-compose.yaml docker-compose.yaml.old
```

### 2. Document Current Setup

```bash
# Save current docker-compose version
git branch backup-pre-7.3-upgrade

# Document current state
docker compose ps > pre_upgrade_state.txt
docker compose config > pre_upgrade_config.yaml
df -h > pre_upgrade_disk_usage.txt
```

### 3. Check Disk Space

You'll need enough space for:
- Existing data (media_files, postgres_data)
- New Docker volumes (will copy data here)
- Database dump

```bash
du -sh media_files/ postgres_data/ logs/
df -h .
```

## Upgrade Methods

### Method 1: Clean Migration (Recommended)

This method migrates your data to the new volume structure.

#### Step 1: Get New docker-compose.yaml

**Option A: Download from release**
```bash
# Download docker-compose.yaml for 7.3
wget https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/docker-compose.yaml

# Or using curl
curl -O https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/docker-compose.yaml

# Optional: Download HTTPS version
wget https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/docker-compose-cert.yaml
```

**Option B: Copy from docs/release notes**
- Copy the docker-compose.yaml content from release notes
- Save as `docker-compose.yaml` in your deployment directory

#### Step 2: Prepare Custom Configuration (if needed)

```bash
# Create custom directory structure (only if you need customizations)
mkdir -p custom/static/{images,css}
touch custom/static/{images,css}/.gitkeep

# If you had local_settings.py, create it in custom/
if [ -f backup_local_settings.py ]; then
    # Copy your old settings
    cp backup_local_settings.py custom/local_settings.py
    echo "✓ Migrated local_settings.py"
else
    # Download example template (optional)
    wget -O custom/local_settings.py.example \
      https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/custom/local_settings.py.example
    echo "Downloaded example template to custom/local_settings.py.example"
fi

# Copy any custom logos/css you had
# (adjust paths as needed for your old setup)
# cp my-old-logo.png custom/static/images/logo_dark.png
# cp my-custom.css custom/static/css/custom.css
```

#### Step 3: Start New Stack (Without Data)

```bash
# Pull new images
docker compose pull

# Start database first
docker compose up -d db redis

# Wait for DB to be ready
sleep 10
```

#### Step 4: Restore Database

```bash
# Copy backup into container
docker compose cp backup_db_*.sql db:/tmp/backup.sql

# Restore database
docker compose exec db psql -U mediacms mediacms < /tmp/backup.sql

# Or from host:
cat backup_db_*.sql | docker compose exec -T db psql -U mediacms mediacms
```

#### Step 5: Restore Media Files

```bash
# Start all services (will create volumes)
docker compose up -d

# Find the volume name
docker volume ls | grep media_files

# Copy media files to volume
# Method A: Using a temporary container
docker run --rm \
  -v $(pwd)/media_files:/source:ro \
  -v mediacms_media_files:/dest \
  alpine sh -c "cp -av /source/* /dest/"

# Method B: Using existing container
docker compose exec web sh -c "exit"  # Ensure web is running
# Then copy from host
tar -C media_files -cf - . | docker compose exec -T web tar -C /home/mediacms.io/mediacms/media_files -xf -
```

#### Step 6: Verify and Test

```bash
# Check logs
docker compose logs -f web

# Verify media files are accessible
docker compose exec web ls -la /home/mediacms.io/mediacms/media_files/

# Check database connection
docker compose exec web python manage.py dbshell

# Access the site
curl http://localhost

# Check admin panel
# Visit http://localhost/admin
```

### Method 2: In-Place Migration with Symlinks (Advanced)

**Warning**: This is more complex but avoids data copying.

#### Step 1: Keep Old Data Locations

```bash
# Modify docker-compose.yaml to mount old locations temporarily
# Add to appropriate services:
volumes:
  - ./media_files:/home/mediacms.io/mediacms/media_files
  - ./logs:/home/mediacms.io/mediacms/logs
  # Instead of named volumes
```

#### Step 2: Gradually Migrate

After confirming everything works:
1. Copy data to named volumes
2. Remove bind mounts
3. Switch to named volumes

### Method 3: Fresh Install (If Possible)

If your MediaCMS instance is new or test:

```bash
# Backup what you need
# ...

# Clean slate
docker compose down -v
rm -rf media_files/ logs/ static/

# Fresh start
docker compose up -d
```

## Post-Upgrade Steps

### 1. Verify Everything Works

```bash
# Check all services are running
docker compose ps

# Should see: migrations (exited 0), web, nginx, celery_beat, celery_short, celery_long, db, redis

# Check logs for errors
docker compose logs web
docker compose logs nginx

# Test upload functionality
# Test video encoding (check celery_long logs)
# Test frontend
```

### 2. Verify Media Files

```bash
# Check media files are accessible
docker compose exec web ls -lh /home/mediacms.io/mediacms/media_files/

# Check file counts match
# Old: ls media_files/ | wc -l
# New: docker compose exec web sh -c "ls /home/mediacms.io/mediacms/media_files/ | wc -l"
```

### 3. Verify Database

```bash
# Check users
docker compose exec db psql -U mediacms mediacms -c "SELECT count(*) FROM users_user;"

# Check videos
docker compose exec db psql -U mediacms mediacms -c "SELECT count(*) FROM files_media;"
```

### 4. Update Backups

```bash
# Update your backup scripts for new volume locations
# Use: make backup-db (if Makefile target exists)
# Or: docker compose exec db pg_dump ...
```

## Rollback Procedure

If something goes wrong:

### Quick Rollback

```bash
# Stop new version
docker compose down

# Restore old docker-compose file
mv docker-compose.yaml.old docker-compose.yaml

# Pull old images (if you had old image tags documented)
docker compose pull

# Start old version
docker compose up -d
```

### Full Rollback with Data Restore

```bash
# Stop everything
docker compose down -v

# Restore old docker-compose
mv docker-compose.yaml.old docker-compose.yaml

# Restore backups
tar -xzf backup_media_*.tar.gz -C ./media_files
cat backup_db_*.sql | docker compose exec -T db psql -U mediacms mediacms

# Start old version
docker compose up -d
```

## Common Issues & Solutions

### Issue: "Volume not found"

**Solution**: Volumes are created with project name prefix. Check:
```bash
docker volume ls
# Look for: mediacms_media_files, mediacms_static_files, etc.
```

### Issue: "Permission denied" on media files

**Solution**: Files must be owned by www-data (UID 33)
```bash
docker compose exec web chown -R www-data:www-data /home/mediacms.io/mediacms/media_files
```

### Issue: Static files not loading

**Solution**: Rebuild image (collectstatic runs at build time)
```bash
docker compose down
docker compose build --no-cache web
docker compose up -d
```

### Issue: Database connection refused

**Solution**: Check database is healthy
```bash
docker compose logs db
docker compose exec db pg_isready -U mediacms
```

### Issue: Custom settings not loading

**Solution**: Check custom/local_settings.py exists and syntax
```bash
docker compose exec web cat /home/mediacms.io/mediacms/custom/local_settings.py
docker compose exec web python -m py_compile /home/mediacms.io/mediacms/custom/local_settings.py
```

## Performance Considerations

### New Volume Performance

Named volumes are typically faster than bind mounts:
- **Before**: Filesystem overhead on host
- **After**: Direct container filesystem (better I/O)

### Monitoring Volume Usage

```bash
# Check volume sizes
docker system df -v

# Check specific volume
docker volume inspect mediacms_media_files
```

## New Backup Strategy

With named volumes, backups change:

```bash
# Database backup
docker compose exec db pg_dump -U mediacms mediacms > backup.sql

# Media files backup
docker run --rm \
  -v mediacms_media_files:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/media_backup_$(date +%Y%m%d).tar.gz -C /data .
```

Or use the Makefile:
```bash
make backup-db
```

## Getting Help

If you encounter issues:

1. **Check logs**: `docker compose logs <service>`
2. **Check GitHub Issues**: Search for similar problems
3. **Rollback**: Use the rollback procedure above
4. **Report**: Open an issue with:
   - Your docker-compose.yaml
   - Output of `docker compose ps`
   - Relevant logs
   - Steps to reproduce

## Summary of Benefits

After upgrading to 7.3:

✅ **Better separation of concerns** - each service has one job
✅ **Easier scaling** - scale web/workers independently
✅ **Better security** - containers run as www-data, not root
✅ **Faster deployments** - static files built into image
✅ **Cleaner customization** - dedicated custom/ directory
✅ **Easier SSL setup** - docker-compose-cert.yaml overlay
✅ **Better volume management** - named volumes instead of bind mounts

## Timeline Recommendation

- **Small instance** (<100 videos): 30-60 minutes
- **Medium instance** (100-1000 videos): 1-3 hours
- **Large instance** (>1000 videos): Plan for several hours

Schedule during low-traffic period!
