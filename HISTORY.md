# History

## 2.2.0

### Features
- Updates Python/Django requirements and Dockerfile to use latest 3.11 Python. This update requires some manual steps, for existing (not new) installations.
For Docker installation, make sure you follow the instructions on how to update, on the admin docs page, under the Docker section.

For single server installation,

```bash
cd /home/mediacms.io/mediacms # enter mediacms directory
source  /home/mediacms.io/bin/activate # use virtualenv
git pull # update code
pip install -r requirements.txt # install new requirements
python manage.py migrate # run Django migrations
cp deploy/local_install/celery_* /etc/systemd/system/ # copy celery services
systemctl daemon-reload # reload supervisor daemon
systemctl restart mediacms celery_long celery_short # restart services
```

## 2.1.0

### Fixes
- Increase uwsgi buffer-size parameter. This prevents an error by uwsgi with large headers - [#5b60](https://github.com/mediacms-io/mediacms/commit/5b601698a41ad97f08c1830e14b1c18f73ab8315)
- Fix issues with comments. These were not reported on the tracker but it is certain that they would not show comments on media files (non videos but also videos). Unfortunately this reverts work done with Timestamps on comments + Mentions on comments, more on PR [#802](https://github.com/mediacms-io/mediacms/pull/802)

### Features
- Allow tags to contains other characters too, not only English alphabet ones [#801](https://github.com/mediacms-io/mediacms/pull/801)
- Add simple cookie consent code [#799](https://github.com/mediacms-io/mediacms/pull/799)
- Allow password reset & email verify pages on global login required [#790](https://github.com/mediacms-io/mediacms/pull/790)
- Add api_url field to search api [#692](https://github.com/mediacms-io/mediacms/pull/692)