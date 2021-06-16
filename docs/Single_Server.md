# Single Server

## Installation

The core dependencies are Python3, Django3, Celery, PostgreSQL, Redis, ffmpeg. Any system that can have these dependencies installed, can run MediaCMS. But we strongly suggest installing on Linux Ubuntu 18 or 20 versions.

Installation on a Ubuntu 18 or 20 system with git utility installed should be completed in a few minutes with the following steps.
Make sure you run it as user root, on a clear system, since the automatic script will install and configure the following services: Celery/PostgreSQL/Redis/Nginx and will override any existing settings. 

Automated script - tested on Ubuntu 18, Ubuntu 20, and Debian Buster

```bash
mkdir /home/mediacms.io && cd /home/mediacms.io/
git clone https://github.com/mediacms-io/mediacms
cd /home/mediacms.io/mediacms/ && bash ./install.sh
```

The script will ask if you have a URL where you want to deploy MediaCMS, otherwise it will use localhost. If you provide a URL, it will use Let's Encrypt service to install a valid ssl certificate. 


## Update

If you've used the above way to install MediaCMS, update with the following:

```bash
cd /home/mediacms.io/mediacms # enter mediacms directory
source  /home/mediacms.io/bin/activate # use virtualenv
git pull # update code
python manage.py migrate # run Django migrations
sudo systemctl restart mediacms celery_long celery_short # restart services
```

## Configuration
Checkout the configuration docs on [Configuration](/docs/Configuration.md) page.


## Maintenance
Database can be backed up with pg_dump and media_files on /home/mediacms.io/mediacms/media_files include original files and encoded/transcoded versions
