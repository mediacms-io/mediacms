module.exports = {
  header: {
    right: '',
  },
  sidebar: {
    navMenuItems: [
      {
        text: 'About',
        link: './about.html',
        icon: 'contact_support',
      },
      {
        text: 'Terms',
        link: './terms.html',
        icon: 'description',
      },
      {
        text: 'Contact',
        link: './contact.html',
        icon: 'alternate_email',
      },
    ],
    belowNavMenu: null,
    footer: 'Powered by <a href="https://blowleaf.com" title="Blowleaf" target="_blank">StreamPodsm</a>',
  },
  uploader: {
    belowUploadArea: '',
    postUploadMessage: '',
  },
  notifications: {
    messages: {
      addToLiked: 'Added to liked media',
      removeFromLiked: 'Removed from liked media',
      addToDisliked: 'Added to disliked media',
      removeFromDisliked: 'Removed from disliked media',
    },
  },
};
