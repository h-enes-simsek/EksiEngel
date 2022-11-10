# https://www.digitalocean.com/community/tutorials/how-to-set-up-django-with-postgres-nginx-and-gunicorn-on-ubuntu-22-04

# install necessary libs
sudo apt update
sudo apt install python3-venv python3-dev libpq-dev postgresql postgresql-contrib nginx curl

# setup postgresql
sudo -u postgres psql
CREATE DATABASE myproject;
CREATE USER myprojectuser WITH PASSWORD 'password';
ALTER ROLE myprojectuser SET client_encoding TO 'utf8';
ALTER ROLE myprojectuser SET default_transaction_isolation TO 'read committed';
ALTER ROLE myprojectuser SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE myproject TO myprojectuser;
\q

# install django project (maybe from git)
git clone <project_path>

# create python venv for django
cd <django_root_path> # not in the /root or anyfolder about system
python3 -m venv myprojectenv
source myprojectenv/bin/activate
pip install django gunicorn psycopg2-binary
pip install django-cors-headers # if disabling cors is required

# create .env file for hardcoded settings
pip install django-environ
cd <django_root_path>/<project_name>
nano .env
SECRET_KEY=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASS=
DEBUG=

# configure django settings
# ALLOWED_HOSTS = "*" is to internet access
ALLOWED_HOSTS 
DEBUG 
DEVELOPMENT_MODE 

# database ops
python manage.py makemigrations <app_name>
python3 manage.py migrate
python3 manage.py migrate <app_name>

# load initial hardcoded values to database if any
python manage.py loaddata enums.json # this is project specific

# allow port if necessary with ufw
ufw allow <port_number>

# start
python3 manage.py runserver 0.0.0.0:<port_number>

# At this point it should be accessible from internet. Stop server.

### Reserve proxy with nginx
# configure allowed host (. is for subdomains as well in .example.com) in settings.py
ALLOWED_HOSTS = ['.example.com', '203.0.113.1', 'localhost']

# configure static file if not configured in settings.py
import os
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
STATIC_URL = '/static/'

# create user if not exist
python3 manage.py createsuperuser

# collect static files
python3 manage.py collectstatic

# test with gunicorn, it should be accessible from internet, then stop server
gunicorn --bind 0.0.0.0:<port_number> myproject.wsgi
deactivate

# gunicorn socket (communication between gunicorn and nginx)
sudo nano /etc/systemd/system/gunicorn.socket
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target

sudo nano /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=<project_path>
ExecStart=<project_virtual_env>/bin/gunicorn \
          --access-logfile - \
          --workers 3 \
          --bind unix:/run/gunicorn.sock \
          <myproject>.wsgi:application

[Install]
WantedBy=multi-user.target

sudo systemctl start gunicorn.socket
sudo systemctl enable gunicorn.socket
sudo systemctl status gunicorn.socket # should be active
file /run/gunicorn.sock # output: /run/gunicorn.sock: socket
sudo journalctl -u gunicorn.socket # if fails, how to see logs

sudo systemctl stop gunicorn.socket # to stop if necessary (because it is automatically trigger gunicorn)

# if /etc/systemd/system/gunicorn.service changes, run these to restart
sudo systemctl daemon-reload
sudo systemctl restart gunicorn

## nginx config
# create nginx config
sudo nano /etc/nginx/sites-available/myproject
server {
    listen <port>;
    server_name <server_domain_or_IP>;

    location = /favicon.ico { access_log off; log_not_found off; }
    location /static/ {
        root <project_path>;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }
}
# create sym link
sudo ln -s /etc/nginx/sites-available/myproject /etc/nginx/sites-enabled

sudo systemctl restart nginx


