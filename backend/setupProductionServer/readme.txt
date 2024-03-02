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

if there is a test code to carry out test, the user might need to create a db priviliage
ALTER USER myprojectuser CREATEDB;

\q

# install django project (maybe from git)
git clone <project_path>

# create python venv for django
cd <django_root_path>/backend # not in the /root or anyfolder about system
python3 -m venv myprojectenv
source myprojectenv/bin/activate

pip install -r requirements.txt
(racknerd had a problem about psycopg2 because some essentials libs were missing, if so install :
sudo apt-get install build-essential
sudo apt-get install python-dev
)
pip install django-cors-headers (included in requirements.txt, if disabling cors is required)

# create .env file for hardcoded settings
pip install django-environ (included in requirements.txt)
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

# load initial hardcoded values to database if any (do not run this if db is going to be moved)
python manage.py loaddata enums.json # this is project specific

### if the django project is planned to be moved
# dump the old data from old project
python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 2 > dump.json

# load the old data to new project
python manage.py loaddata dump.json

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


Example::::
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/EksiEngel/backend/django_EksiEngel
ExecStart=/var/www/EksiEngel/backend/VENV_Django_4_1_EksiEngel/bin/gunicorn \
          --access-logfile - \
          --workers 3 \
          --bind unix:/run/gunicorn.sock \
          django_EksiEngel.wsgi:application

[Install]
WantedBy=multi-user.target


sudo systemctl start gunicorn.socket
sudo systemctl enable gunicorn.socket
sudo systemctl status gunicorn.socket # should be active
file /run/gunicorn.sock # output: /run/gunicorn.sock: socket
sudo journalctl -u gunicorn.socket # if fails, how to see logs

sudo systemctl stop gunicorn.socket # to stop if necessary (because it is automatically trigger gunicorn)
# restarting gunicorn.socket causes django server to be restart

# if /etc/systemd/system/gunicorn.service changes, run these to restart
sudo systemctl daemon-reload
sudo systemctl restart gunicorn

## nginx config
# create nginx config
sudo nano /etc/nginx/sites-available/myproject
sudo nano /etc/nginx/sites-available/eksiengel.hesimsek.com
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


Example:::
server {
    listen 80;
    server_name eksiengel.hesimsek.com www.eksiengel.hesimsek.com;
    location = /favicon.ico { access_log off; log_not_found off; }
    location /static/ {
        root /var/www/EksiEngel/server/djangoRelated/django_EksiEngel;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }

}



# create sym link
sudo ln -s /etc/nginx/sites-available/myproject /etc/nginx/sites-enabled

sudo systemctl restart nginx


