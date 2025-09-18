import React, { useEffect, useRef, useMemo } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// Import the separated components
import EndScreenOverlay from '../overlays/EndScreenOverlay';
import AutoplayCountdownOverlay from '../overlays/AutoplayCountdownOverlay';
import ChapterMarkers from '../markers/ChapterMarkers';
import SpritePreview from '../markers/SpritePreview';
import NextVideoButton from '../controls/NextVideoButton';
import AutoplayToggleButton from '../controls/AutoplayToggleButton';
import CustomRemainingTime from '../controls/CustomRemainingTime';
import CustomChaptersOverlay from '../controls/CustomChaptersOverlay';
import CustomSettingsMenu from '../controls/CustomSettingsMenu';
import SeekIndicator from '../controls/SeekIndicator';
import UserPreferences from '../../utils/UserPreferences';

function VideoJSPlayer() {
    const videoRef = useRef(null);
    const playerRef = useRef(null); // Track the player instance
    const userPreferences = useRef(new UserPreferences()); // User preferences instance
    const customComponents = useRef({}); // Store custom components for cleanup

    const isDevelopment =
        process.env.NODE_ENV === 'development' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname.includes('vercel.app');
    console.log('isDevelopment', isDevelopment);
    console.log('window.location.hostname', window.location.hostname);

    // Safely access window.MEDIA_DATA with fallback using useMemo
    const mediaData = useMemo(
        () =>
            typeof window !== 'undefined' && window.MEDIA_DATA
                ? window.MEDIA_DATA
                : {
                      data: {
                          // COMMON
                          poster_url:
                              'https://demo.mediacms.io/media/original/thumbnails/user/markos/7dedcb56bde9463dbc0766768a99be0f_C8E5GFY.20250605_110647.mp4.jpg',
                          __chapter_data: [
                              { startTime: 0, endTime: 4, text: 'A1 test' },
                              { startTime: 5, endTime: 10, text: 'A2 of Marine Life' },
                              { startTime: 10, endTime: 15, text: 'A3 Reef Ecosystems' },
                          ],
                          related_media: [
                              {
                                  friendly_token: 'dktSm7iEo',
                                  url: 'https://demo.mediacms.io/view?m=dktSm7iEo',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/dktSm7iEo',
                                  user: 'markos',
                                  title: 'Sed aliquam consectetur dolor.',
                                  description:
                                      'Voluptatem quiquia dolorem labore dolore. Dolor etincidunt non etincidunt etincidunt sed. Adipisci eius etincidunt dolor magnam dolor. Dolorem porro etincidunt quaerat. Eius magnam dolorem tempora voluptatem labore. Dolore sed porro ipsum aliquam numquam non dolor. Labore aliquam labore dolor sit quisquam quaerat.',
                                  add_date: '2024-10-02T05:28:18.784775-04:00',
                                  views: 803,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 12,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/8624c4080afc46eba8b4f27a81eccf27.Birch.mp4_myELKan.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/8624c4080afc46eba8b4f27a81eccf27.tmpb7kerjb2.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 13,
                                  dislikes: 2,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: '124.5MB',
                              },
                              {
                                  friendly_token: 'zK2nirNLC',
                                  url: 'https://demo.mediacms.io/view?m=zK2nirNLC',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/zK2nirNLC',
                                  user: 'markos',
                                  title: 'University of Copenhagen Mærsk Tower',
                                  description: 'https://maps.app.goo.gl/ewVAGgqdrb1MD1sF7',
                                  add_date: '2025-06-06T00:00:00-04:00',
                                  views: 632,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 27,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/6497e960081b4b8abddcf4cbdf2bf4eb_38hpsj6.20250604_080632.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/6497e960081b4b8abddcf4cbdf2bf4eb.tmpjc3_yx1g.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 13,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '58.8MB',
                              },
                              {
                                  friendly_token: 'o7lKzt664',
                                  url: 'https://demo.mediacms.io/view?m=o7lKzt664',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/o7lKzt664',
                                  user: 'markos',
                                  title: 'Magnam velit ipsum quisquam amet magnam etincidunt.',
                                  description:
                                      'Magnam sed quisquam quiquia dolor est. Tempora sit etincidunt dolor dolore magnam. Numquam non dolorem eius aliquam non. Consectetur sit consectetur dolor quaerat est. Consectetur amet dolor ut dolor ipsum. Mpla mpla antalya',
                                  add_date: '2024-10-02T05:35:10-04:00',
                                  views: 1378,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 6,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/95eb092b57c24f52b75691fa382d16bb_Bg99UmX.20240526_123312.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/95eb092b57c24f52b75691fa382d16bb.tmpthrejon6.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 22,
                                  dislikes: 3,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: '13.0MB',
                              },
                              {
                                  friendly_token: 'mFELnYWko',
                                  url: 'https://demo.mediacms.io/view?m=mFELnYWko',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/mFELnYWko',
                                  user: 'markos',
                                  title: 'kubectl-cheat-sheet.pdf',
                                  description: '',
                                  add_date: '2024-10-25T04:24:39-04:00',
                                  views: 1391,
                                  media_type: 'pdf',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url: null,
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 15,
                                  dislikes: 9,
                                  reported_times: 1,
                                  featured: false,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'ZLjVzLcCE',
                                  url: 'https://demo.mediacms.io/view?m=ZLjVzLcCE',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/ZLjVzLcCE',
                                  user: 'markos',
                                  title: 'Quaerat velit sed numquam ipsum magnam.',
                                  description:
                                      'Dolore numquam aliquam dolore modi modi. Dolor quaerat est voluptatem ut. Dolor eius tempora magnam etincidunt ipsum modi porro. Etincidunt consectetur est est sed ut. Porro neque sed dolorem dolore. Sed velit quisquam ipsum quisquam consectetur porro.',
                                  add_date: '2024-10-02T05:34:03.836032-04:00',
                                  views: 888,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/b5e8dea6a0a3477885db786f2e89fb51.IMG_20240324_141309.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 6,
                                  dislikes: 2,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'bvMsRGRxE',
                                  url: 'https://demo.mediacms.io/view?m=bvMsRGRxE',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/bvMsRGRxE',
                                  user: 'markos',
                                  title: 'Numquam quisquam amet dolore quisquam ipsum ut.',
                                  description:
                                      'Modi numquam magnam numquam eius labore est dolorem. Voluptatem etincidunt neque ipsum non. Non tempora etincidunt magnam etincidunt. Sed dolor dolore amet quiquia porro sit non. Tempora etincidunt modi sed etincidunt est aliquam. Magnam aliquam ipsum modi dolore. Etincidunt sit eius dolore sed neque porro labore. Eius etincidunt dolorem est quiquia amet aliquam. Quaerat velit labore est dolor.',
                                  add_date: '2024-10-02T05:33:02.972212-04:00',
                                  views: 773,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/b9717b02cd8b45ec91d07470933810db.IMG_20231226_140530.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 10,
                                  dislikes: 2,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'lsNWKKq5N',
                                  url: 'https://demo.mediacms.io/view?m=lsNWKKq5N',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/lsNWKKq5N',
                                  user: 'markos',
                                  title: 'Quaerat quaerat numquam porro dolor',
                                  description:
                                      'Modi dolorem non non neque dolor magnam quisquam. Magnam amet magnam porro. Dolorem quiquia dolorem etincidunt labore ipsum aliquam sed. Eius sed eius sit consectetur quaerat. Voluptatem dolorem porro etincidunt labore aliquam quisquam. Adipisci quisquam dolorem dolorem magnam dolorem ipsum. Consectetur quaerat magnam sit voluptatem.',
                                  add_date: '2024-10-02T00:00:00-04:00',
                                  views: 666,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 13,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/58008fdc69d34c229a85f29076004639.VID_20230917_094453.mp4_Pe8a1dv.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/58008fdc69d34c229a85f29076004639.tmp85b478_u.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 10,
                                  dislikes: 3,
                                  reported_times: 1,
                                  featured: true,
                                  user_featured: false,
                                  size: '35.0MB',
                              },
                              {
                                  friendly_token: 'tsgNaSe6E',
                                  url: 'https://demo.mediacms.io/view?m=tsgNaSe6E',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/tsgNaSe6E',
                                  user: 'markos',
                                  title: 'Magnam ipsum eius numquam quiquia non adipisci.',
                                  description:
                                      'Adipisci labore dolorem ipsum quaerat non dolore ut. Velit porro neque non consectetur neque neque. Ut sit tempora tempora. Ipsum ut velit neque. Quaerat labore amet porro porro amet tempora. Sed voluptatem est amet quisquam sed numquam velit. Est ipsum non labore. Consectetur amet neque consectetur dolor ipsum.',
                                  add_date: '2024-10-02T05:32:46.253917-04:00',
                                  views: 824,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/0405f61e131f431793644be3742fcc1a.20240628_235522.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 12,
                                  dislikes: 3,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'f9xqzbbJE',
                                  url: 'https://demo.mediacms.io/view?m=f9xqzbbJE',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/f9xqzbbJE',
                                  user: 'markos',
                                  title: 'Magnam quaerat numquam modi dolore sed amet.',
                                  description:
                                      'Non non voluptatem neque velit labore. Eius labore non aliquam quisquam adipisci neque. Aliquam ipsum sed ipsum quisquam. Sit quaerat sed dolore non tempora. Ipsum sed labore dolore consectetur. Modi non quisquam sed ut ut dolor quaerat.',
                                  add_date: '2024-10-02T05:34:18.498303-04:00',
                                  views: 844,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/369f44b14f944941881a20e8d5285e78.IMG_20240324_151737.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 3,
                                  dislikes: 1,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'DE3KByBeo',
                                  url: 'https://demo.mediacms.io/view?m=DE3KByBeo',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/DE3KByBeo',
                                  user: 'markos',
                                  title: 'Kastania Evrytanias, Central Greece',
                                  description: '',
                                  add_date: '2025-05-19T00:00:00-04:00',
                                  views: 272,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 29,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/58b35efa3aca454196227c0eb5e2ca75_pkgSAK2.20250517_101207.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/58b35efa3aca454196227c0eb5e2ca75.tmpsw6vmsfo.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 6,
                                  dislikes: 2,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '62.0MB',
                              },
                              {
                                  friendly_token: 'M8ktwf8kF',
                                  url: 'https://demo.mediacms.io/view?m=M8ktwf8kF',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/M8ktwf8kF',
                                  user: 'markos',
                                  title: 'Quaerat voluptatem quisquam neque velit neque.',
                                  description:
                                      'Aliquam ipsum quisquam dolor. Modi quisquam neque ut ipsum amet. Tempora quaerat ipsum aliquam velit velit porro est. Consectetur neque eius quisquam porro amet sit neque. Modi voluptatem neque modi. Ipsum aliquam labore quaerat.',
                                  add_date: '2024-10-02T05:34:32.027708-04:00',
                                  views: 852,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/48a682227b544388a1b547736668d0ad.IMG_20240324_151743.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 7,
                                  dislikes: 2,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 's2qAmRTJ9',
                                  url: 'https://demo.mediacms.io/view?m=s2qAmRTJ9',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/s2qAmRTJ9',
                                  user: 'markos',
                                  title: 'Labore neque ipsum labore modi tempora aliquam neque.',
                                  description:
                                      'Eius voluptatem aliquam sit sit ipsum consectetur. Dolorem velit amet modi. Porro quisquam velit neque dolorem. Dolorem modi quiquia aliquam. Numquam est magnam non numquam modi quisquam est. Sit velit ut labore sit dolore velit modi. Aliquam modi dolorem ut.',
                                  add_date: '2024-10-02T05:34:27.197596-04:00',
                                  views: 779,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/2b786916111947e3ba960d7146ae0424.IMG_20230708_133437.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 16,
                                  dislikes: 2,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: '8pWsxkOS5',
                                  url: 'https://demo.mediacms.io/view?m=8pWsxkOS5',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/8pWsxkOS5',
                                  user: 'markos',
                                  title: 'Kastania Evrytanias, Central Greece',
                                  description: '',
                                  add_date: '2025-05-19T00:00:00-04:00',
                                  views: 321,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 47,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/d970760faf5745b4b3d0d0cff2b95d86_cvyjd5y.20250517_140535.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/d970760faf5745b4b3d0d0cff2b95d86.tmp3vtt3uip.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 5,
                                  dislikes: 2,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '101.2MB',
                              },
                              {
                                  friendly_token: 'swcx8A2h1',
                                  url: 'https://demo.mediacms.io/view?m=swcx8A2h1',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/swcx8A2h1',
                                  user: 'markos',
                                  title: 'Etincidunt dolore eius ut non numquam dolore dolorem.',
                                  description:
                                      'Etincidunt amet dolorem quisquam tempora. Dolorem dolor modi sit modi labore sit. Labore est sed non numquam. Porro non quaerat dolorem porro tempora sit. Ut neque est etincidunt velit eius. Etincidunt aliquam adipisci sed quiquia modi. Adipisci non sed adipisci velit.',
                                  add_date: '2024-10-02T05:38:43-04:00',
                                  views: 7973,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 31,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/fe4933d67b884d4da507dd60e77f7438.VID_20200909_141053.mp4_bU90dbl.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/fe4933d67b884d4da507dd60e77f7438.tmpdd72kiwh.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 230,
                                  dislikes: 62,
                                  reported_times: 1,
                                  featured: true,
                                  user_featured: false,
                                  size: '65.9MB',
                              },
                              {
                                  friendly_token: 'rNefa4WtV',
                                  url: 'https://demo.mediacms.io/view?m=rNefa4WtV',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/rNefa4WtV',
                                  user: 'markos',
                                  title: 'Quaerat modi non eius.',
                                  description:
                                      'Quisquam ut dolorem dolorem quisquam dolore. Non modi etincidunt labore sit quisquam. Sed neque quaerat quisquam voluptatem. Numquam labore neque etincidunt. Magnam etincidunt porro adipisci.',
                                  add_date: '2024-10-02T05:36:46.062913-04:00',
                                  views: 2683,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/ca0e3af507c64fc5995b9d97e4a8c779.20240527_091011.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 45,
                                  dislikes: 16,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'LP09dv0mx',
                                  url: 'https://demo.mediacms.io/view?m=LP09dv0mx',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/LP09dv0mx',
                                  user: 'markos',
                                  title: 'Est ipsum non etincidunt voluptatem adipisci labore.',
                                  description:
                                      'Est sit voluptatem numquam ut etincidunt. Adipisci sed dolor voluptatem labore. Quiquia est sit eius eius labore velit. Tempora ut tempora neque. Ipsum eius sit labore amet dolorem non non. Quiquia velit amet eius sit ut ut voluptatem. Quiquia sit ut ipsum ipsum neque. Amet etincidunt aliquam consectetur voluptatem sed etincidunt quiquia. Sit eius dolore magnam sed velit consectetur. Etincidunt amet numquam sit porro.',
                                  add_date: '2024-10-02T05:31:41.087014-04:00',
                                  views: 711,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 26,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/980decd203f245bbb3723cba73a94a11.VID_20230813_104846.mp4_3rwZtxQ.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/980decd203f245bbb3723cba73a94a11.tmpmddawiqe.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 11,
                                  dislikes: 3,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: '66.4MB',
                              },
                              {
                                  friendly_token: 'just_somethi',
                                  url: 'https://demo.mediacms.io/view?m=just_somethi',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/just_somethi',
                                  user: 'markos',
                                  title: 'Sit consectetur dolore numquam.',
                                  description:
                                      'Consectetur adipisci neque neque tempora. Amet quiquia ut labore non sit. Dolor aliquam quiquia adipisci dolor dolorem quiquia. Dolore porro modi labore quisquam adipisci numquam non. Dolor consectetur ut est neque.',
                                  add_date: '2024-10-02T00:00:00-04:00',
                                  views: 1288,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/7aaa65ac24224fe3a768aa6b7a723b58.20240527_090952.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 28,
                                  dislikes: 3,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'PbsYTGEol',
                                  url: 'https://demo.mediacms.io/view?m=PbsYTGEol',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/PbsYTGEol',
                                  user: 'markos',
                                  title: 'Voluptatem porro neque tempora dolorem quiquia est dolor.',
                                  description:
                                      'Labore aliquam dolorem quiquia est ipsum quiquia. Sed est amet non ipsum. Labore etincidunt etincidunt quiquia amet tempora tempora. Aliquam velit ipsum consectetur. Ipsum labore quaerat quiquia aliquam magnam. Quisquam ut velit velit dolorem dolorem. Aliquam quaerat tempora quisquam ut voluptatem voluptatem quiquia.',
                                  add_date: '2024-10-02T05:33:48.024941-04:00',
                                  views: 785,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/f01faaa2e7be4c9aa7598ab755898a09.IMG_20240324_141304.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 14,
                                  dislikes: 3,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'mkpfy31bY',
                                  url: 'https://demo.mediacms.io/view?m=mkpfy31bY',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/mkpfy31bY',
                                  user: 'markos',
                                  title: 'Kastania Evrytanias, Central Greece',
                                  description: '',
                                  add_date: '2025-05-19T00:00:00-04:00',
                                  views: 212,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/c2d40995ce7640e3b8cbfee1a2890c51.20250517_183010.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 2,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'w2lYWaW8e',
                                  url: 'https://demo.mediacms.io/view?m=w2lYWaW8e',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/w2lYWaW8e',
                                  user: 'markos',
                                  title: 'Plane view approaching Copenhagen airport',
                                  description: 'plane view',
                                  add_date: '2025-06-06T00:00:00-04:00',
                                  views: 664,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 50,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/e84f1caf58f44d838456625ffe96173b_LQCWsAe.20250603_110810.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/e84f1caf58f44d838456625ffe96173b.tmp7hm26nok.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 13,
                                  dislikes: 3,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '108.8MB',
                              },
                              {
                                  friendly_token: 'qLMrr970w',
                                  url: 'https://demo.mediacms.io/view?m=qLMrr970w',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/qLMrr970w',
                                  user: 'markos',
                                  title: 'Kastania Evrytanias, Central Greece',
                                  description: '',
                                  add_date: '2025-05-19T00:00:00-04:00',
                                  views: 215,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/558f53227cc5418c9b7d66a3740fe2f8.20250517_082340.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 2,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'elygiagorgechania',
                                  url: 'https://demo.mediacms.io/view?m=elygiagorgechania',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/elygiagorgechania',
                                  user: 'markos',
                                  title: 'Exit of Elygia Gorge, Chania, Crete',
                                  description:
                                      'This video is from the exit of Elygia Gorge, Chania, Crete, where it meets the sea!',
                                  add_date: '2025-06-15T00:00:00-04:00',
                                  views: 688,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 29,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/c1ab03cab3bb46b5854a5e217cfe3013_Nete6ao.VID_20230813_144422.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/c1ab03cab3bb46b5854a5e217cfe3013.tmpjlxkhy0i.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 6,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '75.6MB',
                              },
                              {
                                  friendly_token: 'OxO6BMVZb',
                                  url: 'https://demo.mediacms.io/view?m=OxO6BMVZb',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/OxO6BMVZb',
                                  user: 'markos',
                                  title: 'Eius velit etincidunt amet tempora ut.',
                                  description:
                                      'Aliquam eius adipisci adipisci. Quaerat dolor quaerat magnam. Amet ut quaerat sit sed magnam quaerat neque. Neque velit porro labore modi ut ut ut. Non quaerat consectetur dolor eius voluptatem. Quisquam modi amet sed magnam eius. Quisquam dolor dolore aliquam quisquam neque dolore. Quisquam dolor ut ipsum quiquia. Voluptatem quisquam neque quisquam quiquia adipisci. Est modi eius est etincidunt numquam quisquam ut.',
                                  add_date: '2024-10-02T05:34:33.461809-04:00',
                                  views: 1023,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/13299e6838e143fda776bacf7081484e.IMG_20230820_200357.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 16,
                                  dislikes: 4,
                                  reported_times: 1,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'hDHXkdwy0',
                                  url: 'https://demo.mediacms.io/view?m=hDHXkdwy0',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/hDHXkdwy0',
                                  user: 'markos',
                                  title: 'Modi tempora est quaerat numquam',
                                  description:
                                      'Magnam voluptatem est magnam dolorem. Etincidunt quiquia aliquam velit tempora porro. Magnam neque eius eius etincidunt ut ipsum. Adipisci labore quaerat modi. Ipsum modi quaerat consectetur est non quaerat sed. Neque ut modi adipisci dolore adipisci dolor ut. Dolor tempora adipisci quisquam. Dolorem consectetur velit adipisci etincidunt voluptatem. Non quisquam voluptatem adipisci. Voluptatem est aliquam porro labore non.',
                                  add_date: '2024-10-02T05:36:42-04:00',
                                  views: 1679,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 24,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/a3c5642e13624149897f193981ebccf3.VID_20210307_111552.mp4_uEHcD0C.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/a3c5642e13624149897f193981ebccf3.tmpempjz6eh.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 32,
                                  dislikes: 12,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: '52.4MB',
                              },
                              {
                                  friendly_token: 'vDKrrkIVc',
                                  url: 'https://demo.mediacms.io/view?m=vDKrrkIVc',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/vDKrrkIVc',
                                  user: 'markos',
                                  title: 'Kastania Evrytanias, Central Greece',
                                  description: '',
                                  add_date: '2025-05-19T00:00:00-04:00',
                                  views: 228,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/50f296fd588240d2ad80a6fb9a5ce7d6.20250518_093811.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 6,
                                  dislikes: 1,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: '4h3nsvXb1',
                                  url: 'https://demo.mediacms.io/view?m=4h3nsvXb1',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/4h3nsvXb1',
                                  user: 'markos',
                                  title: 'Dolor voluptatem non quiquia consectetur est numquam sed.',
                                  description:
                                      'Aliquam ipsum etincidunt neque ipsum. Consectetur ut non velit quaerat porro. Eius ut voluptatem velit aliquam dolor. Non etincidunt est quaerat quaerat. Quiquia est non ipsum numquam. Quisquam amet magnam sed eius quaerat. Magnam porro dolorem dolor. Numquam numquam quaerat est. Quisquam tempora ut quaerat est.',
                                  add_date: '2024-10-02T05:32:43.865153-04:00',
                                  views: 981,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/baca04d3009d4daba302919c25b4325e.IMG_1936.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 16,
                                  dislikes: 1,
                                  reported_times: 1,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'HdUU8boQP',
                                  url: 'https://demo.mediacms.io/view?m=HdUU8boQP',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/HdUU8boQP',
                                  user: 'markos',
                                  title: 'Consectetur adipisci porro quiquia ipsum aliquam etincidunt ut.',
                                  description:
                                      'Consectetur numquam eius amet est dolor neque modi. Consectetur est amet voluptatem quaerat numquam sed. Porro tempora ut ut. Non dolor amet sit. Labore porro neque dolorem numquam dolore ut. Modi sed adipisci dolore. Numquam magnam est tempora. Neque aliquam labore dolor ipsum porro.',
                                  add_date: '2024-10-02T05:34:13.171233-04:00',
                                  views: 795,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/e1df55b16b3b456ea88bf7feb7db6051.IMG_20230708_120717.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 8,
                                  dislikes: 3,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'vy5PTWJZ6',
                                  url: 'https://demo.mediacms.io/view?m=vy5PTWJZ6',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/vy5PTWJZ6',
                                  user: 'markos',
                                  title: 'Non etincidunt numquam velit.',
                                  description:
                                      'Etincidunt ut velit ipsum. Labore modi magnam eius quisquam. Dolorem magnam sit quiquia non dolorem tempora. Aliquam labore sed quaerat magnam est aliquam porro. Adipisci adipisci aliquam tempora ut aliquam eius amet. Est etincidunt quiquia dolorem amet consectetur. Ipsum neque dolorem dolore etincidunt.\r\n',
                                  add_date: '2024-10-02T05:33:26-04:00',
                                  views: 713,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/7a9ec6be9ce24a569a246c61d9b03690.IMG_20220528_135153.jpg.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 9,
                                  dislikes: 1,
                                  reported_times: 1,
                                  featured: true,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'TAdmfDUlu',
                                  url: 'https://demo.mediacms.io/view?m=TAdmfDUlu',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/TAdmfDUlu',
                                  user: 'markos',
                                  title: 'Sed neque adipisci dolorem sed.',
                                  description:
                                      'Quiquia ipsum velit amet. Consectetur porro numquam numquam magnam adipisci dolore. Dolor ipsum ut ut consectetur modi labore. Neque est non amet. Sit quiquia quisquam dolorem. Modi dolore modi dolorem ipsum ipsum. Neque modi modi dolorem quisquam numquam modi quaerat.\r\n\r\nbest scenes at 00:00:12 and 00:14',
                                  add_date: '2024-10-02T00:00:00-04:00',
                                  views: 821,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 30,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/f371a6b2c157451d924bc4f612bf2667_Kh4GigX.Pexels_Videos_2079217_1.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/f371a6b2c157451d924bc4f612bf2667.tmp2jqxf9sr.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 20,
                                  dislikes: 4,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: '90.0MB',
                              },
                              {
                                  friendly_token: 'kHd7EKAVH',
                                  url: 'https://demo.mediacms.io/view?m=kHd7EKAVH',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/kHd7EKAVH',
                                  user: 'markos',
                                  title: 'Tempora magnam velit ipsum neque aliquam adipisci.',
                                  description:
                                      'Porro dolorem eius sed non eius. Non dolor quiquia dolorem. Modi ut dolor aliquam dolor. Non est dolorem amet consectetur neque quiquia numquam. Aliquam adipisci quiquia voluptatem ipsum quisquam magnam adipisci. Sit adipisci dolor consectetur dolor quaerat. Magnam ut modi tempora. Modi non ipsum tempora etincidunt porro. Ut ut dolor ipsum non consectetur neque quiquia.',
                                  add_date: '2024-10-02T05:33:57.651288-04:00',
                                  views: 1051,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 54,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/9d3b8425eb08400fa08d90f988bc5ff4.VID_20220821_110509.mp4_JzAol5C.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/9d3b8425eb08400fa08d90f988bc5ff4.tmpwlnjum5k.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 26,
                                  dislikes: 8,
                                  reported_times: 1,
                                  featured: true,
                                  user_featured: false,
                                  size: '136.8MB',
                              },
                              {
                                  friendly_token: 'Otbc37Yj4',
                                  url: 'https://demo.mediacms.io/view?m=Otbc37Yj4',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/Otbc37Yj4',
                                  user: 'markos',
                                  title: 'Kastania Evrytanias, Central Greece',
                                  description: '',
                                  add_date: '2025-05-19T00:00:00-04:00',
                                  views: 311,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 25,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/dd3af0e1dece43b490bbafc9400a407a_YtfxVr4.20250517_105515.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/dd3af0e1dece43b490bbafc9400a407a.tmpl3iqzl10.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 12,
                                  dislikes: 1,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '54.3MB',
                              },
                              {
                                  friendly_token: 'a1BP6J0fM',
                                  url: 'https://demo.mediacms.io/view?m=a1BP6J0fM',
                                  api_url: 'https://demo.mediacms.io/api/v1/media/a1BP6J0fM',
                                  user: 'markos',
                                  title: 'Velit sed magnam quiquia amet.',
                                  description:
                                      'Numquam quiquia numquam ut etincidunt numquam. Dolore ut sit eius dolorem sed. Neque porro modi dolor ipsum amet dolore quisquam. Ipsum dolore dolor voluptatem eius quiquia etincidunt. Dolore etincidunt amet velit amet ipsum ut. Aliquam etincidunt consectetur est. Consectetur non quiquia voluptatem velit sed quisquam.',
                                  add_date: '2024-10-02T05:35:15.434023-04:00',
                                  views: 997,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 11,
                                  thumbnail_url:
                                      'https://demo.mediacms.io/media/original/thumbnails/user/markos/32e2cf3ff5fe498da93251034e977d9c.20240527_090548.mp4_qiF5S9H.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      'https://demo.mediacms.io/media/encoded/1/markos/32e2cf3ff5fe498da93251034e977d9c.tmpheuxmj3y.gif',
                                  author_name: 'Markos Gogoulos',
                                  author_profile: 'https://demo.mediacms.io/user/markos/',
                                  author_thumbnail: 'https://demo.mediacms.io/media/userlogos/2024/10/02/markos.jpeg',
                                  encoding_status: 'success',
                                  likes: 14,
                                  dislikes: 1,
                                  reported_times: 0,
                                  featured: true,
                                  user_featured: false,
                                  size: '3.5MB',
                              },
                          ],

                          // VIDEO
                          media_type: 'video',
                          original_media_url:
                              'https://demo.mediacms.io/media/original/user/markos/7dedcb56bde9463dbc0766768a99be0f.20250605_110647.mp4',
                          hls_info: {
                              master_file:
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/master.m3u8',
                              '1080_iframe':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-1/iframes.m3u8',
                              '720_iframe':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-2/iframes.m3u8',
                              '360_iframe':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-3/iframes.m3u8',
                              '240_iframe':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-4/iframes.m3u8',
                              '480_iframe':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-5/iframes.m3u8',
                              '1080_playlist':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-1/stream.m3u8',
                              '720_playlist':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-2/stream.m3u8',
                              '360_playlist':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-3/stream.m3u8',
                              '240_playlist':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-4/stream.m3u8',
                              '480_playlist':
                                  'https://demo.mediacms.io/media/hls/7dedcb56bde9463dbc0766768a99be0f/media-5/stream.m3u8',
                          },
                          encodings_info: {
                              2160: {},
                              1440: {},
                              1080: {
                                  h264: {
                                      title: 'h264-1080',
                                      url: 'https://demo.mediacms.io/media/encoded/7/markos/7dedcb56bde9463dbc0766768a99be0f.7dedcb56bde9463dbc0766768a99be0f.20250605_110647.mp4.mp4',
                                      progress: 100,
                                      size: '31.4MB',
                                      encoding_id: 4688,
                                      status: 'success',
                                  },
                              },
                              720: {
                                  h264: {
                                      title: 'h264-720',
                                      url: 'https://demo.mediacms.io/media/encoded/10/markos/7dedcb56bde9463dbc0766768a99be0f.7dedcb56bde9463dbc0766768a99be0f.20250605_110647.mp4.mp4',
                                      progress: 100,
                                      size: '17.7MB',
                                      encoding_id: 4687,
                                      status: 'success',
                                  },
                              },
                              480: {
                                  h264: {
                                      title: 'h264-480',
                                      url: 'https://demo.mediacms.io/media/encoded/13/markos/7dedcb56bde9463dbc0766768a99be0f.7dedcb56bde9463dbc0766768a99be0f.20250605_110647.mp4.mp4',
                                      progress: 100,
                                      size: '7.4MB',
                                      encoding_id: 4686,
                                      status: 'success',
                                  },
                              },
                              360: {
                                  h264: {
                                      title: 'h264-360',
                                      url: 'https://demo.mediacms.io/media/encoded/3/markos/7dedcb56bde9463dbc0766768a99be0f.7dedcb56bde9463dbc0766768a99be0f.20250605_110647.mp4.mp4',
                                      progress: 100,
                                      size: '4.0MB',
                                      encoding_id: 4685,
                                      status: 'success',
                                  },
                              },
                              240: {
                                  h264: {
                                      title: 'h264-240',
                                      url: 'https://demo.mediacms.io/media/encoded/2/markos/7dedcb56bde9463dbc0766768a99be0f.7dedcb56bde9463dbc0766768a99be0f.20250605_110647.mp4.mp4',
                                      progress: 100,
                                      size: '2.7MB',
                                      encoding_id: 4684,
                                      status: 'success',
                                  },
                              },
                              144: {},
                          },

                          // AUDIO
                          /*media_type: 'audio',
                          original_media_url:
                              'https://videojs.mediacms.io/media/original/user/markos/174be7a1ecb04850a6927a0af2887ccc.SizzlaHardGround.mp3',
                          hls_info: {},
                          encodings_info: {},*/
                      },

                      // other
                      previewSprite: {
                          url: 'https://demo.mediacms.io/media/original/thumbnails/user/markos/fe4933d67b884d4da507dd60e77f7438.VID_20200909_141053.mp4sprites.jpg',
                          frame: { width: 160, height: 90, seconds: 10 },
                      },
                      siteUrl: '',
                      nextLink: 'https://demo.mediacms.io/view?m=YjGJafibO',
                  },
        []
    );

    // Define chapters as JSON object
    // Note: The sample-chapters.vtt file is no longer needed as chapters are now loaded from this JSON
    // CONDITIONAL LOGIC:
    // - When chaptersData has content: Uses original ChapterMarkers with sprite preview
    // - When chaptersData is empty: Uses separate SpritePreview component
    // Toggle between these two lines to test both scenarios:
    const chaptersData =
        mediaData?.data?.chapter_data && mediaData?.data?.chapter_data.length > 0
            ? mediaData?.data?.chapter_data
            : isDevelopment
              ? [
                    { startTime: 0, endTime: 4, text: 'Introduction' },
                    { startTime: 5, endTime: 10, text: 'Overview of Marine Life' },
                    { startTime: 10, endTime: 15, text: 'Coral Reef Ecosystems' },
                    { startTime: 15, endTime: 20, text: 'Deep Sea Creatures' },
                    { startTime: 20, endTime: 30, text: 'Ocean Conservation' },
                    { startTime: 240, endTime: 320, text: 'Ocean Conservation' },
                    { startTime: 320, endTime: 400, text: 'Climate Change Impact' },
                    { startTime: 400, endTime: 480, text: 'Marine Protected Areas' },
                    { startTime: 480, endTime: 560, text: 'Sustainable Fishing' },
                    { startTime: 560, endTime: 640, text: 'Research Methods' },
                    { startTime: 640, endTime: 720, text: 'Future Challenges' },
                    { startTime: 720, endTime: 800, text: 'Conclusion' },
                    { startTime: 800, endTime: 880, text: 'Marine Biodiversity Hotspots' },
                    { startTime: 880, endTime: 960, text: 'Underwater Photography' },
                    { startTime: 960, endTime: 1040, text: 'Whale Migration Patterns' },
                    { startTime: 1040, endTime: 1120, text: 'Plastic Pollution Crisis' },
                    { startTime: 1120, endTime: 1200, text: 'Seagrass Meadows' },
                    { startTime: 1200, endTime: 1280, text: 'Ocean Acidification' },
                    { startTime: 1280, endTime: 1360, text: 'Marine Archaeology' },
                    { startTime: 1360, endTime: 1440, text: 'Tidal Pool Ecosystems' },
                    { startTime: 1440, endTime: 1520, text: 'Commercial Aquaculture' },
                    { startTime: 1520, endTime: 1600, text: 'Ocean Exploration Technology' },
                ]
              : [];
    // const chaptersData = []; // NO CHAPTERS (uses separate SpritePreview)

    // Helper function to determine MIME type based on file extension or media type
    const getMimeType = (url, mediaType) => {
        if (mediaType === 'audio') {
            if (url && url.toLowerCase().includes('.mp3')) {
                return 'audio/mpeg';
            }
            if (url && url.toLowerCase().includes('.ogg')) {
                return 'audio/ogg';
            }
            if (url && url.toLowerCase().includes('.wav')) {
                return 'audio/wav';
            }
            if (url && url.toLowerCase().includes('.m4a')) {
                return 'audio/mp4';
            }
            // Default audio MIME type
            return 'audio/mpeg';
        }

        // Default to video/mp4 for video content
        if (url && url.toLowerCase().includes('.webm')) {
            return 'video/webm';
        }
        if (url && url.toLowerCase().includes('.ogg')) {
            return 'video/ogg';
        }

        // Default video MIME type
        return 'video/mp4';
    };

    // Get video data from mediaData
    const currentVideo = useMemo(() => {
        // Get video sources based on available data
        const getVideoSources = () => {
            // Check if HLS info is available and not empty
            if (mediaData.data?.hls_info && mediaData.data.hls_info.master_file) {
                // Use master file as the primary source (auto quality)
                return [
                    {
                        src: mediaData.siteUrl + mediaData.data.hls_info.master_file,
                        type: 'application/x-mpegURL', // HLS MIME type
                        label: 'Auto',
                    },
                ];
            }

            // Fallback to encoded qualities if available
            if (mediaData.data?.encodings_info) {
                const sources = [];
                const encodings = mediaData.data.encodings_info;

                // Get available qualities dynamically from encodings_info
                const availableQualities = Object.keys(encodings)
                    .filter((quality) => encodings[quality] && encodings[quality].h264 && encodings[quality].h264.url)
                    .sort((a, b) => parseInt(b) - parseInt(a)); // Sort descending (highest first)

                for (const quality of availableQualities) {
                    const sourceUrl = encodings[quality].h264.url;
                    sources.push({
                        src: sourceUrl,
                        type: getMimeType(sourceUrl, mediaData.data?.media_type),
                        label: `${quality}p`,
                    });
                }

                if (sources.length > 0) {
                    return sources;
                }
            }

            // Final fallback to original media URL or sample video
            if (mediaData.data?.original_media_url) {
                const sourceUrl = mediaData.data.original_media_url;
                return [
                    {
                        src: sourceUrl,
                        type: getMimeType(sourceUrl, mediaData.data?.media_type),
                    },
                ];
            }

            // Default sample video
            return [
                /* {
                    src: '/videos/sample-video.mp4',
                    type: 'video/mp4',
                }, */
                {
                    src: '/videos/sample-video.mp3',
                    type: 'audio/mpeg',
                },
            ];
        };

        return {
            id: mediaData.data?.friendly_token || 'default-video',
            title: mediaData.data?.title || 'Video',
            poster: mediaData.data?.poster_url ? mediaData.siteUrl + mediaData.data.poster_url : '',
            previewSprite: mediaData?.previewSprite || {},
            related_media: mediaData.data?.related_media || [],
            nextLink: mediaData?.nextLink || null,
            sources: getVideoSources(),
        };
    }, [mediaData]);

    // Compute available qualities. Prefer JSON (mediaData.data.qualities), otherwise build from encodings_info or current source.
    const availableQualities = useMemo(() => {
        // Generate desiredOrder dynamically based on available data
        const generateDesiredOrder = () => {
            const baseOrder = ['auto'];

            // Add qualities from encodings_info if available
            if (mediaData.data?.encodings_info) {
                const availableQualities = Object.keys(mediaData.data.encodings_info)
                    .filter((quality) => {
                        const encoding = mediaData.data.encodings_info[quality];
                        return encoding && encoding.h264 && encoding.h264.url;
                    })
                    .map((quality) => `${quality}p`)
                    .sort((a, b) => parseInt(a) - parseInt(b)); // Sort ascending

                baseOrder.push(...availableQualities);
            } else {
                // Fallback to standard order
                baseOrder.push('144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p');
            }

            return baseOrder;
        };

        const desiredOrder = generateDesiredOrder();

        const normalize = (arr) => {
            const norm = arr.map((q) => ({
                label: q.label || q.value || 'Auto',
                value: (q.value || q.label || 'auto').toString().toLowerCase(),
                src: q.src || q.url || q.href,
                type: q.type || getMimeType(q.src || q.url || q.href, mediaData.data?.media_type),
            }));

            // Only include qualities that have actual sources
            const validQualities = norm.filter((q) => q.src);

            // sort based on desired order
            const idx = (v) => {
                const i = desiredOrder.indexOf(String(v).toLowerCase());
                return i === -1 ? 999 : i;
            };
            validQualities.sort((a, b) => idx(a.value) - idx(b.value));
            return validQualities;
        };

        const jsonList = mediaData?.data?.qualities;
        if (Array.isArray(jsonList) && jsonList.length) {
            return normalize(jsonList);
        }

        // If HLS is available, build qualities from HLS playlists
        if (mediaData.data?.hls_info && mediaData.data.hls_info.master_file) {
            const hlsInfo = mediaData.data.hls_info;
            const qualities = [];

            // Add master file as auto quality
            qualities.push({
                label: 'Auto',
                value: 'auto',
                src: mediaData.siteUrl + hlsInfo.master_file,
                type: 'application/x-mpegURL',
            });

            // Add individual HLS playlists
            Object.keys(hlsInfo).forEach((key) => {
                if (key.endsWith('_playlist')) {
                    const quality = key.replace('_playlist', '');
                    qualities.push({
                        label: `${quality}p`,
                        value: `${quality}p`,
                        src: mediaData.siteUrl + hlsInfo[key],
                        type: 'application/x-mpegURL',
                    });
                }
            });

            return normalize(qualities);
        }

        // Build from encodings_info if available
        if (mediaData.data?.encodings_info) {
            const encodings = mediaData.data.encodings_info;
            const qualities = [];

            // Add auto quality first
            qualities.push({
                label: 'Auto',
                value: 'auto',
                src: null, // Will use the highest available quality
                type: getMimeType(null, mediaData.data?.media_type),
            });

            // Add available encoded qualities dynamically
            Object.keys(encodings).forEach((quality) => {
                if (encodings[quality] && encodings[quality].h264 && encodings[quality].h264.url) {
                    const sourceUrl = encodings[quality].h264.url;
                    qualities.push({
                        label: `${quality}p`,
                        value: `${quality}p`,
                        src: sourceUrl,
                        type: getMimeType(sourceUrl, mediaData.data?.media_type),
                    });
                }
            });

            if (qualities.length > 1) {
                // More than just auto
                return normalize(qualities);
            }
        }

        // Build from current source as fallback - only if we have a valid source
        const baseSrc = (currentVideo?.sources && currentVideo.sources[0]?.src) || null;
        const type =
            (currentVideo?.sources && currentVideo.sources[0]?.type) ||
            getMimeType(baseSrc, mediaData.data?.media_type);

        if (baseSrc) {
            const buildFromBase = [
                {
                    label: 'Auto',
                    value: 'auto',
                    src: baseSrc,
                    type,
                },
            ];
            return normalize(buildFromBase);
        }

        // Return empty array if no valid sources found
        return [];
    }, [mediaData, currentVideo]);

    // Get related videos from mediaData instead of static data
    const relatedVideos = useMemo(() => {
        if (!mediaData?.data?.related_media) {
            return [];
        }

        return mediaData.data.related_media
            .slice(0, 12) // Limit to maximum 12 items
            .map((media) => ({
                id: media.friendly_token,
                title: media.title,
                author: media.user || media.author_name || 'Unknown',
                views: `${media.views} views`,
                thumbnail: media.thumbnail_url || media.author_thumbnail,
                category: media.media_type,
                url: media.url,
                duration: media.duration,
                size: media.size,
                likes: media.likes,
                dislikes: media.dislikes,
                add_date: media.add_date,
                description: media.description,
            }));
    }, [mediaData]);

    // Demo array for testing purposes
    const demoSubtitleTracks = [
        {
            kind: 'subtitles',
            src: '/sample-subtitles.vtt',
            srclang: 'en',
            label: 'English Subtitles',
            default: false,
        },
        {
            kind: 'subtitles',
            src: '/sample-subtitles-greek.vtt',
            srclang: 'el',
            label: 'Greek Subtitles (Ελληνικά)',
            default: false,
        },
    ];
    // const demoSubtitleTracks = []; // NO Subtitles. TODO: hide it on production

    // Get subtitle tracks from backend response or fallback based on environment
    const backendSubtitles = mediaData?.data?.subtitles_info || (isDevelopment ? demoSubtitleTracks : []);
    const hasSubtitles = backendSubtitles.length > 0;
    const subtitleTracks = hasSubtitles
        ? backendSubtitles.map((track) => ({
              kind: 'subtitles',
              src: track.src,
              srclang: track.srclang,
              label: track.label,
              default: false,
          }))
        : [];

    console.log('mediaData?.data?.thumbnail_time', mediaData?.data?.thumbnail_time);
    console.log('mediaData?.data?.sprites_url', mediaData?.data?.sprites_url);
    console.log('mediaData', mediaData);

    // Function to navigate to next video
    const goToNextVideo = () => {
        console.log('Next video functionality disabled for single video mode');

        if (mediaData.onClickNextCallback && typeof mediaData.onClickNextCallback === 'function') {
            mediaData.onClickNextCallback();
        }
    };

    useEffect(() => {
        // Only initialize if we don't already have a player and element exists
        if (videoRef.current && !playerRef.current) {
            // Check if element is already a Video.js player
            if (videoRef.current.player) {
                // console.log('Video.js already initialized on this element');
                return;
            }

            const timer = setTimeout(() => {
                // Double-check that we still don't have a player and element exists
                if (!playerRef.current && videoRef.current && !videoRef.current.player) {
                    playerRef.current = videojs(videoRef.current, {
                        // ===== STANDARD <video> ELEMENT OPTIONS =====

                        // Controls whether player has user-interactive controls
                        controls: true,

                        // Player dimensions - removed for responsive design
                        // Autoplay behavior: Use 'muted' to comply with browser policies
                        autoplay: 'play', // Set to true/false to show poster image initially (true/false, play, muted, any)

                        // Start video over when it ends
                        loop: false,

                        // Start video muted
                        muted: false,

                        // Poster image URL displayed before video starts
                        poster: currentVideo.poster,

                        // Preload behavior: 'auto', 'metadata', 'none'
                        preload: 'auto',

                        // Video sources from current video
                        sources: currentVideo.sources,

                        // ===== VIDEO.JS-SPECIFIC OPTIONS =====

                        // Aspect ratio for fluid mode (e.g., '16:9', '4:3')
                        aspectRatio: '16:9',

                        // Hide all components except control bar for audio-only mode
                        audioOnlyMode: false,

                        // Display poster persistently for audio poster mode
                        audioPosterMode: mediaData.data?.media_type === 'audio',

                        // Prevent autoSetup for elements with data-setup attribute
                        autoSetup: undefined,

                        // Custom breakpoints for responsive design
                        breakpoints: {
                            tiny: 210,
                            xsmall: 320,
                            small: 425,
                            medium: 768,
                            large: 1440,
                            xlarge: 2560,
                            huge: 2561,
                        },

                        // Disable picture-in-picture mode
                        disablePictureInPicture: false,

                        // Enable document picture-in-picture API
                        enableDocumentPictureInPicture: false,

                        // Enable smooth seeking experience
                        enableSmoothSeeking: false,

                        // Use experimental SVG icons instead of font icons
                        experimentalSvgIcons: false,

                        // Make player scale to fit container
                        fluid: true,

                        // Fullscreen options
                        fullscreen: {
                            options: {
                                navigationUI: 'hide',
                            },
                        },

                        // Player element ID
                        id: undefined,

                        // Milliseconds of inactivity before user considered inactive (0 = never)
                        inactivityTimeout: 2000,

                        // Language code for player (e.g., 'en', 'es', 'fr')
                        language: 'en',

                        // Custom language definitions
                        languages: {},

                        // Enable live UI with progress bar and live edge button
                        liveui: false,

                        // Live tracker options
                        liveTracker: {
                            trackingThreshold: 20, // Seconds threshold for showing live UI
                            liveTolerance: 15, // Seconds tolerance for being "live"
                        },

                        // Force native controls for touch devices
                        nativeControlsForTouch: false,

                        // Ensures consistent autoplay behavior across browsers (prevents unexpected blocking or auto-play issues)
                        normalizeAutoplay: true,

                        // Custom message when media cannot be played
                        notSupportedMessage: undefined,

                        // Prevent title attributes on UI elements for better accessibility
                        noUITitleAttributes: false,

                        // Array of playback speed options (e.g., [0.5, 1, 1.5, 2])
                        playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],

                        // Prefer non-fullscreen playback on mobile
                        playsinline: true,

                        // Plugin initialization options
                        plugins: {},

                        // Control poster image display
                        posterImage: true,

                        // Prefer full window over fullscreen on some devices
                        preferFullWindow: false,

                        // Enable responsive player based on breakpoints
                        responsive: true,

                        // Restore element when player is disposed
                        restoreEl: false,

                        // Suppress "not supported" error until user interaction
                        suppressNotSupportedError: false,

                        // Allow techs to override poster
                        techCanOverridePoster: false,

                        // Order of preferred playback technologies
                        techOrder: ['html5'],

                        // User interaction options
                        userActions: {
                            // Enable/disable or customize click behavior
                            click: true,

                            // Enable/disable or customize double-click behavior (fullscreen toggle)
                            doubleClick: true,

                            // Hotkey configuration
                            hotkeys: {
                                // Function to override fullscreen key (default: 'f')
                                fullscreenKey: function (event) {
                                    return event.which === 70; // 'f' key
                                },

                                // Function to override mute key (default: 'm')
                                muteKey: function (event) {
                                    return event.which === 77; // 'm' key
                                },

                                // Function to override play/pause key (default: 'k' and Space)
                                playPauseKey: function (event) {
                                    return event.which === 75 || event.which === 32; // 'k' or Space
                                },

                                // Custom seek functions for arrow keys
                                seekForwardKey: function (event) {
                                    return event.which === 39; // Right arrow key
                                },

                                seekBackwardKey: function (event) {
                                    return event.which === 37; // Left arrow key
                                },
                            },
                        },

                        // URL to vtt.js for WebVTT support
                        'vtt.js': undefined,

                        // Spatial navigation for smart TV/remote control navigation
                        spatialNavigation: {
                            enabled: false,
                            horizontalSeek: false,
                        },

                        // ===== CONTROL BAR OPTIONS =====
                        controlBar: {
                            progressControl: {
                                seekBar: {
                                    timeTooltip: {
                                        // Customize TimeTooltip behavior
                                        displayNegative: false, // Don't show negative time
                                    },
                                },
                            },
                            // Remaining time display configuration
                            remainingTimeDisplay: false,
                            /* remainingTimeDisplay: {
                                displayNegative: true,
                            }, */

                            // Volume panel configuration
                            volumePanel: {
                                inline: true, // Display volume control inline
                                vertical: false, // Use horizontal volume slider
                            },

                            // Fullscreen toggle button
                            fullscreenToggle: true,

                            // Picture-in-picture toggle button
                            pictureInPictureToggle: true,

                            // Remove default playback speed dropdown from control bar
                            playbackRateMenuButton: false,

                            // Descriptions button
                            descriptionsButton: true,

                            // Subtitles (CC) button should be visible
                            subtitlesButton: hasSubtitles ? true : false,

                            // Captions button (keep disabled to avoid duplicate with subtitles)
                            captionsButton: false,

                            // Audio track button
                            audioTrackButton: true,

                            // Live display
                            liveDisplay: true,

                            // Seek to live button
                            seekToLive: true,

                            // Custom control spacer
                            customControlSpacer: true,

                            // Chapters menu button (moved after subtitles/captions)
                            chaptersButton: true,
                        },

                        // ===== HTML5 TECH OPTIONS =====
                        html5: {
                            // Force native controls for touch devices
                            nativeControlsForTouch: false,

                            // Use native audio tracks instead of emulated
                            nativeAudioTracks: true,

                            // Use native text tracks instead of emulated
                            nativeTextTracks: true,

                            // Use native video tracks instead of emulated
                            nativeVideoTracks: true,

                            // Preload text tracks
                            preloadTextTracks: true,
                        },

                        // ===== COMPONENT CONFIGURATION =====
                        children: [
                            'mediaLoader',
                            'posterImage',
                            'textTrackDisplay',
                            'loadingSpinner',
                            'bigPlayButton',
                            'liveTracker',
                            'controlBar',
                            'errorDisplay',
                            'textTrackSettings',
                            'resizeManager',
                        ],
                    });

                    // Event listeners
                    /* playerRef.current.on('ready', () => {
                        console.log('Video.js player ready');
                    }); */
                    playerRef.current.ready(() => {
                        // Apply user preferences to player
                        userPreferences.current.applyToPlayer(playerRef.current);

                        // Set up auto-save for preference changes
                        userPreferences.current.setupAutoSave(playerRef.current);

                        const setupMobilePlayPause = () => {
                            const playerEl = playerRef.current.el();
                            const videoEl = playerEl.querySelector('video');

                            if (videoEl) {
                                // Remove default touch handling that might interfere
                                videoEl.style.touchAction = 'manipulation';

                                // Add mobile-specific touch event handlers
                                let touchStartTime = 0;
                                let touchStartPos = { x: 0, y: 0 };

                                const handleTouchStart = (e) => {
                                    touchStartTime = Date.now();
                                    const touch = e.touches[0];
                                    touchStartPos = { x: touch.clientX, y: touch.clientY };
                                };

                                const handleTouchEnd = (e) => {
                                    const touchEndTime = Date.now();
                                    const touchDuration = touchEndTime - touchStartTime;

                                    // Only handle if it's a quick tap
                                    if (touchDuration < 500) {
                                        const touch = e.changedTouches[0];
                                        const touchEndPos = { x: touch.clientX, y: touch.clientY };
                                        const distance = Math.sqrt(
                                            Math.pow(touchEndPos.x - touchStartPos.x, 2) +
                                                Math.pow(touchEndPos.y - touchStartPos.y, 2)
                                        );

                                        // Only trigger if it's a tap (not a swipe)
                                        if (distance < 50) {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            if (playerRef.current.paused()) {
                                                playerRef.current.play();
                                            } else {
                                                playerRef.current.pause();
                                            }
                                        }
                                    }
                                };

                                videoEl.addEventListener('touchstart', handleTouchStart, { passive: true });
                                videoEl.addEventListener('touchend', handleTouchEnd, { passive: false });
                            }
                        };
                        setTimeout(setupMobilePlayPause, 100);

                        // Get control bar and its children
                        const controlBar = playerRef.current.getChild('controlBar');
                        const playToggle = controlBar.getChild('playToggle');
                        const currentTimeDisplay = controlBar.getChild('currentTimeDisplay');
                        const progressControl = controlBar.getChild('progressControl');
                        const seekBar = progressControl.getChild('seekBar');
                        const chaptersButton = controlBar.getChild('chaptersButton');
                        const fullscreenToggle = controlBar.getChild('fullscreenToggle');

                        // Auto-play video when navigating from next button
                        const urlParams = new URLSearchParams(window.location.search);
                        const hasVideoParam = urlParams.get('m');
                        if (hasVideoParam) {
                            // Small delay to ensure everything is loaded
                            setTimeout(() => {
                                if (playerRef.current && !playerRef.current.isDisposed()) {
                                    playerRef.current.play().catch((error) => {
                                        console.log('ℹ️ Browser prevented autoplay (normal behavior):', error.message);
                                    });
                                }
                            }, 100);
                        }

                        // BEGIN: Add subtitle tracks
                        if (hasSubtitles) {
                            try {
                                const savedLang = userPreferences.current.getPreference('subtitleLanguage');
                                const enabled = userPreferences.current.getPreference('subtitleEnabled');
                                const matchLang = (t, target) => {
                                    const tl = String(t.srclang || t.language || '').toLowerCase();
                                    const sl = String(target || '').toLowerCase();
                                    if (!tl || !sl) return false;
                                    return tl === sl || tl.startsWith(sl + '-') || sl.startsWith(tl + '-');
                                };
                                const tracksToAdd = subtitleTracks.map((t) => ({
                                    ...t,
                                    // Hint iOS by marking default on the matched track when enabled
                                    default: !!(enabled && savedLang && matchLang(t, savedLang)),
                                }));
                                tracksToAdd.forEach((track) => {
                                    playerRef.current.addRemoteTextTrack(track, false);
                                });
                            } catch (e) {
                                // Fallback: add as-is
                                subtitleTracks.forEach((track) => {
                                    playerRef.current.addRemoteTextTrack(track, false);
                                });
                            }
                        }

                        // Apply saved subtitle preference immediately and on key readiness events
                        userPreferences.current.applySubtitlePreference(playerRef.current);
                        playerRef.current.one('loadeddata', () =>
                            userPreferences.current.applySubtitlePreference(playerRef.current)
                        );
                        playerRef.current.one('canplay', () =>
                            userPreferences.current.applySubtitlePreference(playerRef.current)
                        );
                        // END: Add subtitle tracks

                        // BEGIN: Chapters Implementation
                        if (chaptersData && chaptersData.length > 0) {
                            const chaptersTrack = playerRef.current.addTextTrack('chapters', 'Chapters', 'en');
                            // Add cues to the chapters track
                            chaptersData.forEach((chapter) => {
                                const cue = new (window.VTTCue || window.TextTrackCue)(
                                    chapter.startTime,
                                    chapter.endTime,
                                    chapter.text
                                );
                                chaptersTrack.addCue(cue);
                            });
                        }
                        // END: Chapters Implementation

                        // Force chapter markers update after chapters are loaded
                        /* setTimeout(() => {
                            if (chapterMarkers && chapterMarkers.updateChapterMarkers) {
                                chapterMarkers.updateChapterMarkers();
                            }
                        }, 500); */

                        // BEGIN: Implement custom time display component
                        const customRemainingTime = new CustomRemainingTime(playerRef.current, {
                            displayNegative: false,
                            customPrefix: '',
                            customSuffix: '',
                        });

                        // Insert it in the desired position (e.g., after current time display)
                        if (currentTimeDisplay) {
                            const currentTimeIndex = controlBar.children().indexOf(currentTimeDisplay);
                            controlBar.addChild(customRemainingTime, {}, currentTimeIndex + 1);
                        } else {
                            controlBar.addChild(customRemainingTime, {}, 2);
                        }
                        // END: Implement custom time display component

                        // BEGIN: Implement custom next video button
                        if (mediaData?.nextLink || 1 === 1) {
                            // it seems that the nextLink is not always available, and it is need the this.player().trigger('nextVideo'); from NextVideoButton.js // TODO: remove the 1===1 and the mediaData?.nextLink
                            const nextVideoButton = new NextVideoButton(playerRef.current, {
                                nextLink: mediaData.nextLink,
                            });
                            const playToggleIndex = controlBar.children().indexOf(playToggle); // Insert it after play button
                            controlBar.addChild(nextVideoButton, {}, playToggleIndex + 1);
                        }
                        // END: Implement custom next video button

                        // BEGIN: Implement autoplay toggle button - simplified
                        try {
                            const autoplayToggleButton = new AutoplayToggleButton(playerRef.current, {
                                userPreferences: userPreferences.current,
                            });
                            // Add it after the play button
                            const fullscreenToggleIndex = controlBar.children().indexOf(fullscreenToggle);
                            controlBar.addChild(autoplayToggleButton, {}, fullscreenToggleIndex - 1);

                            // Store reference for later use
                            customComponents.current.autoplayToggleButton = autoplayToggleButton;

                            // Force update icon after adding to DOM to ensure correct display
                            setTimeout(() => {
                                autoplayToggleButton.updateIcon();
                                console.log('✓ Autoplay toggle button icon updated after DOM insertion');
                            }, 100);

                            console.log('✓ Autoplay toggle button added successfully');
                        } catch (error) {
                            console.error('✗ Failed to add autoplay toggle button:', error);
                        }
                        // END: Implement autoplay toggle button

                        // Remove duplicate captions button and move chapters to end
                        /*  const cleanupControls = () => {
                            // Log all current children for debugging
                            const allChildren = controlBar.children();

                            // Try to find and remove captions/subs-caps button (but keep subtitles)
                            const possibleCaptionButtons = ['captionsButton', 'subsCapsButton'];
                            possibleCaptionButtons.forEach((buttonName) => {
                                const button = controlBar.getChild(buttonName);
                                if (button) {
                                    try {
                                        controlBar.removeChild(button);
                                        console.log(`✓ Removed ${buttonName}`);
                                    } catch (e) {
                                        console.log(`✗ Failed to remove ${buttonName}:`, e);
                                    }
                                }
                            });

                            // Alternative: hide buttons we can't remove
                            allChildren.forEach((child, index) => {
                                const name = (child.name_ || child.constructor.name || '').toLowerCase();
                                if (name.includes('caption') && !name.includes('subtitle')) {
                                    child.hide();
                                    console.log(`✓ Hidden button at index ${index}: ${name}`);
                                }
                            });

                            // Move chapters button to the very end
                            const chaptersButton = controlBar.getChild('chaptersButton');
                            if (chaptersButton) {
                                try {
                                    controlBar.removeChild(chaptersButton);
                                    controlBar.addChild(chaptersButton);
                                    console.log('✓ Chapters button moved to last position');
                                } catch (e) {
                                    console.log('✗ Failed to move chapters button:', e);
                                }
                            }
                        }; */

                        // Try multiple times with different delays
                        /* setTimeout(cleanupControls, 200);
                        setTimeout(cleanupControls, 500);
                        setTimeout(cleanupControls, 1000); */

                        // Make menus clickable instead of hover-only
                        setTimeout(() => {
                            const setupClickableMenus = () => {
                                // Find all menu buttons (subtitles, etc.) - exclude chaptersButton as it has custom overlay
                                const menuButtons = ['subtitlesButton', 'playbackRateMenuButton'];

                                menuButtons.forEach((buttonName) => {
                                    const button = controlBar.getChild(buttonName);
                                    if (button && button.menuButton_) {
                                        // Override the menu button behavior
                                        const menuButton = button.menuButton_;

                                        // Disable hover events
                                        menuButton.off('mouseenter');
                                        menuButton.off('mouseleave');

                                        // Add click-to-toggle behavior
                                        menuButton.on('click', function () {
                                            if (this.menu.hasClass('vjs-lock-showing')) {
                                                this.menu.removeClass('vjs-lock-showing');
                                                this.menu.hide();
                                            } else {
                                                this.menu.addClass('vjs-lock-showing');
                                                this.menu.show();
                                            }
                                        });

                                        console.log(`✓ Made ${buttonName} clickable`);
                                    } else if (button) {
                                        // For buttons without menuButton_ property
                                        const buttonEl = button.el();
                                        if (buttonEl) {
                                            // Add click handler to show/hide menu
                                            buttonEl.addEventListener('click', function (e) {
                                                e.preventDefault();
                                                e.stopPropagation();

                                                const menu = buttonEl.querySelector('.vjs-menu');
                                                if (menu) {
                                                    if (menu.style.display === 'block') {
                                                        menu.style.display = 'none';
                                                    } else {
                                                        // Hide other menus first
                                                        document.querySelectorAll('.vjs-menu').forEach((m) => {
                                                            if (m !== menu) m.style.display = 'none';
                                                        });
                                                        menu.style.display = 'block';
                                                    }
                                                }
                                            });

                                            console.log(`✓ Added click handler to ${buttonName}`);
                                        }
                                    }
                                });

                                // Add YouTube-like subtitles toggle with red underline
                                const ccNames = ['subtitlesButton', 'captionsButton', 'subsCapsButton'];
                                for (const n of ccNames) {
                                    const cc = controlBar.getChild(n);
                                    if (cc && cc.el()) {
                                        const el = cc.el();
                                        const menu = el.querySelector('.vjs-menu');
                                        if (menu) menu.style.display = 'none';

                                        const toggleSubs = (ev) => {
                                            ev.preventDefault();
                                            ev.stopPropagation();
                                            const tracks = playerRef.current.textTracks();
                                            let any = false;
                                            for (let i = 0; i < tracks.length; i++) {
                                                const t = tracks[i];
                                                if (t.kind === 'subtitles' && t.mode === 'showing') {
                                                    any = true;
                                                    break;
                                                }
                                            }
                                            if (any) {
                                                for (let i = 0; i < tracks.length; i++) {
                                                    const t = tracks[i];
                                                    if (t.kind === 'subtitles') t.mode = 'disabled';
                                                }
                                                el.classList.remove('vjs-subs-active');
                                                // Do not change saved language on quick toggle off; save enabled=false
                                                try {
                                                    userPreferences.current.setPreference(
                                                        'subtitleEnabled',
                                                        false,
                                                        true
                                                    );
                                                } catch (e) {}
                                            } else {
                                                // Show using previously chosen language only; do not change it
                                                const preferred =
                                                    userPreferences.current.getPreference('subtitleLanguage');
                                                if (!preferred) {
                                                    // If no language chosen yet, enable first available and save it
                                                    let first = null;
                                                    for (let i = 0; i < tracks.length; i++) {
                                                        const t = tracks[i];
                                                        if (t.kind === 'subtitles') {
                                                            first = t.language;
                                                            break;
                                                        }
                                                    }
                                                    if (first) {
                                                        for (let i = 0; i < tracks.length; i++) {
                                                            const t = tracks[i];
                                                            if (t.kind === 'subtitles')
                                                                t.mode = t.language === first ? 'showing' : 'disabled';
                                                        }
                                                        try {
                                                            userPreferences.current.setPreference(
                                                                'subtitleLanguage',
                                                                first,
                                                                true
                                                            );
                                                        } catch (e) {}
                                                        try {
                                                            userPreferences.current.setPreference(
                                                                'subtitleEnabled',
                                                                true,
                                                                true
                                                            );
                                                        } catch (e) {}
                                                        el.classList.add('vjs-subs-active');
                                                    }
                                                    return;
                                                }
                                                let found = false;
                                                for (let i = 0; i < tracks.length; i++) {
                                                    const t = tracks[i];
                                                    if (t.kind === 'subtitles') {
                                                        const show = t.language === preferred;
                                                        t.mode = show ? 'showing' : 'disabled';
                                                        if (show) found = true;
                                                    }
                                                }
                                                if (found) {
                                                    el.classList.add('vjs-subs-active');
                                                    try {
                                                        userPreferences.current.setPreference(
                                                            'subtitleEnabled',
                                                            true,
                                                            true
                                                        );
                                                    } catch (e) {}
                                                }
                                            }
                                        };

                                        el.addEventListener('click', toggleSubs, { capture: true });

                                        // Add mobile touch support
                                        el.addEventListener(
                                            'touchend',
                                            (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleSubs(e);
                                            },
                                            { passive: false }
                                        );

                                        // Sync underline state on external changes
                                        playerRef.current.on('texttrackchange', () => {
                                            const tracks = playerRef.current.textTracks();
                                            let any = false;
                                            for (let i = 0; i < tracks.length; i++) {
                                                const t = tracks[i];
                                                if (t.kind === 'subtitles' && t.mode === 'showing') {
                                                    any = true;
                                                    break;
                                                }
                                            }
                                            if (any) el.classList.add('vjs-subs-active');
                                            else el.classList.remove('vjs-subs-active');
                                        });

                                        // Initialize state immediately
                                        const tracks = playerRef.current.textTracks();
                                        let any = false;
                                        for (let i = 0; i < tracks.length; i++) {
                                            const t = tracks[i];
                                            if (t.kind === 'subtitles' && t.mode === 'showing') {
                                                any = true;
                                                break;
                                            }
                                        }
                                        if (any) el.classList.add('vjs-subs-active');

                                        break;
                                    }
                                }
                            };

                            setupClickableMenus();
                        }, 1500);

                        // BEGIN: Add chapter markers and sprite preview to progress control
                        if (progressControl && seekBar) {
                            console.log('Setting up sprite preview and chapter markers...');
                            console.log('mediaData.previewSprite:', mediaData.previewSprite);
                            console.log('chaptersData:', chaptersData);

                            // Check if we have chapters
                            const hasChapters = chaptersData && chaptersData.length > 0;

                            if (hasChapters) {
                                // Use original ChapterMarkers with sprite functionality when chapters exist
                                console.log(
                                    '✓ Adding ChapterMarkers component with sprite functionality (chapters exist)'
                                );
                                const chapterMarkers = new ChapterMarkers(playerRef.current, {
                                    previewSprite: mediaData.previewSprite,
                                });
                                seekBar.addChild(chapterMarkers);
                            } else if (mediaData.previewSprite) {
                                // Use separate SpritePreview component only when no chapters but sprite data exists
                                console.log(
                                    '✓ Adding SpritePreview component (no chapters, but sprite data available)'
                                );
                                const spritePreview = new SpritePreview(playerRef.current, {
                                    previewSprite: mediaData.previewSprite,
                                });
                                seekBar.addChild(spritePreview);

                                // Setup sprite preview hover functionality
                                setTimeout(() => {
                                    console.log('✓ Setting up sprite preview hover functionality');
                                    spritePreview.setupProgressBarHover();
                                }, 100);
                            } else {
                                console.log('✗ No chapters and no sprite data available');
                            }
                        }
                        // END: Add chapter markers and sprite preview to progress control

                        // BEGIN: Simple button layout fix - use CSS approach
                        setTimeout(() => {
                            console.log('Setting up simplified button layout...');

                            // Add a simple spacer div using DOM manipulation (simpler approach)
                            const spacerDiv = document.createElement('div');
                            spacerDiv.className = 'vjs-spacer-control vjs-control';
                            spacerDiv.style.flex = '1';
                            spacerDiv.style.minWidth = '1px';
                            spacerDiv.style.height = '100%';

                            // Find insertion point after duration display
                            const durationDisplay = controlBar.getChild('durationDisplay');
                            if (durationDisplay && durationDisplay.el()) {
                                const controlBarEl = controlBar.el();
                                const durationEl = durationDisplay.el();
                                const nextSibling = durationEl.nextSibling;
                                controlBarEl.insertBefore(spacerDiv, nextSibling);
                                console.log('✓ Simple spacer added after duration display');
                            }
                        }, 300);
                        // END: Simple button layout fix

                        // BEGIN: Move chapters button after fullscreen toggle
                        if (chaptersButton && fullscreenToggle) {
                            try {
                                const fullscreenIndex = controlBar.children().indexOf(fullscreenToggle);
                                controlBar.addChild(chaptersButton, {}, fullscreenIndex + 1);
                                console.log('✓ Chapters button moved after fullscreen toggle');
                            } catch (e) {
                                console.log('✗ Failed to move chapters button:', e);
                            }
                        }
                        // END: Move chapters button after fullscreen toggle

                        console.log('chaptersData', chaptersData);
                        // BEGIN: Add Chapters Overlay Component
                        if (chaptersData && chaptersData.length > 0) {
                            customComponents.current.chaptersOverlay = new CustomChaptersOverlay(playerRef.current, {
                                chaptersData: chaptersData,
                                seriesTitle: mediaData?.data?.title || 'Chapters',
                                channelName: 'Chapter',
                                thumbnail: mediaData?.data?.thumbnail_url || mediaData?.data?.author_thumbnail || '',
                            });
                        } else {
                            console.log('⚠ No chapters data available for overlay');
                        }
                        // END: Add Chapters Overlay Component

                        // BEGIN: Add Settings Menu Component
                        customComponents.current.settingsMenu = new CustomSettingsMenu(playerRef.current, {
                            userPreferences: userPreferences.current,
                            qualities: availableQualities,
                            hasSubtitles: hasSubtitles,
                        });

                        // If qualities change per video (e.g., via MEDIA_DATA update), refresh menu
                        try {
                            playerRef.current.on('loadedmetadata', () => {
                                if (
                                    customComponents.current.settingsMenu &&
                                    customComponents.current.settingsMenu.setQualities
                                ) {
                                    const md = typeof window !== 'undefined' ? window.MEDIA_DATA : null;
                                    const newQualities = md?.data?.qualities || availableQualities;
                                    customComponents.current.settingsMenu.setQualities(newQualities);
                                }
                            });
                        } catch (e) {}

                        // END: Add Settings Menu Component

                        // BEGIN: Add Seek Indicator Component
                        customComponents.current.seekIndicator = new SeekIndicator(playerRef.current, {
                            seekAmount: 5, // 5 seconds seek amount
                        });
                        // Add the component but ensure it's hidden initially
                        playerRef.current.addChild(customComponents.current.seekIndicator);

                        customComponents.current.seekIndicator.hide(); // Explicitly hide on creation
                        // END: Add Seek Indicator Component

                        // Store components reference for potential cleanup

                        // BEGIN: Add custom arrow key seek functionality
                        const handleKeyDown = (event) => {
                            // Only handle if the player has focus or no input elements are focused
                            const activeElement = document.activeElement;
                            const isInputFocused =
                                activeElement &&
                                (activeElement.tagName === 'INPUT' ||
                                    activeElement.tagName === 'TEXTAREA' ||
                                    activeElement.contentEditable === 'true');

                            if (isInputFocused) {
                                return; // Don't interfere with input fields
                            }

                            const seekAmount = 5; // 5 seconds

                            if (event.key === 'ArrowRight' || event.keyCode === 39) {
                                event.preventDefault();
                                const currentTime = playerRef.current.currentTime();
                                const duration = playerRef.current.duration();
                                const newTime = Math.min(currentTime + seekAmount, duration);

                                playerRef.current.currentTime(newTime);
                                customComponents.current.seekIndicator.show('forward', seekAmount);
                            } else if (event.key === 'ArrowLeft' || event.keyCode === 37) {
                                event.preventDefault();
                                const currentTime = playerRef.current.currentTime();
                                const newTime = Math.max(currentTime - seekAmount, 0);

                                playerRef.current.currentTime(newTime);
                                customComponents.current.seekIndicator.show('backward', seekAmount);
                            }
                        };

                        // Add keyboard event listener to the document
                        document.addEventListener('keydown', handleKeyDown);

                        // Store cleanup function
                        customComponents.current.cleanupKeyboardHandler = () => {
                            document.removeEventListener('keydown', handleKeyDown);
                        };

                        // END: Add custom arrow key seek functionality

                        // Log current user preferences
                        console.log('Current user preferences:', userPreferences.current.getPreferences());

                        window.debugSubtitles = {
                            showTracks: () => {
                                const textTracks = playerRef.current.textTracks();
                                console.log('=== Available Text Tracks ===');
                                for (let i = 0; i < textTracks.length; i++) {
                                    const track = textTracks[i];
                                    console.log(
                                        `${i}: ${track.kind} | ${track.language} | ${track.label} | mode: ${track.mode}`
                                    );
                                }
                            },
                            enableEnglish: () => {
                                const textTracks = playerRef.current.textTracks();
                                for (let i = 0; i < textTracks.length; i++) {
                                    const track = textTracks[i];
                                    if (track.kind === 'subtitles' && track.language === 'en') {
                                        track.mode = 'showing';
                                        console.log('Enabled English subtitles');
                                        break;
                                    }
                                }
                            },
                            enableGreek: () => {
                                const textTracks = playerRef.current.textTracks();
                                for (let i = 0; i < textTracks.length; i++) {
                                    const track = textTracks[i];
                                    if (track.kind === 'subtitles' && track.language === 'el') {
                                        track.mode = 'showing';
                                        console.log('Enabled Greek subtitles');
                                        break;
                                    }
                                }
                            },
                            disableAll: () => {
                                const textTracks = playerRef.current.textTracks();
                                for (let i = 0; i < textTracks.length; i++) {
                                    const track = textTracks[i];
                                    if (track.kind === 'subtitles') {
                                        track.mode = 'disabled';
                                    }
                                }
                                console.log('Disabled all subtitles');
                            },
                            getPrefs: () => {
                                console.log('Saved preferences:', userPreferences.current.getPreferences());
                            },
                            reapplyPrefs: () => {
                                userPreferences.current.applySubtitlePreference(playerRef.current);
                            },
                            showMenu: () => {
                                const controlBar = playerRef.current.getChild('controlBar');

                                // Try different button names
                                const possibleNames = ['subtitlesButton', 'captionsButton', 'subsCapsButton'];
                                let subtitlesButton = null;

                                for (const name of possibleNames) {
                                    const button = controlBar.getChild(name);
                                    if (button) {
                                        console.log(`Found subtitle button: ${name}`);
                                        subtitlesButton = button;
                                        break;
                                    }
                                }

                                if (subtitlesButton && subtitlesButton.menu) {
                                    console.log('=== Subtitle Menu Items ===');
                                    subtitlesButton.menu.children_.forEach((item, index) => {
                                        if (item.track) {
                                            console.log(
                                                `${index}: ${item.track.label} (${item.track.language}) - selected: ${item.selected()}`
                                            );
                                        } else {
                                            console.log(
                                                `${index}: ${item.label || 'Unknown'} - selected: ${item.selected()}`
                                            );
                                        }
                                    });
                                } else {
                                    console.log('No subtitle menu found, checking DOM...');

                                    // Check DOM for subtitle menu items
                                    const menuItems = playerRef.current.el().querySelectorAll('.vjs-menu-item');
                                    console.log(`Found ${menuItems.length} menu items in DOM`);

                                    menuItems.forEach((item, index) => {
                                        if (
                                            item.textContent.toLowerCase().includes('subtitle') ||
                                            item.textContent.toLowerCase().includes('caption') ||
                                            item.textContent.toLowerCase().includes('off')
                                        ) {
                                            console.log(
                                                `DOM item ${index}: ${item.textContent} - classes: ${item.className}`
                                            );
                                        }
                                    });
                                }
                            },
                            testMenuClick: (index) => {
                                const controlBar = playerRef.current.getChild('controlBar');
                                const possibleNames = ['subtitlesButton', 'captionsButton', 'subsCapsButton'];
                                let subtitlesButton = null;

                                for (const name of possibleNames) {
                                    const button = controlBar.getChild(name);
                                    if (button) {
                                        subtitlesButton = button;
                                        break;
                                    }
                                }

                                if (subtitlesButton && subtitlesButton.menu && subtitlesButton.menu.children_[index]) {
                                    const menuItem = subtitlesButton.menu.children_[index];
                                    console.log('Simulating click on menu item:', index);
                                    menuItem.handleClick();
                                } else {
                                    console.log('Menu item not found at index:', index, 'trying DOM approach...');

                                    // Try DOM approach
                                    const menuItems = playerRef.current.el().querySelectorAll('.vjs-menu-item');
                                    const subtitleItems = Array.from(menuItems).filter(
                                        (item) =>
                                            item.textContent.toLowerCase().includes('subtitle') ||
                                            item.textContent.toLowerCase().includes('caption') ||
                                            item.textContent.toLowerCase().includes('off')
                                    );

                                    if (subtitleItems[index]) {
                                        console.log('Clicking DOM element:', subtitleItems[index].textContent);
                                        subtitleItems[index].click();
                                    } else {
                                        console.log('No DOM subtitle item found at index:', index);
                                    }
                                }
                            },
                            forceEnableEnglish: () => {
                                console.log('Force enabling English subtitles...');
                                const textTracks = playerRef.current.textTracks();
                                for (let i = 0; i < textTracks.length; i++) {
                                    const track = textTracks[i];
                                    if (track.kind === 'subtitles') {
                                        track.mode = track.language === 'en' ? 'showing' : 'disabled';
                                    }
                                }
                                userPreferences.current.setPreference('subtitleLanguage', 'en');
                                console.log('English subtitles enabled and saved');
                            },
                            watchSubtitleChanges: () => {
                                console.log('👀 Watching subtitle preference changes...');
                                const originalSetPreference = userPreferences.current.setPreference;
                                userPreferences.current.setPreference = function (key, value) {
                                    if (key === 'subtitleLanguage') {
                                        console.log(`🎯 SUBTITLE CHANGE: ${value} at ${new Date().toISOString()}`);
                                        console.trace('Change origin:');
                                    }
                                    return originalSetPreference.call(this, key, value);
                                };
                                console.log('Subtitle change monitoring activated');
                            },
                            checkRestorationFlag: () => {
                                console.log('Restoration flag:', userPreferences.current.isRestoringSubtitles);
                                console.log('Auto-save disabled:', userPreferences.current.subtitleAutoSaveDisabled);
                            },
                            forceSaveGreek: () => {
                                console.log('🚀 Force saving Greek subtitle preference...');
                                userPreferences.current.forceSetSubtitleLanguage('el');
                                console.log('Check result:', userPreferences.current.getPreferences());
                            },
                            forceSaveEnglish: () => {
                                console.log('🚀 Force saving English subtitle preference...');
                                userPreferences.current.forceSetSubtitleLanguage('en');
                                console.log('Check result:', userPreferences.current.getPreferences());
                            },
                            forceSaveNull: () => {
                                console.log('🚀 Force saving null subtitle preference...');
                                userPreferences.current.forceSetSubtitleLanguage(null);
                                console.log('Check result:', userPreferences.current.getPreferences());
                            },
                        };
                    });

                    // Listen for next video event
                    playerRef.current.on('nextVideo', () => {
                        console.log('Next video requested');
                        goToNextVideo();
                    });

                    playerRef.current.on('play', () => {
                        console.log('Video started playing');
                        // Only show play indicator if not changing quality
                        if (!playerRef.current.isChangingQuality) {
                            customComponents.current.seekIndicator.show('play');
                        }
                    });

                    playerRef.current.on('pause', () => {
                        console.log('Video paused');
                        // Only show pause indicator if not changing quality
                        if (!playerRef.current.isChangingQuality) {
                            customComponents.current.seekIndicator.show('pause');
                        }
                    });

                    // Store reference to end screen and autoplay countdown for cleanup
                    let endScreen = null;
                    let autoplayCountdown = null;

                    playerRef.current.on('ended', () => {
                        console.log('Video ended');
                        console.log('Available relatedVideos:', relatedVideos);

                        // Keep controls active after video ends
                        setTimeout(() => {
                            if (playerRef.current && !playerRef.current.isDisposed()) {
                                // Remove vjs-ended class if it disables controls
                                const playerEl = playerRef.current.el();
                                if (playerEl) {
                                    // Keep the visual ended state but ensure controls work
                                    const controlBar = playerRef.current.getChild('controlBar');
                                    if (controlBar) {
                                        controlBar.show();
                                        controlBar.el().style.opacity = '1';
                                        controlBar.el().style.pointerEvents = 'auto';
                                    }
                                }
                            }
                        }, 50);

                        console.log('mediaData.previewSprite', mediaData.previewSprite);
                        console.log('mediaData.nextLink', mediaData.nextLink);
                        console.log('userPreferences', userPreferences);

                        // Check if autoplay is enabled and there's a next video
                        const isAutoplayEnabled = userPreferences.current.getAutoplayPreference();
                        const hasNextVideo = mediaData.nextLink !== null;

                        console.log('isAutoplayEnabled', isAutoplayEnabled);
                        console.log('hasNextVideo', hasNextVideo);

                        if (isAutoplayEnabled && hasNextVideo) {
                            // Get next video data for countdown display - find the next video in related videos
                            let nextVideoData = {
                                title: 'Next Video',
                                author: '',
                                duration: 0,
                                thumbnail: '',
                            };

                            // Try to find the next video by URL matching or just use the first related video
                            if (relatedVideos.length > 0) {
                                // For now, use the first related video as the next video
                                // In a real implementation, you might want to find the specific next video
                                const nextVideo = relatedVideos[0];
                                nextVideoData = {
                                    title: nextVideo.title || 'Next Video',
                                    author: nextVideo.author || '',
                                    duration: nextVideo.duration || 0,
                                    thumbnail: nextVideo.thumbnail || '',
                                };
                            }

                            // Clean up any existing overlays
                            if (endScreen) {
                                playerRef.current.removeChild(endScreen);
                                endScreen = null;
                            }
                            if (autoplayCountdown) {
                                playerRef.current.removeChild(autoplayCountdown);
                                autoplayCountdown = null;
                            }

                            // Show autoplay countdown
                            autoplayCountdown = new AutoplayCountdownOverlay(playerRef.current, {
                                nextVideoData: nextVideoData,
                                countdownSeconds: 5,
                                onPlayNext: () => {
                                    console.log('Autoplay: Navigating to next video');
                                    goToNextVideo();
                                },
                                onCancel: () => {
                                    console.log('Autoplay: User cancelled, showing related videos');
                                    // Hide countdown and show end screen instead
                                    if (autoplayCountdown) {
                                        playerRef.current.removeChild(autoplayCountdown);
                                        autoplayCountdown = null;
                                    }
                                    showEndScreen();
                                },
                            });

                            playerRef.current.addChild(autoplayCountdown);
                            autoplayCountdown.startCountdown();
                        } else {
                            // Autoplay disabled or no next video - show regular end screen
                            showEndScreen();
                        }

                        // Function to show the regular end screen
                        function showEndScreen() {
                            // Prevent creating multiple end screens
                            if (endScreen) {
                                console.log('End screen already exists, removing previous one');
                                playerRef.current.removeChild(endScreen);
                                endScreen = null;
                            }

                            // Show end screen with related videos
                            endScreen = new EndScreenOverlay(playerRef.current, {
                                relatedVideos: relatedVideos,
                            });

                            // Also store the data directly on the component as backup
                            endScreen.relatedVideos = relatedVideos;

                            playerRef.current.addChild(endScreen);
                            endScreen.show();
                        }
                    });

                    // Hide end screen and autoplay countdown when user wants to replay
                    playerRef.current.on('play', () => {
                        if (endScreen) {
                            endScreen.hide();
                        }
                        if (autoplayCountdown) {
                            autoplayCountdown.stopCountdown();
                        }
                    });

                    // Hide end screen and autoplay countdown when user seeks
                    playerRef.current.on('seeking', () => {
                        if (endScreen) {
                            endScreen.hide();
                        }
                        if (autoplayCountdown) {
                            autoplayCountdown.stopCountdown();
                        }
                    });

                    // Handle replay button functionality
                    playerRef.current.on('replay', () => {
                        if (endScreen) {
                            endScreen.hide();
                        }
                        playerRef.current.currentTime(0);
                        playerRef.current.play();
                    });

                    playerRef.current.on('error', (error) => {
                        console.error('Video.js error:', error);
                    });

                    playerRef.current.on('fullscreenchange', () => {
                        console.log('Fullscreen changed:', playerRef.current.isFullscreen());
                    });

                    playerRef.current.on('volumechange', () => {
                        console.log('Volume changed:', playerRef.current.volume(), 'Muted:', playerRef.current.muted());
                    });

                    playerRef.current.on('ratechange', () => {
                        console.log('Playback rate changed:', playerRef.current.playbackRate());
                    });

                    playerRef.current.on('texttrackchange', () => {
                        console.log('Text track changed');
                        const textTracks = playerRef.current.textTracks();
                        for (let i = 0; i < textTracks.length; i++) {
                            console.log(
                                'Track',
                                i,
                                ':',
                                textTracks[i].kind,
                                textTracks[i].label,
                                'Mode:',
                                textTracks[i].mode
                            );
                        }
                    });

                    // Focus the player element so keyboard controls work
                    // This ensures spacebar can pause/play the video
                    playerRef.current.ready(() => {
                        // Focus the player element
                        if (playerRef.current.el()) {
                            playerRef.current.el().focus();
                            console.log('Video player focused for keyboard controls');
                        }

                        // Start playing the video immediately if autoplay is enabled
                        if (playerRef.current.autoplay()) {
                            playerRef.current.play().catch((error) => {
                                console.log('ℹ️ Browser prevented autoplay (normal behavior):', error.message);
                                // If autoplay fails, we can still focus the element
                                // so the user can manually start and use keyboard controls
                            });
                        }
                    });
                }
            }, 0);

            return () => {
                clearTimeout(timer);
            };
        }

        // Cleanup function
        return () => {
            // Clean up keyboard event listener if it exists
            if (customComponents.current && customComponents.current.cleanupKeyboardHandler) {
                customComponents.current.cleanupKeyboardHandler();
            }

            if (playerRef.current && !playerRef.current.isDisposed()) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        };
    }, []);

    // Additional effect to ensure video gets focus for keyboard controls
    useEffect(() => {
        const focusVideo = () => {
            if (playerRef.current && playerRef.current.el()) {
                playerRef.current.el().focus();
                console.log('Video element focused for keyboard controls');
            }
        };

        // Focus when the page becomes visible or gains focus
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                setTimeout(focusVideo, 100);
            }
        };

        const handleWindowFocus = () => {
            setTimeout(focusVideo, 100);
        };

        // Add event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleWindowFocus);

        // Initial focus attempt
        setTimeout(focusVideo, 500);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, []);

    return <video ref={videoRef} className="video-js vjs-default-skin" tabIndex="0" />;
}

export default VideoJSPlayer;
