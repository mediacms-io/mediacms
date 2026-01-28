# Changelog

All notable changes to the MediaCMS LTI Filter plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-23

### Added
- Initial release of MediaCMS LTI Filter
- Automatic detection of MediaCMS video URLs in Moodle content
- Transparent LTI 1.3 authentication for embedded videos
- Support for `/view?m=TOKEN` and `/embed?m=TOKEN` URL patterns
- Configurable MediaCMS URL setting
- Configurable LTI tool selection from Moodle's LTI tools
- Configurable iframe dimensions (width/height)
- Auto-submit form mechanism for seamless LTI launch
- Support for Moodle 5.0+
- Privacy provider implementation for GDPR compliance
- Comprehensive documentation (README, INSTALLATION guide)
- Multi-language support framework (English strings included)

### Security
- Only processes content for logged-in users (no guest access)
- Uses Moodle's LTI 1.3 security framework
- Passes user context via secure `login_hint` parameter
- All URLs properly escaped and sanitized

## [Unreleased]

### Planned Features
- Support for additional MediaCMS URL patterns
- Customizable iframe styling options
- Cache optimization for LTI configuration
- Support for playlist URLs
- Admin interface to preview filter behavior
- Bulk URL conversion tool
- Statistics/usage tracking

---

## Version History

- **1.0.0** (2026-01-23) - Initial release

## Upgrade Notes

### Upgrading to 1.0.0
- First release, no upgrade path needed

---

For detailed information about each release, see the Git commit history.
