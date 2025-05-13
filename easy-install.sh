#!/bin/bash

#### Single-command install (Ubuntu)
### sudo su -c "bash <(wget -qO- https://github.com/mediacms-io/mediacms/raw/refs/heads/main/easy-install.sh)" root
###
### Debian Bullseye, Bookworm, Trixie
### su -c "bash <(wget -qO- https://github.com/mediacms-io/mediacms/raw/refs/heads/main/easy-install.sh)" root
###

#!/bin/bash

echo "MediaCMS Easy Installation";

if [ `id -u` -ne 0 ]
  then echo "Please run as root:  sudo su -c 'easy-install.sh' root"
  exit
fi

while true; do
    read -p "
This script will attempt to perform a system update, install required dependencies, install and configure PostgreSQL, NGINX, Redis and a few other utilities.
It is expected to run on a new system **with no running instances of any these services**. Make sure you check the script before you continue. Then enter yes or no
" yn
    case $yn in
        [Yy]* ) echo "OK!"; break;;
        [Nn]* ) echo "Have a great day"; exit;;
        * ) echo "Please answer yes or no.";;
    esac
done

apt install -y lsb-release

osVersion=$(lsb_release -d)
if [[ $osVersion == *"Ubuntu 20"* ]] || [[ $osVersion == *"bullseye"* ]]; then
    echo 'Ubuntu 20 / Debian Bullseye Detected.... system update and dependency installation, this will take a few minutes'
    apt-get update && apt-get -y upgrade 
    
    ### Ubuntu 20 requires Python 3.10 upgrade to work with Django 5.1.
    echo 'Upgrading to Python 3.10...   This may take a while.'
    apt-get install -y build-essential gdb lcov pkg-config \
      libbz2-dev libffi-dev libgdbm-dev libgdbm-compat-dev liblzma-dev \
      libncurses5-dev libreadline6-dev libsqlite3-dev libssl-dev \
      lzma lzma-dev tk-dev uuid-dev zlib1g-dev

    wget https://www.python.org/ftp/python/3.10.17/Python-3.10.17.tar.xz
    tar -xf Python-3.10.17.tar.xz
    cd Python-3.10.17
    ./configure --enable-optimizations
    make -j4
    make install

    # Install Postgresql 13 repos, required for Django 5.x
    echo "Installing PostgreSQL 13..."
    apt install curl gpg gnupg2 software-properties-common apt-transport-https lsb-release ca-certificates -y
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc| gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" | tee  /etc/apt/sources.list.d/pgdg.list
    apt update
    apt install -y postgresql-13 postgresql-client-13
    
    echo 'Installing other dependencies....'
    apt-get install redis-server pkg-config libxmlsec1-dev nginx git gcc vim unzip imagemagick certbot wget xz-utils -y

elif [[ $osVersion == *"Ubuntu 22"* ]] || [[ $osVersion == *"bookworm"* ]]; then
    echo 'Ubuntu 22 / Debian Bookworm detected - system update and dependency installation, this will take a few minutes'
    apt-get update && apt-get -y upgrade && apt-get install python3-venv python3-dev libxmlsec1-dev pkg-config virtualenv redis-server postgresql nginx git gcc vim unzip imagemagick python3-certbot-nginx certbot wget xz-utils -y

elif [[ $osVersion == *"Ubuntu 24"* ]] || [[ $osVersion == *"trixie"* ]]; then
    echo 'Ubuntu 24 / Debian Trixie detected - system update and installing Ubuntu 24 dependencies - this may take a few minutes'
    apt-get update && apt-get -y upgrade && apt-get install python3-venv python3-dev pkg-config libxmlsec1-dev virtualenv redis-server postgresql nginx git gcc vim unzip imagemagick python3-certbot-nginx certbot wget xz-utils -y

else
    echo "This script is tested for Ubuntu 20/22/24 versions only, if you want to try MediaCMS on another system you have to perform the manual installation"
    exit
fi


# Generate the directory
mkdir -p /home/mediacms.io
cd /home/mediacms.io/

# install ffmpeg
echo "Downloading and installing ffmpeg"
wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
mkdir -p tmp
tar -xf ffmpeg-release-amd64-static.tar.xz --strip-components 1 -C tmp
cp -v tmp/{ffmpeg,ffprobe,qt-faststart} /usr/local/bin
rm -rf tmp ffmpeg-release-amd64-static.tar.xz
echo "ffmpeg installed to /usr/local/bin"

read -p "Enter portal URL, or press enter for localhost : " FRONTEND_HOST
read -p "Enter portal name, or press enter for 'MediaCMS : " PORTAL_NAME

[ -z "$PORTAL_NAME" ] && PORTAL_NAME='MediaCMS'
[ -z "$FRONTEND_HOST" ] && FRONTEND_HOST='localhost'

echo 'Creating database to be used in MediaCMS'
su - postgres -c "psql -c \"CREATE USER mediacms WITH ENCRYPTED PASSWORD 'mediacms'\""
su - postgres -c "psql -c \"CREATE DATABASE mediacms WITH OWNER mediacms\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE mediacms TO mediacms\""

echo 'Creating python virtualenv on /home/mediacms.io'

cd /home/mediacms.io
python3 -mvenv .
source  /home/mediacms.io/bin/activate

echo "Cloning latest into mediacms"
git clone https://github.com/mediacms-io/mediacms
cd mediacms

## Ubuntu 24 specific dependencies
if [[ $osVersion == *"Ubuntu 24"* ]] || [[ $osVersion == *"trixie"* ]]; then
    pip install --no-binary lxml lxml==5.4.0
    pip install --no-binary xmlsec xmlsec==1.3.15
    pip install -r requirements-ubuntu-24.txt
else
    pip install --no-binary lxml lxml==4.9.2
    pip install --no-binary xmlsec xmlsec==1.3.13
    pip install -r requirements.txt
fi

SECRET_KEY=`python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'`

# remove http or https prefix
FRONTEND_HOST=`echo "$FRONTEND_HOST" | sed -r 's/http:\/\///g'`
FRONTEND_HOST=`echo "$FRONTEND_HOST" | sed -r 's/https:\/\///g'`

sed -i s/localhost/$FRONTEND_HOST/g deploy/local_install/mediacms.io

FRONTEND_HOST_HTTP_PREFIX='http://'$FRONTEND_HOST

echo 'FRONTEND_HOST='\'"$FRONTEND_HOST_HTTP_PREFIX"\' >> cms/local_settings.py
echo 'PORTAL_NAME='\'"$PORTAL_NAME"\' >> cms/local_settings.py
echo "SSL_FRONTEND_HOST = FRONTEND_HOST.replace('http', 'https')" >> cms/local_settings.py

echo 'SECRET_KEY='\'"$SECRET_KEY"\' >> cms/local_settings.py
echo "LOCAL_INSTALL = True" >> cms/local_settings.py

mkdir logs
mkdir pids
python manage.py migrate
python manage.py loaddata fixtures/encoding_profiles.json
python manage.py loaddata fixtures/categories.json
python manage.py collectstatic --noinput

ADMIN_PASS=`python -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))"`
echo "from users.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASS')" | python manage.py shell

echo "from django.contrib.sites.models import Site; Site.objects.update(name='$FRONTEND_HOST', domain='$FRONTEND_HOST')" | python manage.py shell

chown -R www-data. /home/mediacms.io/
cp deploy/local_install/celery_long.service /etc/systemd/system/celery_long.service && systemctl enable celery_long && systemctl start celery_long
cp deploy/local_install/celery_short.service /etc/systemd/system/celery_short.service && systemctl enable celery_short && systemctl start celery_short
cp deploy/local_install/celery_beat.service /etc/systemd/system/celery_beat.service && systemctl enable celery_beat &&systemctl start celery_beat
cp deploy/local_install/mediacms.service /etc/systemd/system/mediacms.service && systemctl enable mediacms.service && systemctl start mediacms.service

mkdir -p /etc/letsencrypt/live/mediacms.io/
mkdir -p /etc/letsencrypt/live/$FRONTEND_HOST
mkdir -p /etc/nginx/sites-enabled
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/dhparams/
rm -rf /etc/nginx/conf.d/default.conf
rm -rf /etc/nginx/sites-enabled/default
cp deploy/local_install/mediacms.io_fullchain.pem /etc/letsencrypt/live/$FRONTEND_HOST/fullchain.pem
cp deploy/local_install/mediacms.io_privkey.pem /etc/letsencrypt/live/$FRONTEND_HOST/privkey.pem
cp deploy/local_install/dhparams.pem /etc/nginx/dhparams/dhparams.pem
cp deploy/local_install/mediacms.io /etc/nginx/sites-available/mediacms.io
ln -s /etc/nginx/sites-available/mediacms.io /etc/nginx/sites-enabled/mediacms.io
cp deploy/local_install/uwsgi_params /etc/nginx/sites-enabled/uwsgi_params
cp deploy/local_install/nginx.conf /etc/nginx/
systemctl stop nginx
systemctl start nginx

# attempt to get a valid certificate for specified domain

if [ "$FRONTEND_HOST" != "localhost" ]; then
    echo 'attempt to get a valid certificate for specified url $FRONTEND_HOST'
    certbot --nginx -n --agree-tos --register-unsafely-without-email -d $FRONTEND_HOST
    certbot --nginx -n --agree-tos --register-unsafely-without-email -d $FRONTEND_HOST
    # unfortunately for some reason it needs to be run two times in order to create the entries
    # and directory structure!!!
    systemctl restart nginx
else
    echo "will not call certbot utility to update ssl certificate for url 'localhost', using default ssl certificate"
fi

# Generate individual DH params
if [ "$FRONTEND_HOST" != "localhost" ]; then
    # Only generate new DH params when using "real" certificates.
    openssl dhparam -out /etc/nginx/dhparams/dhparams.pem 4096
    systemctl restart nginx
else
    echo "will not generate new DH params for url 'localhost', using default DH params"
fi

# Bento4 utility installation, for HLS

cd /home/mediacms.io/mediacms
wget http://zebulon.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip
unzip Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip
mkdir /home/mediacms.io/mediacms/media_files/hls

# last, set default owner
chown -R www-data. /home/mediacms.io/

echo 'MediaCMS installation completed, open browser on http://'"$FRONTEND_HOST"' and login with user admin and password '"$ADMIN_PASS"''
