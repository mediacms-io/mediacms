# MediaCMS 7.3 - Quick Start

## Minimal Deployment (No Code Required!)

MediaCMS 7.3 can be deployed with **just 2 files**:

1. `docker-compose.yaml`
2. `custom/` directory (optional)

**No git repo, no code checkout needed!** Everything runs from Docker images.

---

## Fresh Installation

### 1. Create deployment directory

```bash
mkdir mediacms && cd mediacms
```

### 2. Download docker-compose.yaml

```bash
wget https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/docker-compose.yaml
```

Or with curl:
```bash
curl -O https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/docker-compose.yaml
```

### 3. Start MediaCMS

```bash
docker compose up -d
```

### 4. Access your site

- **Frontend**: http://localhost
- **Admin**: http://localhost/admin
  - Username: `admin`
  - Password: Check logs for auto-generated password:
    ```bash
    docker compose logs migrations | grep "password:"
    ```

**That's it!** 🎉

---

## Optional: Customization

### Add Custom Settings

```bash
# 1. Create custom directory
mkdir -p custom/static/{images,css}

# 2. Download example template
wget -O custom/local_settings.py.example \
  https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/custom/local_settings.py.example

# 3. Copy and edit
cp custom/local_settings.py.example custom/local_settings.py
nano custom/local_settings.py
```

Example customizations:
```python
# custom/local_settings.py
DEBUG = False
ALLOWED_HOSTS = ['media.example.com']
PORTAL_NAME = "My Media Portal"
```

### Add Custom Logo

```bash
# 1. Copy your logo
cp ~/my-logo.png custom/static/images/logo_dark.png

# 2. Reference in settings
cat >> custom/local_settings.py <<EOF
PORTAL_LOGO_DARK_PNG = "/custom/static/images/logo_dark.png"
EOF

# 3. Restart (no rebuild needed!)
docker compose restart web
```

### Add Custom CSS

```bash
# 1. Create CSS file
cat > custom/static/css/custom.css <<EOF
body {
    font-family: 'Arial', sans-serif;
}
EOF

# 2. Reference in settings
cat >> custom/local_settings.py <<EOF
EXTRA_CSS_PATHS = ["/custom/static/css/custom.css"]
EOF

# 3. Restart (no rebuild needed!)
docker compose restart web
```

**Note**: Both settings AND static files only need restart - nginx serves custom/ files directly!

---

## HTTPS with Let's Encrypt

### 1. Download cert overlay

```bash
wget https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/docker-compose-cert.yaml
```

### 2. Edit domains

```bash
nano docker-compose-cert.yaml
```

Change these lines:
```yaml
VIRTUAL_HOST: 'media.example.com'        # Your domain
LETSENCRYPT_HOST: 'media.example.com'    # Your domain
LETSENCRYPT_EMAIL: 'admin@example.com'   # Your email
```

### 3. Start with SSL

```bash
docker compose -f docker-compose.yaml -f docker-compose-cert.yaml up -d
```

**SSL certificates are issued automatically!**

---

## File Structure

Your deployment directory:

```
mediacms/
├── docker-compose.yaml          # Required
├── docker-compose-cert.yaml     # Optional (for HTTPS)
└── custom/                      # Optional (for customizations)
    ├── local_settings.py        # Django settings
    └── static/
        ├── images/              # Custom logos
        └── css/                 # Custom CSS
```

**Named volumes** (managed by Docker):
- `mediacms_postgres_data` - Database
- `mediacms_media_files` - Uploaded media
- `mediacms_static_files` - Static assets
- `mediacms_logs` - Application logs

---

## Common Commands

### View logs
```bash
docker compose logs -f web
docker compose logs -f celery_long
```

### Access Django shell
```bash
docker compose exec web python manage.py shell
```

### Create admin user
```bash
docker compose exec web python manage.py createsuperuser
```

### Restart service
```bash
docker compose restart web
```

### Stop everything
```bash
docker compose down
```

### Update to newer version
```bash
docker compose pull
docker compose up -d
```

---

## Backup

### Database backup
```bash
docker compose exec db pg_dump -U mediacms mediacms > backup_$(date +%Y%m%d).sql
```

### Media files backup
```bash
docker run --rm \
  -v mediacms_media_files:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/media_backup_$(date +%Y%m%d).tar.gz -C /data .
```

---

## Upgrading from 7.x?

If you're upgrading from an older MediaCMS version, see:
- **[UPGRADE_TO_7.3.md](./UPGRADE_TO_7.3.md)** - Complete migration guide
- **[DOCKER_RESTRUCTURE_SUMMARY.md](./DOCKER_RESTRUCTURE_SUMMARY.md)** - What changed

---

## Documentation

- **Customization**: Download [`custom/README.md`](https://raw.githubusercontent.com/mediacms-io/mediacms/v7.3/custom/README.md)
- **Upgrade Guide**: [UPGRADE_TO_7.3.md](./UPGRADE_TO_7.3.md)
- **Architecture**: [DOCKER_RESTRUCTURE_SUMMARY.md](./DOCKER_RESTRUCTURE_SUMMARY.md)
- **Project Docs**: https://docs.mediacms.io

---

## Troubleshooting

### Can't access the site?

Check services are running:
```bash
docker compose ps
```

All services should be "Up" or "Exited (0)" for migrations.

### Forgot admin password?

Check logs:
```bash
docker compose logs migrations | grep "password:"
```

Or create new admin:
```bash
docker compose exec web python manage.py createsuperuser
```

### Videos not encoding?

Check celery workers:
```bash
docker compose logs celery_long
docker compose logs celery_short
```

### Port 80 already in use?

Edit docker-compose.yaml to use different port:
```yaml
nginx:
  ports:
    - "8080:80"  # Use port 8080 instead
```

Then access at http://localhost:8080

---

## Support

- **Issues**: https://github.com/mediacms-io/mediacms/issues
- **Discussions**: https://github.com/mediacms-io/mediacms/discussions
- **Docs**: https://docs.mediacms.io

---

**🎉 Enjoy MediaCMS!**
