# Docker Compose

## Installation
Install a recent version of [Docker](https://docs.docker.com/get-docker/), and [Docker Compose](https://docs.docker.com/compose/install/).

For Ubuntu 18/20 systems this is:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

Then run as root

```bash
git clone https://github.com/mediacms-io/mediacms
cd mediacms
```

The default option is to serve MediaCMS on all ips available of the server (including localhost).
If you want to explore more options (including setup of https with letsencrypt certificate) checkout the docs on the [Docker deployment](/docs/Docker_deployment.md) page for different docker-compose setups to use.

Run

```bash
docker-compose up
```

This will download all MediaCMS related Docker images and start all containers. Once it finishes, MediaCMS will be installed and available on http://localhost or http://ip


## Configuration
Checkout the configuration docs on [Configuration](/docs/Configuration.md) page.


## Maintenance
Database is stored on ../postgres_data/ and media_files on media_files/


