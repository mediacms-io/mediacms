export function buildMediaItems(count: number, mediaType = 'image') {
    return Array.from({ length: count }, (_v, i) => ({
        friendly_token: 'tok' + i,
        url: '/view?m=tok' + i,
        title: 'Media ' + i,
        media_type: mediaType,
        thumbnail_url: '',
        preview_url: '',
        duration: 10,
        views: i + 1,
        author_name: 'Ann',
        author_profile: '/user/ann',
        add_date: '2020-01-01T00:00:00Z',
    }));
}
