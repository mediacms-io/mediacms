#!/bin/bash
# should be run as root on a rhel8-like system

function update_permissions
{
	# fix permissions of /srv/mediacms directory
	chown -R nginx:root $1
}

echo "Welcome to the MediacMS installation!";

if [ `id -u` -ne 0 ]; then
	echo "Please run as root user"
	exit
fi


while true; do
    read -p "
This script will attempt to perform a system update, install required dependencies, and configure PostgreSQL, NGINX, Redis and a few other utilities.
It is expected to run on a new system **with no running instances of any these services**. Make sure you check the script before you continue. Then enter y or n
" yn
    case $yn in
        [Yy]* ) echo "OK!"; break;;
        [Nn]* ) echo "Have a great day"; exit;;
        * ) echo "Please answer y or n.";;
    esac
done

# update configuration files

sed -i 's/\/home\/mediacms\.io\/mediacms\/Bento4-SDK-1-6-0-637\.x86_64-unknown-linux\/bin\/mp4hls/\/srv\/mediacms\/bento4\/bin\/mp4hls/g' cms/settings.py
sed -i 's/www-data/nginx/g;s/\/home\/mediacms\.io\/mediacms\/logs/\/var\/log\/mediacms/g;s/\/home\/mediacms\.io\/mediacms/\/srv\/mediacms/g;s/\/home\/mediacms\.io\/bin/\/srv\/mediacms\/virtualenv\/bin/g' deploy/local_install/celery_*.service
sed -i 's/\/home\/mediacms\.io\/mediacms/\/srv\/mediacms/g' deploy/local_install/mediacms.io
sed -i 's/\/home\/mediacms\.io\/bin/\/srv\/mediacms\/virtualenv\/bin/g;s/\/home\/mediacms\.io\/mediacms/\/srv\/mediacms/g' deploy/local_install/mediacms.service
sed -i 's/\/home\/mediacms\.io\/mediacms/\/var\/log\/mediacms/g' deploy/local_install/mediacms_logrorate
sed -i 's/www-data/nginx/g' deploy/local_install/nginx.conf
sed -i 's/www-data/nginx/g;s/\/home\/mediacms\.io\/mediacms\/logs/\/var\/log\/mediacms/g;s/\/home\/mediacms\.io\/mediacms/\/srv\/mediacms/g;s/\/home\/mediacms\.io/\/srv\/mediacms\/virtualenv/g' deploy/local_install/uwsgi.ini

osVersion=

if [[ -f /etc/os-release ]]; then
	osVersion=$(grep ^ID /etc/os-release)
fi

if [[ $osVersion == *"fedora"* ]] || [[ $osVersion == *"rhel"*  ]] || [[ $osVersion == *"centos"* ]] || [[ *"rocky"* ]]; then
	dnf install -y epel-release https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-8.noarch.rpm yum-utils
	yum-config-manager --enable powertools
	dnf install -y python3-virtualenv python39-devel redis postgresql postgresql-server nginx git gcc vim unzip ImageMagick python3-certbot-nginx certbot wget xz ffmpeg policycoreutils-devel cmake gcc gcc-c++ wget git bsdtar
else
    echo "unsupported or unknown os"
    exit -1
fi

# fix permissions of /srv/mediacms directory
update_permissions /srv/mediacms/

read -p "Enter portal URL, or press enter for localhost : " FRONTEND_HOST
read -p "Enter portal name, or press enter for 'MediaCMS : " PORTAL_NAME

[ -z "$PORTAL_NAME" ] && PORTAL_NAME='MediaCMS'
[ -z "$FRONTEND_HOST" ] && FRONTEND_HOST='localhost'

echo "Configuring postgres"
if [ ! command -v postgresql-setup > /dev/null 2>&1 ]; then
        echo "Something went wrong, the command 'postgresql-setup' was not found in the system path."
        exit -1
fi

postgresql-setup --initdb

# set authentication method for mediacms user to scram-sha-256
sed -i 's/.*password_encryption.*/password_encryption = scram-sha-256/' /var/lib/pgsql/data/postgresql.conf
sed -i '/# IPv4 local connections:/a host\tmediacms\tmediacms\t127.0.0.1/32\tscram-sha-256' /var/lib/pgsql/data/pg_hba.conf

systemctl enable postgresql.service --now

su -c "psql -c \"CREATE DATABASE mediacms\"" postgres
su -c "psql -c \"CREATE USER mediacms WITH ENCRYPTED PASSWORD 'mediacms'\"" postgres
su -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE mediacms TO mediacms\"" postgres

echo 'Creating python virtualenv on /srv/mediacms/virtualenv/'

mkdir /srv/mediacms/virtualenv/
cd /srv/mediacms/virtualenv/
virtualenv . --python=python3
source  /srv/mediacms/virtualenv/bin/activate
cd /srv/mediacms/
pip install -r requirements.txt

systemctl enable redis.service --now

SECRET_KEY=`python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'`

# remove http or https prefix
FRONTEND_HOST=`echo "$FRONTEND_HOST" | sed -r 's/http:\/\///g'`
FRONTEND_HOST=`echo "$FRONTEND_HOST" | sed -r 's/https:\/\///g'`

FRONTEND_HOST_HTTP_PREFIX='http://'$FRONTEND_HOST

echo 'FRONTEND_HOST='\'"$FRONTEND_HOST_HTTP_PREFIX"\' >> cms/local_settings.py
echo 'PORTAL_NAME='\'"$PORTAL_NAME"\' >> cms/local_settings.py
echo "SSL_FRONTEND_HOST = FRONTEND_HOST.replace('http', 'https')" >> cms/local_settings.py

echo 'SECRET_KEY='\'"$SECRET_KEY"\' >> cms/local_settings.py
echo "LOCAL_INSTALL = True" >> cms/local_settings.py

mkdir /var/log/mediacms/
mkdir pids

update_permissions /var/log/mediacms/

python manage.py migrate
python manage.py loaddata fixtures/encoding_profiles.json
python manage.py loaddata fixtures/categories.json
python manage.py collectstatic --noinput

ADMIN_PASS=`python -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))"`
echo "from users.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASS')" | python manage.py shell

echo "from django.contrib.sites.models import Site; Site.objects.update(name='$FRONTEND_HOST', domain='$FRONTEND_HOST')" | python manage.py shell

update_permissions /srv/mediacms/

cp deploy/local_install/celery_long.service /etc/systemd/system/celery_long.service
cp deploy/local_install/celery_short.service /etc/systemd/system/celery_short.service
cp deploy/local_install/celery_beat.service /etc/systemd/system/celery_beat.service
cp deploy/local_install/mediacms.service /etc/systemd/system/mediacms.service

mkdir -p /etc/letsencrypt/live/$FRONTEND_HOST
mkdir -p /etc/nginx/sites-enabled
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/dhparams/
rm -rf /etc/nginx/conf.d/default.conf
rm -rf /etc/nginx/sites-enabled/default
cp deploy/local_install/mediacms.io_fullchain.pem /etc/letsencrypt/live/$FRONTEND_HOST/fullchain.pem
cp deploy/local_install/mediacms.io_privkey.pem /etc/letsencrypt/live/$FRONTEND_HOST/privkey.pem
cp deploy/local_install/mediacms.io /etc/nginx/sites-available/mediacms.io
ln -s /etc/nginx/sites-available/mediacms.io /etc/nginx/sites-enabled/mediacms.io
cp deploy/local_install/uwsgi_params /etc/nginx/sites-enabled/uwsgi_params
cp deploy/local_install/nginx.conf /etc/nginx/

# attempt to get a valid certificate for specified domain
while true ; do
        echo "Would you like to run [c]ertbot, or [s]kip?"
        read -p " : " certbotConfig

        case $certbotConfig in
        [cC*] )
		if [ "$FRONTEND_HOST" != "localhost" ]; then
			systemctl start
			echo 'attempt to get a valid certificate for specified url $FRONTEND_HOST'
			certbot --nginx -n --agree-tos --register-unsafely-without-email -d $FRONTEND_HOST
			certbot --nginx -n --agree-tos --register-unsafely-without-email -d $FRONTEND_HOST
			# unfortunately for some reason it needs to be run two times in order to create the entries
			# and directory structure!!!
			systemctl stop nginx

			# Generate individual DH params
			openssl dhparam -out /etc/nginx/dhparams/dhparams.pem 4096
		fi

                break
                ;;
        [sS*] )
		echo "will not call certbot utility to update ssl certificate for url 'localhost', using default ssl certificate"
		cp deploy/local_install/dhparams.pem /etc/nginx/dhparams/dhparams.pem

                break
                ;;
        * )
                echo "Unknown option: $certbotConfig"
                ;;
        esac
done

# configure bento4 utility installation, for HLS
while true ; do
	echo "Configuring Bento4"
	echo "Would you like to [d]ownload a pre-compiled bento4 binary, or [b]uild it now?"
	read -p "b/d : " bentoConfig

	case $bentoConfig in
	[bB*] )
		echo "Building bento4 from source"
		git clone -b v1.6.0-640 https://github.com/axiomatic-systems/Bento4 /srv/mediacms/bento4
		cd /srv/mediacms/bento4/
		mkdir bin
		cd /srv/mediacms/bento4/bin/
		cmake -DCMAKE_BUILD_TYPE=Release ..
		make -j$(nproc)

		chmod +x ../Source/Python/utils/mp4-hls.py

		echo -e '#!/bin/bash' >> mp4hls
		echo -e 'BASEDIR=$(pwd)' >> mp4hls
		echo -e 'exec python3 "$BASEDIR/../Source/Python/utils/mp4-hls.py"' >> mp4hls

		chmod +x mp4hls

		break
		;;
	[dD*] )
		cd /srv/mediacms/
		wget http://zebulon.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip
		bsdtar -xf Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip -s '/Bento4-SDK-1-6-0-637.x86_64-unknown-linux/bento4/'

		break
		;;
	* )
		echo "Unknown option: $bentoConfig"
		;;
	esac
done

mkdir /srv/mediacms/media_files/hls

# update permissions

update_permissions /srv/mediacms/

# configure selinux

while true ; do
        echo "Configuring SELinux"
        echo "Would you like to [d]isable SELinux until next reboot, [c]onfigure our SELinux module, or [s]kip and not do any SELinux confgiguration?"
        read -p "d/c/s : " seConfig

        case $seConfig in
        [Dd]* )
                echo "Disabling SELinux until next reboot"
                break
                ;;
        [Cc]* )
                echo "Configuring custom mediacms selinux module"

		semanage fcontext -a -t bin_t /srv/mediacms/virtualenv/bin/
		semanage fcontext -a -t httpd_sys_content_t "/srv/mediacms(/.*)?"
		restorecon -FRv /srv/mediacms/

		sebools=(httpd_can_network_connect httpd_graceful_shutdown httpd_can_network_relay nis_enabled httpd_setrlimit domain_can_mmap_files)

		for bool in "${sebools[@]}"
		do
			setsebool -P $bool 1
		done

		cd /srv/mediacms/deploy/local_install/
		make -f /usr/share/selinux/devel/Makefile selinux-mediacms.pp
		semodule -i selinux-mediacms.pp

                break
                ;;
        [Ss]* )
                echo "Skipping SELinux configuration"
                break
                ;;
        * )
                echo "Unknown option: $seConfig"
                ;;
        esac
done

# configure firewall
if command -v firewall-cmd > /dev/null 2>&1 ; then
	while true ; do
	        echo "Configuring firewall"
	        echo "Would you like to configure http, https, or skip and not do any firewall configuration?"
	        read -p "http/https/skip : " fwConfig

		case $fwConfig in
	        http )
	                echo "Opening port 80 until next reboot"
			firewall-cmd --add-port=80/tcp
	                break
	                ;;
	        https )
			echo "Opening port 443 permanently"
			firewall-cmd --add-port=443/tcp --permanent
			firewall-cmd --reload
	                break
	                ;;
	        skip )
	                echo "Skipping firewall configuration"
	                break
	                ;;
	        * )
	                echo "Unknown option: $fwConfig"
	                ;;
	        esac
	done

fi

systemctl daemon-reload
systemctl start celery_long.service
systemctl start celery_short.service
systemctl start celery_beat.service
systemctl start mediacms.service
systemctl start nginx.service

echo 'MediaCMS installation completed, open browser on http://'"$FRONTEND_HOST"' and login with user admin and password '"$ADMIN_PASS"''
