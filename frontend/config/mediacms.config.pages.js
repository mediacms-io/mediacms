const templates = require('./mediacms.config.templates');

const DEV_SAMPLE_DATA = {
  profileId: process.env.MEDIACMS_USER_USERNAME,
  media: {
    videoId: process.env.MEDIACMS_VIDEO_ID,
    audioId: process.env.MEDIACMS_AUDIO_ID,
    imageId: process.env.MEDIACMS_IMAGE_ID,
    pdfId: process.env.MEDIACMS_PDF_ID,
  },
  playlistId: process.env.MEDIACMS_PLAYLIST_ID,
};

const formatPage = (page) => {
  const pageContentId = 'page-' + page.id;
  const filename = page.filename ? page.filename : ('home' === page.id ? 'index' : page.id) + '.html';
  const render = page.renderer
    ? page.renderer
    : page.component
    ? templates.renderPageContent({ page: { id: pageContentId, component: page.component } })
    : undefined;

   const headLinks = [
    ...(page.headLinks ? page.headLinks : []),
  ];
  const bodyScripts = [
    ...(page.bodyScripts ? page.bodyScripts : []),
  ];

  const ret = {
    buildExclude: !!page.buildExclude,
    title: page.title,
    filename,
    render,
    html: {
      head: {
        links: headLinks,
      },
      body: {
        scripts: bodyScripts,
        snippet: page.snippet || templates.htmlBodySnippet({ id: pageContentId }),
      },
    },
    window: { MediaCMS: page.global ? { ...page.global } : {} },
  };

  return ret;
};

const formatPageData = (page) => {
  return formatPage({
    ...page,
  });
};

const formatStaticPageData = (page) => {
  const pageContentId = 'page-' + page.id;
  return formatPage({
    ...page,
    renderer: page.renderer
      ? page.renderer
      : page.component
      ? templates.renderPageStaticContent({ page: { id: pageContentId, component: page.component } })
      : undefined,
  });
};

const PAGES = {
  base: {
    id: 'base',
    title: 'Layout base',
    renderer: templates.renderBase(),
  },
  index: { id: 'home', title: 'Home', component: 'HomePage' },
  search: { id: 'search', title: 'Search results', component: 'SearchPage' },
  latest: { id: 'latest', title: 'Recent uploads', component: 'LatestMediaPage' },
  featured: { id: 'featured', title: 'Featured', component: 'FeaturedMediaPage' },
  recommended: { id: 'recommended', title: 'Recommended', component: 'RecommendedMediaPage' },
  members: { id: 'members', title: 'Members', component: 'MembersPage' },
  history: { id: 'history', title: 'History', component: 'HistoryPage' },
  liked: { id: 'liked', title: 'Liked media', component: 'LikedMediaPage' },
  tags: { id: 'tags', title: 'Tags', component: 'TagsPage' },
  categories: { id: 'categories', title: 'Categories', component: 'CategoriesPage' },
  'manage-media': { id: 'manage-media', title: 'Manage media', component: 'ManageMediaPage' },
  'manage-users': { id: 'manage-users', title: 'Manage users', component: 'ManageUsersPage' },
  'manage-comments': { id: 'manage-comments', title: 'Manage comments', component: 'ManageCommentsPage' },
  'add-media': {
    id: 'add-media',
    title: 'Add media',
    renderer: templates.renderAddMediaPageContent(),
    snippet: templates.htmlBodySnippetAddMediaPage(),
    headLinks: [{ rel: 'preload', href: './static/lib/file-uploader/5.13.0/fine-uploader.min.js', as: 'script' }],
    bodyScripts: [{ src: './static/lib/file-uploader/5.13.0/fine-uploader.min.js' }],
  },
  embed: {
    id: 'embed',
    title: 'Embedded player',
    renderer: templates.renderEmbedPageContent({ page: { id: 'page-embed', component: 'EmbedPage' } }),
    snippet: templates.htmlBodySnippetEmbedPage({ id: 'page-embed' }),
    global: { mediaId: DEV_SAMPLE_DATA.media.videoId },
  },
  media: {
    id: 'media',
    title: 'Media',
    component: 'MediaPage',
    global: { mediaId: DEV_SAMPLE_DATA.media.videoId },
  },
  'media-image': {
    buildExclude: true,
    id: 'media-image',
    title: 'Media - Image',
    component: 'MediaImagePage',
    global: { mediaId: DEV_SAMPLE_DATA.media.imageId },
  },
  'media-pdf': {
    buildExclude: true,
    id: 'media-pdf',
    title: 'Media - Pdf',
    component: 'MediaPdfPage',
    global: { mediaId: DEV_SAMPLE_DATA.media.pdfId },
  },
  playlist: {
    id: 'playlist',
    title: 'Playlist',
    component: 'PlaylistPage',
    global: { playlistId: DEV_SAMPLE_DATA.playlistId },
  },
  'profile-media': {
    id: 'profile-media',
    title: 'Profile - Media',
    component: 'ProfileMediaPage',
    global: { profileId: DEV_SAMPLE_DATA.profileId },
  },
  'profile-about': {
    id: 'profile-about',
    title: 'Profile - About',
    component: 'ProfileAboutPage',
    global: { profileId: DEV_SAMPLE_DATA.profileId },
  },
  'profile-playlists': {
    id: 'profile-playlists',
    title: 'Profile - Playlist',
    component: 'ProfilePlaylistsPage',
    global: { profileId: DEV_SAMPLE_DATA.profileId },
  },
  'profile-shared-by-me': {
    id: 'profile-shared-by-me',
    title: 'Profile - Shared by me',
    component: 'ProfileSharedByMePage',
    global: { profileId: DEV_SAMPLE_DATA.profileId },
  },
  'profile-shared-with-me': {
    id: 'profile-shared-with-me',
    title: 'Profile - Shared with me',
    component: 'ProfileSharedWithMePage',
    global: { profileId: DEV_SAMPLE_DATA.profileId },
  },
};

const STATIC_PAGES = {
  error: {
    buildExclude: true,
    id: 'error',
    title: 'Error',
    renderer: templates.renderBase(),
    snippet: templates.static.errorPage(),
  },
  about: {
    id: 'about',
    title: 'About',
    renderer: templates.renderBase(),
    snippet: templates.static.aboutPage(),
  },
  terms: {
    buildExclude: true,
    id: 'terms',
    title: 'Terms',
    renderer: templates.renderBase(),
    snippet: templates.static.termsPage(),
  },
};

const DEV_ONLY_STATIC_PAGES = {
  'add-media-template': {
    buildExclude: true,
    id: 'add-media-template',
    title: 'Add media - Template',
    renderer: templates.renderAddMediaPageContent(),
    snippet: templates.static.addMediaPageTemplate(),
    headLinks: [{ rel: 'preload', href: './static/lib/file-uploader/5.13.0/fine-uploader.min.js', as: 'script' }],
    bodyScripts: [{ src: './static/lib/file-uploader/5.13.0/fine-uploader.min.js' }],
  },
  'edit-media': {
    buildExclude: true,
    id: 'edit-media',
    title: 'Edit media',
    renderer: templates.renderBase(),
    snippet: templates.static.editMediaPage(),
  },
  'edit-channel': {
    buildExclude: true,
    id: 'edit-channel',
    title: 'Edit channel',
    renderer: templates.renderBase(),
    snippet: templates.static.editChannelPage(),
  },
  'edit-profile': {
    buildExclude: true,
    id: 'edit-profile',
    title: 'Edit profile',
    renderer: templates.renderBase(),
    snippet: templates.static.editProfilePage(),
  },
  signin: {
    buildExclude: true,
    id: 'signin',
    title: 'Sign in',
    renderer: templates.renderBase(),
    snippet: templates.static.signinPage(),
  },
  signout: {
    buildExclude: true,
    id: 'signout',
    title: 'Sign out',
    renderer: templates.renderBase(),
    snippet: templates.static.signoutPage(),
  },
  register: {
    buildExclude: true,
    id: 'register',
    title: 'Register',
    renderer: templates.renderBase(),
    snippet: templates.static.registerPage(),
  },
  'reset-password': {
    buildExclude: true,
    id: 'reset-password',
    title: 'Reset password',
    renderer: templates.renderBase(),
    snippet: templates.static.resetPasswordPage(),
  },
  contact: {
    buildExclude: true,
    id: 'contact',
    title: 'Contact us',
    renderer: templates.renderBase(),
    snippet: templates.static.contactPage(),
  },
};

const pages = {};

for (let k in PAGES) {
  pages[k] = formatPageData(PAGES[k]);
}

for (let k in STATIC_PAGES) {
  pages[k] = formatStaticPageData(STATIC_PAGES[k]);
}

for (let k in DEV_ONLY_STATIC_PAGES) {
  pages[k] = formatStaticPageData(DEV_ONLY_STATIC_PAGES[k]);
}

module.exports = pages;
