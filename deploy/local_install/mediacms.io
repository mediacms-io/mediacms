server {
    listen 80 ;
    server_name localhost;

    gzip on;
    access_log /var/log/nginx/mediacms.io.access.log;

    error_log  /var/log/nginx/mediacms.io.error.log  warn;

#    # redirect to https if logged in
#    if ($http_cookie ~* "sessionid") {
#        rewrite  ^/(.*)$  https://localhost/$1  permanent;
#    }

#    # redirect basic forms to https
#    location ~ (login|login_form|register|mail_password_form)$ {
#        rewrite  ^/(.*)$  https://localhost/$1  permanent;
#    }

    location /static {
        alias /home/mediacms.io/mediacms/static ;
    }

    location /media/original {
        alias /home/mediacms.io/mediacms/media_files/original;
    }

    location /media {
        alias /home/mediacms.io/mediacms/media_files ;
    }

    location / {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range';

        include /etc/nginx/sites-enabled/uwsgi_params;
        uwsgi_pass 127.0.0.1:9000;
    }
}

server {
    listen 443 ssl;
    server_name localhost;

    ssl_certificate_key  /etc/letsencrypt/live/localhost/privkey.pem;
    ssl_certificate  /etc/letsencrypt/live/localhost/fullchain.pem;
    ssl_dhparam /etc/nginx/dhparams/dhparams.pem;

    ssl_protocols TLSv1.2 TLSv1.3; # Dropping SSLv3, ref: POODLE
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_ecdh_curve secp521r1:secp384r1;
    ssl_prefer_server_ciphers on;

    gzip on;
    access_log /var/log/nginx/mediacms.io.access.log;

    error_log  /var/log/nginx/mediacms.io.error.log  warn;

    location /static {
        alias /home/mediacms.io/mediacms/static ;
    }

    location /media/original {
        alias /home/mediacms.io/mediacms/media_files/original;
        #auth_basic "auth protected area";
        #auth_basic_user_file /home/mediacms.io/mediacms/deploy/local_install/.htpasswd;
    }

    location /media {
        alias /home/mediacms.io/mediacms/media_files ;
    }

    location / {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range';

    include /etc/nginx/sites-enabled/uwsgi_params;
    uwsgi_pass 127.0.0.1:9000;
    }
}
