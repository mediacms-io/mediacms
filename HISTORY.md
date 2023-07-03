# History

## 3.0.0

### Features
- Updates Python/Django requirements and Dockerfile to use latest 3.11 Python - https://github.com/mediacms-io/mediacms/pull/826/files. This update requires some manual steps, for existing (not new) installations. Check the update section under the [Admin docs](https://github.com/mediacms-io/mediacms/blob/main/docs/admins_docs.md#2-server-installation), either for single server or for Docker Compose installations
- Upgrade postgres on Docker Compose - https://github.com/mediacms-io/mediacms/pull/749

### Fixes
- video player options for HLS - https://github.com/mediacms-io/mediacms/pull/832
- AVI videos not correctly recognised as videos - https://github.com/mediacms-io/mediacms/pull/833

## 2.1.0

### Fixes
- Increase uwsgi buffer-size parameter. This prevents an error by uwsgi with large headers - [#5b60](https://github.com/mediacms-io/mediacms/commit/5b601698a41ad97f08c1830e14b1c18f73ab8315)
- Fix issues with comments. These were not reported on the tracker but it is certain that they would not show comments on media files (non videos but also videos). Unfortunately this reverts work done with Timestamps on comments + Mentions on comments, more on PR [#802](https://github.com/mediacms-io/mediacms/pull/802)

### Features
- Allow tags to contains other characters too, not only English alphabet ones [#801](https://github.com/mediacms-io/mediacms/pull/801)
- Add simple cookie consent code [#799](https://github.com/mediacms-io/mediacms/pull/799)
- Allow password reset & email verify pages on global login required [#790](https://github.com/mediacms-io/mediacms/pull/790)
- Add api_url field to search api [#692](https://github.com/mediacms-io/mediacms/pull/692)