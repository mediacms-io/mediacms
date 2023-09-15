# StreamPod VMS

[![GitHub license](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://raw.githubusercontent.com/mediacms-io/mediacms/main/LICENSE.txt)

StreamPod VMS is a modern, fully featured open source video and media CMS. It is developed to meet the needs of modern web platforms for viewing and sharing media. It can be used to build a small to medium video and media portal within minutes. 

It is built mostly using the modern stack Django + React and includes a REST API.

## Features
- **Complete control over your data**: host it yourself!
- **Support for multiple publishing workflows**: public, private, unlisted and custom
- **Modern technologies**: Django/Python/Celery, React.
- **Multiple media types support**: video, audio,  image, pdf
- **Multiple media classification options**: categories, tags and custom
- **Multiple media sharing options**: social media share, videos embed code generation
- **Easy media searching**: enriched with live search functionality
- **Playlists for audio and video content**: create playlists, add and reorder content
- **Responsive design**: including light and dark themes
- **Advanced users management**: allow self registration, invite only, closed.
- **Configurable actions**: allow download, add comments, add likes, dislikes, report media
- **Configuration options**: change logos, fonts, styling, add more pages
- **Enhanced video player**: customized video.js player with multiple resolution and playback speed options
- **Multiple transcoding profiles**: sane defaults for multiple dimensions (240p, 360p, 480p, 720p, 1080p) and multiple profiles (h264, h265, vp9)
- **Adaptive video streaming**: possible through HLS protocol
- **Subtitles/CC**: support for multilingual subtitle files
- **Scalable transcoding**: transcoding through priorities. Experimental support for remote workers
- **Chunked file uploads**: for pausable/resumable upload of content
- **REST API**: Documented through Swagger


## Example cases

- **Schools, education.** Administrators and editors keep what content will be published, students are not distracted with advertisements and irrelevant content, plus they have the ability to select either to stream or download content.

- **Organization sensitive content.** In cases where content is sensitive and cannot be uploaded to external sites.

- **Build a great community.** StreamPod VMS can be customized (URLs, logos, fonts, aesthetics) so that you create a highly customized video portal for your community!

- **Personal portal.** Organize, categorize and host your content the way you prefer.


## Philosophy

We believe there's a need for quality open source web applications that can be used to build community portals and support collaboration. 

We have three goals for StreamPod VMS: a) deliver all functionality one would expect from a modern system, b) allow for easy installation and maintenance, c) allow easy customization and addition of features. 

## Installation / Maintanance

There are two ways to run MediaCMS, through Docker Compose and through installing it on a server via an automation script that installs and configures all needed services. Find the related pages:

* [Single Server](docs/admins_docs.md#2-server-installation) page
* [Docker Compose](docs/admins_docs.md#3-docker-installation) page

  A complete guide can be found on the blog post [How to self-host and share your videos in 2021](https://medium.com/@MediaCMS.io/how-to-self-host-and-share-your-videos-in-2021-14067e3b291b).

## Configuration

Visit [Configuration](docs/admins_docs.md#5-configuration) page.


## Documentation

* [Users documentation](docs/user_docs.md) page
* [Administrators documentation](docs/admins_docs.md) page
* [Developers documentation](docs/developers_docs.md) page
