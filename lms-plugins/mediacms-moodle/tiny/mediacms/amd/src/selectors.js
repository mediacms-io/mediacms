// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Tiny Media plugin helper function to build queryable data selectors.
 *
 * @module      tiny_mediacms/selectors
 * @copyright   2022 Huong Nguyen <huongnv13@gmail.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

export default {
    IMAGE: {
        actions: {
            submit: '.tiny_imagecms_urlentrysubmit',
            imageBrowser: '.openimagecmsbrowser',
            addUrl: '.tiny_imagecms_addurl',
            deleteImage: '.tiny_imagecms_deleteicon',
        },
        elements: {
            form: 'form.tiny_imagecms_form',
            alignSettings: '.tiny_imagecms_button',
            alt: '.tiny_imagecms_altentry',
            altWarning: '.tiny_imagecms_altwarning',
            height: '.tiny_imagecms_heightentry',
            width: '.tiny_imagecms_widthentry',
            url: '.tiny_imagecms_urlentry',
            urlWarning: '.tiny_imagecms_urlwarning',
            size: '.tiny_imagecms_size',
            presentation: '.tiny_imagecms_presentation',
            constrain: '.tiny_imagecms_constrain',
            customStyle: '.tiny_imagecms_customstyle',
            preview: '.tiny_imagecms_preview',
            previewBox: '.tiny_imagecms_preview_box',
            loaderIcon: '.tiny_imagecms_loader',
            loaderIconContainer: '.tiny_imagecms_loader_container',
            insertImage: '.tiny_imagecms_insert_image',
            modalFooter: '.modal-footer',
            dropzoneContainer: '.tiny_imagecms_dropzone_container',
            fileInput: '#tiny_imagecms_fileinput',
            fileNameLabel: '.tiny_imagecms_filename',
            sizeOriginal: '.tiny_imagecms_sizeoriginal',
            sizeCustom: '.tiny_imagecms_sizecustom',
            properties: '.tiny_imagecms_properties',
        },
        styles: {
            responsive: 'img-fluid',
        },
    },
    EMBED: {
        actions: {
            submit: '.tiny_mediacms_submit',
            mediaBrowser: '.openmediacmsbrowser',
        },
        elements: {
            form: 'form.tiny_mediacms_form',
            source: '.tiny_mediacms_source',
            track: '.tiny_mediacms_track',
            mediaSource: '.tiny_mediacms_media_source',
            linkSource: '.tiny_mediacms_link_source',
            linkSize: '.tiny_mediacms_link_size',
            posterSource: '.tiny_mediacms_poster_source',
            posterSize: '.tiny_mediacms_poster_size',
            displayOptions: '.tiny_mediacms_display_options',
            name: '.tiny_mediacms_name_entry',
            title: '.tiny_mediacms_title_entry',
            url: '.tiny_mediacms_url_entry',
            width: '.tiny_mediacms_width_entry',
            height: '.tiny_mediacms_height_entry',
            trackSource: '.tiny_mediacms_track_source',
            trackKind: '.tiny_mediacms_track_kind_entry',
            trackLabel: '.tiny_mediacms_track_label_entry',
            trackLang: '.tiny_mediacms_track_lang_entry',
            trackDefault: '.tiny_mediacms_track_default',
            mediaControl: '.tiny_mediacms_controls',
            mediaAutoplay: '.tiny_mediacms_autoplay',
            mediaMute: '.tiny_mediacms_mute',
            mediaLoop: '.tiny_mediacms_loop',
            advancedSettings: '.tiny_mediacms_advancedsettings',
            linkTab: 'li[data-medium-type="link"]',
            videoTab: 'li[data-medium-type="video"]',
            audioTab: 'li[data-medium-type="audio"]',
            linkPane: '.tab-pane[data-medium-type="link"]',
            videoPane: '.tab-pane[data-medium-type="video"]',
            audioPane: '.tab-pane[data-medium-type="audio"]',
            trackSubtitlesTab: 'li[data-track-kind="subtitles"]',
            trackCaptionsTab: 'li[data-track-kind="captions"]',
            trackDescriptionsTab: 'li[data-track-kind="descriptions"]',
            trackChaptersTab: 'li[data-track-kind="chapters"]',
            trackMetadataTab: 'li[data-track-kind="metadata"]',
            trackSubtitlesPane: '.tab-pane[data-track-kind="subtitles"]',
            trackCaptionsPane: '.tab-pane[data-track-kind="captions"]',
            trackDescriptionsPane: '.tab-pane[data-track-kind="descriptions"]',
            trackChaptersPane: '.tab-pane[data-track-kind="chapters"]',
            trackMetadataPane: '.tab-pane[data-track-kind="metadata"]',
        },
        mediaTypes: {
            link: 'LINK',
            video: 'VIDEO',
            audio: 'AUDIO',
        },
        trackKinds: {
            subtitles: 'SUBTITLES',
            captions: 'CAPTIONS',
            descriptions: 'DESCRIPTIONS',
            chapters: 'CHAPTERS',
            metadata: 'METADATA',
        },
    },
    IFRAME: {
        actions: {
            remove: '[data-action="remove"]',
        },
        elements: {
            form: 'form.tiny_iframecms_form',
            url: '.tiny_iframecms_url',
            urlWarning: '.tiny_iframecms_url_warning',
            showTitle: '.tiny_iframecms_showtitle',
            linkTitle: '.tiny_iframecms_linktitle',
            showRelated: '.tiny_iframecms_showrelated',
            showUserAvatar: '.tiny_iframecms_showuseravatar',
            responsive: '.tiny_iframecms_responsive',
            startAt: '.tiny_iframecms_startat',
            startAtEnabled: '.tiny_iframecms_startat_enabled',
            aspectRatio: '.tiny_iframecms_aspectratio',
            width: '.tiny_iframecms_width',
            height: '.tiny_iframecms_height',
            preview: '.tiny_iframecms_preview',
            previewContainer: '.tiny_iframecms_preview_container',
            // Tab elements
            tabs: '.tiny_iframecms_tabs',
            tabUrlBtn: '.tiny_iframecms_tab_url_btn',
            tabIframeLibraryBtn: '.tiny_iframecms_tab_iframe_library_btn',
            paneUrl: '.tiny_iframecms_pane_url',
            paneIframeLibrary: '.tiny_iframecms_pane_iframe_library',
            // Iframe library elements
            iframeLibraryContainer: '.tiny_iframecms_iframe_library_container',
            iframeLibraryPlaceholder:
                '.tiny_iframecms_iframe_library_placeholder',
            iframeLibraryLoading: '.tiny_iframecms_iframe_library_loading',
            iframeLibraryFrame: '.tiny_iframecms_iframe_library_frame',
        },
        aspectRatios: {
            '16:9': { width: 560, height: 315 },
            '4:3': { width: 560, height: 420 },
            '1:1': { width: 400, height: 400 },
            custom: null,
        },
    },
};
