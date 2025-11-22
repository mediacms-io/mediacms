# Custom Configuration

This directory allows you to customize MediaCMS without modifying the codebase or rebuilding images.

## How It Works - Production Ready!

**The Flow:**

```
1. CI/CD builds base image:       docker build (no custom files)
                                  ↓
                                  Pushes to Docker Hub

2. Production pulls image:        docker compose pull
                                  ↓
                                  Mounts custom/ directory

3. You add files:                 custom/static/css/custom.css
                                  custom/static/images/logo.png
                                  ↓
                                  Nginx serves directly!

4. You reference in settings:     EXTRA_CSS_PATHS = ["/custom/static/css/custom.css"]
                                  PORTAL_LOGO_DARK_PNG = "/custom/static/images/logo.png"
                                  ↓
                                  Restart containers

5. Done! No rebuild needed!
```

**Key Points:**
- ✅ Files go in `custom/static/` on your host
- ✅ Nginx serves them directly from `/custom/static/` URL
- ✅ **NO rebuild needed** - just restart containers!
- ✅ Works with pre-built images from Docker Hub
- ✅ Perfect for production deployments

## Quick Start

### Option 1: No Customization (Default)
Just run docker compose - everything works out of the box:
```bash
docker compose up -d
```

### Option 2: With Customization
Add your custom files, then restart:
```bash
# 1. Copy example settings
cp custom/local_settings.py.example custom/local_settings.py

# 2. Edit settings
nano custom/local_settings.py

# 3. Restart containers (no rebuild!)
docker compose restart web celery_beat celery_short celery_long
```

## Customization Options

### 1. Django Settings (`local_settings.py`)

**Create the file:**
```bash
cp custom/local_settings.py.example custom/local_settings.py
```

**Edit with your settings:**
```python
# custom/local_settings.py
DEBUG = False
ALLOWED_HOSTS = ['example.com']
PORTAL_NAME = "My Media Site"
```

**Apply changes (restart only - no rebuild):**
```bash
docker compose restart web celery_beat celery_short celery_long
```

### 2. Custom Logo

**Add your logo:**
```bash
cp ~/my-logo.png custom/static/images/logo_dark.png
```

**Reference it in settings:**
```bash
cat >> custom/local_settings.py <<EOF
PORTAL_LOGO_DARK_PNG = "/custom/static/images/logo_dark.png"
EOF
```

**Restart (no rebuild needed!):**
```bash
docker compose restart web
```

### 3. Custom CSS

**Create CSS file:**
```bash
cat > custom/static/css/custom.css <<EOF
body {
    font-family: 'Arial', sans-serif;
}
.header {
    background-color: #333;
}
EOF
```

**Reference it in settings:**
```bash
cat >> custom/local_settings.py <<EOF
EXTRA_CSS_PATHS = ["/custom/static/css/custom.css"]
EOF
```

**Restart (no rebuild needed!):**
```bash
docker compose restart web
```

## Directory Structure

```
custom/
├── README.md                    # This file
├── local_settings.py.example    # Template (copy to local_settings.py)
├── local_settings.py            # Your settings (gitignored)
└── static/
    ├── images/                  # Custom logos (gitignored)
    │   └── logo_dark.png
    └── css/                     # Custom CSS (gitignored)
        └── custom.css
```

## Important Notes

✅ **No rebuild needed** - nginx serves custom/ files directly
✅ **Works with pre-built images** - perfect for production
✅ **Files are gitignored** - your customizations won't be committed
✅ **Settings need restart only** - just restart containers
✅ **Static files also just restart** - served directly by nginx

## Complete Example

```bash
# 1. Create settings file
cp custom/local_settings.py.example custom/local_settings.py

# 2. Add custom logo
cp ~/logo.png custom/static/images/logo_dark.png

# 3. Add custom CSS
echo "body { background: #f5f5f5; }" > custom/static/css/custom.css

# 4. Configure settings to use them
cat >> custom/local_settings.py <<EOF

# Custom branding
PORTAL_NAME = "My Media Portal"
PORTAL_LOGO_DARK_PNG = "/custom/static/images/logo_dark.png"
EXTRA_CSS_PATHS = ["/custom/static/css/custom.css"]

# Security
DEBUG = False
ALLOWED_HOSTS = ['media.example.com']
EOF

# 5. Apply changes (just restart!)
docker compose restart web

# Done! No rebuild needed.
```

## URL Paths Explained

| Your file | nginx serves at | You reference as |
|-----------|----------------|------------------|
| `custom/static/css/custom.css` | `http://localhost/custom/static/css/custom.css` | `"/custom/static/css/custom.css"` |
| `custom/static/images/logo.png` | `http://localhost/custom/static/images/logo.png` | `"/custom/static/images/logo.png"` |

**Why `/custom/static/`?**
- Distinguishes from core `/static/` (built into image)
- Allows nginx to serve from different mount point
- No rebuild needed when files change

## Troubleshooting

**Changes not appearing?**
- Restart containers: `docker compose restart web nginx`
- Check nginx has custom/ mounted: `docker compose exec nginx ls /var/www/custom`
- Check file exists: `docker compose exec nginx ls /var/www/custom/css/`
- Test URL: `curl http://localhost/custom/static/css/custom.css`

**Import errors?**
- Make sure `local_settings.py` has valid Python syntax
- Check logs: `docker compose logs web`

**Logo not showing?**
- Verify file is in `custom/static/images/`
- Check path in `local_settings.py` uses `/custom/static/` prefix
- Restart web container: `docker compose restart web`

## Advanced: Multiple CSS Files

```python
# custom/local_settings.py
EXTRA_CSS_PATHS = [
    "/custom/static/css/colors.css",
    "/custom/static/css/fonts.css",
    "/custom/static/css/layout.css",
]
```

## Advanced: Environment-Specific Settings

```python
# custom/local_settings.py
import os

if os.getenv('ENVIRONMENT') == 'production':
    DEBUG = False
    ALLOWED_HOSTS = ['media.example.com']
else:
    DEBUG = True
    ALLOWED_HOSTS = ['*']
```

Then set in docker-compose.yaml:
```yaml
web:
  environment:
    ENVIRONMENT: production
```
