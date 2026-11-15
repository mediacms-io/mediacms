# TinyMCE MediaCMS Plugin for Moodle

A TinyMCE editor plugin for Moodle that provides media embedding capabilities with MediaCMS/LTI integration.

> **Moodle plugins directory**
> - TinyMCE editor plugin (this plugin): https://moodle.org/plugins/tiny_mediacms
> - Filter plugin (required dependency): https://moodle.org/plugins/filter_mediacms

## Build Information

Changes to PHP, templates and language strings need no build. Changes to `amd/src/*.js` must be built with Moodle's own toolchain, which lints the code and writes `amd/build/*.min.js` and their source maps. The commands below are run from the MediaCMS repository root, with a Moodle 5.1 checkout in `moodle/`.

### Preparation
1. Get and extract Moodle 5.1 into `moodle/`.
2. Copy the plugin into Moodle. There is no trailing slash after `mediacms`, so it lands in `plugins/mediacms` and not loose in `plugins/`:

   ```bash
   cp -r lms-plugins/mediacms-moodle/tiny/mediacms moodle/public/lib/editor/tiny/plugins/
   ```
3. Install Moodle's build tools. Moodle 5.1 keeps `package.json` in its root folder, not in `public/`:

   ```bash
   cd moodle && nvm use 22 && npm install && cd ..
   ```

### Actual build
4. Run Moodle's AMD build in the plugin folder:

   ```bash
   (cd moodle/public/lib/editor/tiny/plugins/mediacms && npx grunt amd)
   ```

### Copy the output back
5. Only `amd/build` changes, so copy that folder back:

   ```bash
   cp -r moodle/public/lib/editor/tiny/plugins/mediacms/amd/build/. lms-plugins/mediacms-moodle/tiny/mediacms/amd/build/
   ```

If the Moodle folder is owned by the web server user (for example `www-data`), run steps 2, 4 and 5 with `sudo`, or give your user ownership of `moodle/` first.

### Package and test
6. Package the plugins as described in the suite README (`lms-plugins/mediacms-moodle/README.md`), install the ZIP on a Moodle server and purge the caches (`php admin/cli/purge_caches.php`).
