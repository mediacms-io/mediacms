# TinyMCE MediaCMS Plugin for Moodle

A TinyMCE editor plugin for Moodle that provides media embedding capabilities with MediaCMS/LTI integration.

## Build Information


1. Get and extract Moodle 5.1
2. cp -r lms-plugins/mediacms-moodle/tiny/mediacms/ moodle/public/lib/editor/tiny/plugins/
3. nvm use 22 && cd moodle/public && npm install
4. npx grunt amd --root=lib/editor/tiny/plugins/mediacms
# i've noticed that this fails, so this should work: npx grunt amd

5. To test the output:
cp * ../../../../../../../lms-plugins/mediacms-moodle/tiny/mediacms/ -r

6. Then copy to Moodle server and purge caches

