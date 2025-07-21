import React, { useEffect, useRef, useMemo } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// Import the separated components
import EndScreenOverlay from '../overlays/EndScreenOverlay';
import ChapterMarkers from '../markers/ChapterMarkers';
import NextVideoButton from '../controls/NextVideoButton';
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

    // Safely access window.MEDIA_DATA with fallback using useMemo
    const mediaData = useMemo(
        () =>
            typeof window !== 'undefined' && window.MEDIA_DATA
                ? window.MEDIA_DATA
                : {
                      data: {
                          related_media: [
                              {
                                  friendly_token: 'jgLkic37V',
                                  url: 'http://localhost/view?m=jgLkic37V',
                                  api_url: 'http://localhost/api/v1/media/jgLkic37V',
                                  user: 'admin',
                                  title: 'Screenshot20250312at15.58.35.png',
                                  description: '',
                                  add_date: '2025-03-12T14:28:24.757807Z',
                                  views: 5,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/ad827f53568c4565b69ee59da88966c8.Screenshot20250312at15.58.35.png.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: '54Ip78oPK',
                                  url: 'http://localhost/view?m=54Ip78oPK',
                                  api_url: 'http://localhost/api/v1/media/54Ip78oPK',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov (Trimmed) 2',
                                  description: '',
                                  add_date: '2025-05-19T01:22:10.354407+01:00',
                                  views: 8,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 1,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/ca19044d26af4eada1669c3373c771cb_nhCvKcl.fd1d31460e614ca9b4645228e62c9eec.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/ca19044d26af4eada1669c3373c771cb.fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '0.6MB',
                              },
                              {
                                  friendly_token: '0VpZtWduU',
                                  url: 'http://localhost/view?m=0VpZtWduU',
                                  api_url: 'http://localhost/api/v1/media/0VpZtWduU',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov (Trimmed) (Trimmed)',
                                  description: '',
                                  add_date: '2025-05-19T01:30:55.374863+01:00',
                                  views: 13,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 6,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/46b2bec8d79f496682640ce99b5c53af_RA16Oba.884cac6a306e4ae9995726fcd3c7aa49.fd1d31460e614ca9b4645228e62c9eec.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/46b2bec8d79f496682640ce99b5c53af.884cac6a306e4ae9995726fcd3c7aa49.fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '4.0MB',
                              },
                              {
                                  friendly_token: 'efM2aLP4P',
                                  url: 'http://localhost/view?m=efM2aLP4P',
                                  api_url: 'http://localhost/api/v1/media/efM2aLP4P',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov (Trimmed) 1',
                                  description: '',
                                  add_date: '2025-05-19T01:22:08.117300+01:00',
                                  views: 11,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 8,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/c27f570a84d64cdc857f87c50dace993_Ma3ap4p.fd1d31460e614ca9b4645228e62c9eec.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/c27f570a84d64cdc857f87c50dace993.fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 2,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '4.8MB',
                              },
                              {
                                  friendly_token: '8RUHRjnji',
                                  url: 'http://localhost/view?m=8RUHRjnji',
                                  api_url: 'http://localhost/api/v1/media/8RUHRjnji',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov (Trimmed)',
                                  description: '',
                                  add_date: '2025-05-19T01:29:48.308159+01:00',
                                  views: 7,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 7,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/884cac6a306e4ae9995726fcd3c7aa49_fT7pnM4.fd1d31460e614ca9b4645228e62c9eec.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/884cac6a306e4ae9995726fcd3c7aa49.fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '4.6MB',
                              },
                              {
                                  friendly_token: 'N5Vpnqfpf',
                                  url: 'http://localhost/view?m=N5Vpnqfpf',
                                  api_url: 'http://localhost/api/v1/media/N5Vpnqfpf',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov',
                                  description: '',
                                  add_date: '2025-05-19T01:15:03.594646+01:00',
                                  views: 11,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 37,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/e549ebb4b1dc41a48cf76ebccf592836_1xqZHHc.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/e549ebb4b1dc41a48cf76ebccf592836.tmpu6x4f3js.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '22.3MB',
                              },
                              {
                                  friendly_token: 'MmyuYCEfC',
                                  url: 'http://localhost/view?m=MmyuYCEfC',
                                  api_url: 'http://localhost/api/v1/media/MmyuYCEfC',
                                  user: 'admin',
                                  title: 'JmailLogIdeasforYiannis.mp4',
                                  description: 'check the 00:12 and then the 00:39',
                                  add_date: '2025-03-12T02:37:42Z',
                                  views: 49,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 112,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/3d4e6f1c7e014720bc6390ed9d61aba5_BppzBiz.JmailLogIdeasforYiannis.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/3d4e6f1c7e014720bc6390ed9d61aba5.tmpcjd0bvr5.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '40.6MB',
                              },
                              {
                                  friendly_token: 'E8ia0lfir',
                                  url: 'http://localhost/view?m=E8ia0lfir',
                                  api_url: 'http://localhost/api/v1/media/E8ia0lfir',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov (Trimmed)',
                                  description: '',
                                  add_date: '2025-05-19T01:22:27.251447+01:00',
                                  views: 12,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 37,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/8572a325a9d649f79cc60181fbece78c_0H5arHy.fd1d31460e614ca9b4645228e62c9eec.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/8572a325a9d649f79cc60181fbece78c.fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '22.4MB',
                              },
                              {
                                  friendly_token: 'eZAl84zg6',
                                  url: 'http://localhost/view?m=eZAl84zg6',
                                  api_url: 'http://localhost/api/v1/media/eZAl84zg6',
                                  user: 'admin',
                                  title: '20257855hd_1920_1080_60fps.mp4',
                                  description: '',
                                  add_date: '2025-03-12T02:35:59.779098Z',
                                  views: 29,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 90,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/ed9c61a72c0445debfbedee011b6eba1_8HjWGZX.20257855hd_1920_1080_60fps.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/ed9c61a72c0445debfbedee011b6eba1.tmpil72jnbv.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '64.4MB',
                              },
                              {
                                  friendly_token: '6WShYNxZx',
                                  url: 'http://localhost/view?m=6WShYNxZx',
                                  api_url: 'http://localhost/api/v1/media/6WShYNxZx',
                                  user: 'admin',
                                  title: 'SampleVideo_1280x720_30mb.mp4 test abc',
                                  description: 'test 123 yiannis',
                                  add_date: '2025-04-14T00:00:00+01:00',
                                  views: 43,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 171,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/c868df836ac34688b876e741b58ada93_LRvu388.SampleVideo_1280x720_30mb.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/c868df836ac34688b876e741b58ada93.tmpyl_r01_l.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 3,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '31.5MB',
                              },
                              {
                                  friendly_token: 'SOgLTsrAH',
                                  url: 'http://localhost/view?m=SOgLTsrAH',
                                  api_url: 'http://localhost/api/v1/media/SOgLTsrAH',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov (Trimmed) (Trimmed) 1',
                                  description: '',
                                  add_date: '2025-05-19T01:31:11.057879+01:00',
                                  views: 8,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 2,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/46c75315947e4a5f9dd464c1721206fd_6KJzqBH.884cac6a306e4ae9995726fcd3c7aa49.fd1d31460e614ca9b4645228e62c9eec.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/46c75315947e4a5f9dd464c1721206fd.884cac6a306e4ae9995726fcd3c7aa49.fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '1.5MB',
                              },
                              {
                                  friendly_token: 'PoDk009ue',
                                  url: 'http://localhost/view?m=PoDk009ue',
                                  api_url: 'http://localhost/api/v1/media/PoDk009ue',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov',
                                  description: '',
                                  add_date: '2025-05-19T01:17:44.296445+01:00',
                                  views: 12,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 37,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/fd1d31460e614ca9b4645228e62c9eec_DB8nan8.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '22.4MB',
                              },
                              {
                                  friendly_token: 'b7e06rUz5',
                                  url: 'http://localhost/view?m=b7e06rUz5',
                                  api_url: 'http://localhost/api/v1/media/b7e06rUz5',
                                  user: 'admin',
                                  title: 'Proto.cyTimesheet03_03_202507_03_2025.pdf',
                                  description: '',
                                  add_date: '2025-03-12T14:29:15.245599Z',
                                  views: 16,
                                  media_type: 'pdf',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url: null,
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'wUu76zL5a',
                                  url: 'http://localhost/view?m=wUu76zL5a',
                                  api_url: 'http://localhost/api/v1/media/wUu76zL5a',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov (Trimmed) 2 (Trimmed)',
                                  description: '',
                                  add_date: '2025-05-19T01:28:52.829907+01:00',
                                  views: 2,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/1b3e7dc2431b46a5b7e40b297662137a_1V0DJz5.ca19044d26af4eada1669c3373c771cb.fd1d31460e614ca9b4645228e62c9eec.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/1b3e7dc2431b46a5b7e40b297662137a.ca19044d26af4eada1669c3373c771cb.fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '0.3MB',
                              },
                              {
                                  friendly_token: 'JBjMHLfLZ',
                                  url: 'http://localhost/view?m=JBjMHLfLZ',
                                  api_url: 'http://localhost/api/v1/media/JBjMHLfLZ',
                                  user: 'admin',
                                  title: 'att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov (Trimmed) (Trimmed) 2',
                                  description: '',
                                  add_date: '2025-05-19T01:31:11.848403+01:00',
                                  views: 19,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 4,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/7759ca3e0ba1482aa9149201bd14139d_ISBMqD4.884cac6a306e4ae9995726fcd3c7aa49.fd1d31460e614ca9b4645228e62c9eec.att.24Cz35hRdjJ9FV0RlxCPVVtc6XVAdJvrU4eb8Gkykc.mov.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/7759ca3e0ba1482aa9149201bd14139d.884cac6a306e4ae9995726fcd3c7aa49.fd1d31460e614ca9b4645228e62c9eec.tmpjohj96hu.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '2.5MB',
                              },
                              {
                                  friendly_token: 'w13x5uUXc',
                                  url: 'http://localhost/view?m=w13x5uUXc',
                                  api_url: 'http://localhost/api/v1/media/w13x5uUXc',
                                  user: 'admin',
                                  title: 'Web357202503112025_05_33_AM.png',
                                  description: '',
                                  add_date: '2025-03-12T14:27:55.078360Z',
                                  views: 3,
                                  media_type: 'image',
                                  state: 'public',
                                  duration: 0,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/1da967bcdca540efa1d2362af2f3a34b.Web357202503112025_05_33_AM.png.jpg',
                                  is_reviewed: true,
                                  preview_url: null,
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: null,
                              },
                              {
                                  friendly_token: 'sZxPpdon5',
                                  url: 'http://localhost/view?m=sZxPpdon5',
                                  api_url: 'http://localhost/api/v1/media/sZxPpdon5',
                                  user: 'admin',
                                  title: 'JmailLogIdeasforYiannis.mp4 (Trimmed)',
                                  description: 'check the 00:12 and then the 00:39',
                                  add_date: '2025-05-15T02:16:19.580745+01:00',
                                  views: 9,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 17,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/7191a59cbfcd402ebed400e604a76840_5WRh0cp.3d4e6f1c7e014720bc6390ed9d61aba5.JmailLogIdeasforYiannis.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/7191a59cbfcd402ebed400e604a76840.3d4e6f1c7e014720bc6390ed9d61aba5.tmpcjd0bvr5.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '4.5MB',
                              },
                              {
                                  friendly_token: 'TCycDZROI',
                                  url: 'http://localhost/view?m=TCycDZROI',
                                  api_url: 'http://localhost/api/v1/media/TCycDZROI',
                                  user: 'admin',
                                  title: 'JmailLogIdeasforYiannis.mp4 (Trimmed)',
                                  description: 'check the 00:12 and then the 00:39',
                                  add_date: '2025-05-15T02:14:58.855935+01:00',
                                  views: 8,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 112,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/5cbfbe93d06c453487c65d9d54749318_CUIZl8y.3d4e6f1c7e014720bc6390ed9d61aba5.JmailLogIdeasforYiannis.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/5cbfbe93d06c453487c65d9d54749318.3d4e6f1c7e014720bc6390ed9d61aba5.tmpcjd0bvr5.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 1,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '40.6MB',
                              },
                              {
                                  friendly_token: 'YjGJafibO',
                                  url: 'http://localhost/view?m=YjGJafibO',
                                  api_url: 'http://localhost/api/v1/media/YjGJafibO',
                                  user: 'admin',
                                  title: 'file_example_MP4_480_1_5MG.mp4',
                                  description: '',
                                  add_date: '2025-04-14T00:07:11.074523+01:00',
                                  views: 18,
                                  media_type: 'video',
                                  state: 'public',
                                  duration: 30,
                                  thumbnail_url:
                                      'http://localhost/media/original/thumbnails/user/admin/e76f4fff2b3d42adbadb0f1204b21b81_s8EEvSE.file_example_MP4_480_1_5MG.mp4.jpg',
                                  is_reviewed: true,
                                  preview_url:
                                      '/media/encoded/1/admin/e76f4fff2b3d42adbadb0f1204b21b81.tmp04azp_tc.gif',
                                  author_name: '',
                                  author_profile: 'http://localhost/user/admin/',
                                  author_thumbnail: 'http://localhost/media/userlogos/user.jpg',
                                  encoding_status: 'success',
                                  likes: 2,
                                  dislikes: 0,
                                  reported_times: 0,
                                  featured: false,
                                  user_featured: false,
                                  size: '1.6MB',
                              },
                          ],
                      },
                      previewSprite: {
                          url: 'https://demo.mediacms.io/media/original/thumbnails/user/markos/fe4933d67b884d4da507dd60e77f7438.VID_20200909_141053.mp4sprites.jpg',
                          frame: { width: 160, height: 90, seconds: 10 },
                      },
                      siteUrl: '',
                      hasNextLink: true,
                  },
        []
    );

    // Define chapters as JSON object
    // Note: The sample-chapters.vtt file is no longer needed as chapters are now loaded from this JSON
    const chaptersData = [
        { startTime: 0, endTime: 5, text: 'Start111' },
        { startTime: 5, endTime: 10, text: 'Introduction - EuroHPC' },
        { startTime: 10, endTime: 15, text: 'Planning - EuroHPC' },
        { startTime: 15, endTime: 20, text: 'Parcel Discounts - EuroHPC' },
        { startTime: 20, endTime: 25, text: 'Class Studies - EuroHPC' },
        { startTime: 25, endTime: 30, text: 'Sustainability - EuroHPC' },
        { startTime: 30, endTime: 31, text: 'Funding and  - EuroHPC' } /* 
        { startTime: 35, endTime: 40, text: 'Virtual HPC Academy - EuroHPC' },
        { startTime: 40, endTime: 45, text: 'Wrapping up - EuroHPC' }, */,
    ];

    // Get video data from mediaData
    const currentVideo = useMemo(
        () => ({
            id: mediaData.data?.friendly_token || 'default-video',
            title: mediaData.data?.title || 'Video',
            poster: mediaData.siteUrl + mediaData.data?.poster_url || '',
            previewSprite: mediaData?.previewSprite || {},
            related_media: mediaData.data?.related_media || [],
            sources: mediaData.data?.original_media_url
                ? [
                      {
                          src: mediaData.siteUrl + mediaData.data.original_media_url,
                          type: 'video/mp4',
                      },
                  ]
                : [
                      {
                          src: '/videos/sample-video.mp4',
                          type: 'video/mp4',
                      },
                  ],
        }),
        [mediaData]
    );

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

                        // Autoplay behavior: false, true, 'muted', 'play', 'any'
                        autoplay: true,

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
                        audioPosterMode: false,

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

                        // Normalize autoplay behavior
                        normalizeAutoplay: false,

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

                            // Playback rate menu button
                            playbackRateMenuButton: true,

                            // Descriptions button
                            descriptionsButton: true,

                            // Subtitles button
                            subtitlesButton: false,

                            // Captions button (disabled to avoid duplicate)
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
                                        console.log('Autoplay was prevented:', error);
                                    });
                                }
                            }, 100);
                        }

                        // BEGIN: Add subtitle tracks
                        const subtitleTracks = [
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

                        subtitleTracks.forEach((track) => {
                            playerRef.current.addRemoteTextTrack(track, false);
                        });

                        // Apply saved subtitle preference with additional delay
                        setTimeout(() => {
                            userPreferences.current.applySubtitlePreference(playerRef.current);
                        }, 1000);
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
                        if (mediaData.hasNextLink) {
                            const nextVideoButton = new NextVideoButton(playerRef.current);
                            const playToggleIndex = controlBar.children().indexOf(playToggle); // Insert it after play button
                            controlBar.addChild(nextVideoButton, {}, playToggleIndex + 1);
                        }
                        // END: Implement custom next video button

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
                                // Find all menu buttons (chapters, subtitles, etc.)
                                const menuButtons = ['chaptersButton', 'subtitlesButton', 'playbackRateMenuButton'];

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
                            };

                            setupClickableMenus();
                        }, 1500);

                        // BEGIN: Add chapter markers to progress control
                        if (progressControl && seekBar) {
                            const chapterMarkers = new ChapterMarkers(playerRef.current, {
                                previewSprite: mediaData.previewSprite,
                            });
                            seekBar.addChild(chapterMarkers);
                        }
                        // END: Add chapter markers to progress control

                        // BEGIN: Move CC (subtitles) and PiP buttons to the right side
                        setTimeout(() => {
                            // Create a spacer element to push buttons to the right
                            const spacer = videojs.dom.createEl('div', {
                                className: 'vjs-spacer-control vjs-control',
                            });
                            spacer.style.flex = '1';
                            spacer.style.minWidth = '1px';

                            // Find insertion point after time displays
                            const durationDisplay = controlBar.getChild('durationDisplay');
                            const customRemainingTime = controlBar.getChild('customRemainingTime');
                            const insertAfter = customRemainingTime || durationDisplay;

                            if (insertAfter) {
                                const insertIndex = controlBar.children().indexOf(insertAfter) + 1;
                                controlBar.el().insertBefore(spacer, controlBar.children()[insertIndex]?.el() || null);
                                console.log('✓ Spacer added after time displays');
                            }

                            // Find the subtitles/captions button (CC button)
                            const possibleTextTrackButtons = ['subtitlesButton', 'captionsButton', 'subsCapsButton'];
                            let textTrackButton = null;

                            for (const buttonName of possibleTextTrackButtons) {
                                const button = controlBar.getChild(buttonName);
                                if (button) {
                                    textTrackButton = button;
                                    console.log(`Found text track button: ${buttonName}`);
                                    break;
                                }
                            }

                            // Find other buttons to move to the right
                            const pipButton = controlBar.getChild('pictureInPictureToggle');
                            const playbackRateButton = controlBar.getChild('playbackRateMenuButton');
                            const chaptersButton = controlBar.getChild('chaptersButton');

                            // Move buttons to the right side (after spacer)
                            const buttonsToMove = [
                                playbackRateButton,
                                textTrackButton,
                                pipButton,
                                chaptersButton,
                                fullscreenToggle,
                            ].filter(Boolean);

                            buttonsToMove.forEach((button) => {
                                if (button) {
                                    try {
                                        controlBar.removeChild(button);
                                        controlBar.addChild(button);
                                        console.log(`✓ Moved ${button.name_ || 'button'} to right side`);
                                    } catch (e) {
                                        console.log(`✗ Failed to move button:`, e);
                                    }
                                }
                            });
                        }, 100);
                        // END: Move CC (subtitles) and PiP buttons to the right side

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

                        // BEGIN: Add Chapters Overlay Component
                        if (chaptersData && chaptersData.length > 0) {
                            customComponents.current.chaptersOverlay = new CustomChaptersOverlay(playerRef.current, {
                                chaptersData: chaptersData,
                            });
                            console.log('✓ Custom chapters overlay component created');
                        } else {
                            console.log('⚠ No chapters data available for overlay');
                        }
                        // END: Add Chapters Overlay Component

                        // BEGIN: Add Settings Menu Component
                        customComponents.current.settingsMenu = new CustomSettingsMenu(playerRef.current, {
                            userPreferences: userPreferences.current,
                        });
                        console.log('✓ Custom settings menu component created');
                        // END: Add Settings Menu Component

                        // BEGIN: Add Seek Indicator Component
                        customComponents.current.seekIndicator = new SeekIndicator(playerRef.current, {
                            seekAmount: 5, // 5 seconds seek amount
                        });
                        // Add the component but ensure it's hidden initially
                        playerRef.current.addChild(customComponents.current.seekIndicator);

                        // Log the element to verify it exists
                        console.log('✓ Custom seek indicator component created');
                        console.log('Seek indicator element:', customComponents.current.seekIndicator.el());
                        console.log('Player element:', playerRef.current.el());

                        customComponents.current.seekIndicator.hide(); // Explicitly hide on creation
                        console.log('✓ Seek indicator hidden after creation');
                        // END: Add Seek Indicator Component

                        // Store components reference for potential cleanup
                        console.log('Custom components initialized:', Object.keys(customComponents.current));

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

                        console.log('✓ Arrow key seek functionality enabled');
                        // END: Add custom arrow key seek functionality

                        // Log current user preferences
                        console.log('Current user preferences:', userPreferences.current.getPreferences());

                        // Add debugging methods to window for testing
                        window.debugSeek = {
                            testForward: () => {
                                console.log('🧪 Testing seek indicator forward');
                                customComponents.current.seekIndicator.show('forward', 5);
                            },
                            testBackward: () => {
                                console.log('🧪 Testing seek indicator backward');
                                customComponents.current.seekIndicator.show('backward', 5);
                            },
                            testHide: () => {
                                console.log('🧪 Testing seek indicator hide');
                                customComponents.current.seekIndicator.hide();
                            },
                            getElement: () => {
                                return customComponents.current.seekIndicator.el();
                            },
                            getStyles: () => {
                                const el = customComponents.current.seekIndicator.el();
                                return {
                                    display: el.style.display,
                                    visibility: el.style.visibility,
                                    opacity: el.style.opacity,
                                    position: el.style.position,
                                    zIndex: el.style.zIndex,
                                    top: el.style.top,
                                    left: el.style.left,
                                    cssText: el.style.cssText,
                                };
                            },
                        };

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
                    });

                    playerRef.current.on('pause', () => {
                        console.log('Video paused');
                    });

                    // Store reference to end screen for cleanup
                    let endScreen = null;

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
                    });

                    // Hide end screen when user wants to replay
                    playerRef.current.on('play', () => {
                        if (endScreen) {
                            endScreen.hide();
                        }
                    });

                    // Hide end screen when user seeks
                    playerRef.current.on('seeking', () => {
                        if (endScreen) {
                            endScreen.hide();
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
                                console.log('Autoplay prevented by browser:', error);
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
