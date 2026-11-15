# Developer Experience
There is ongoing effort to provide a better developer experience and document it.

## How to develop locally with Docker
First install a recent version of [Docker](https://docs.docker.com/get-docker/), and [Docker Compose](https://docs.docker.com/compose/install/).

Then run `docker compose -f docker-compose-dev.yaml up`

```
user@user:~/mediacms$ docker compose -f docker-compose-dev.yaml up
```

In a few minutes the app will be available at http://localhost . Login via admin/admin

### What does docker-compose-dev.yaml do?
It build the two images used for backend and frontend.

* Backend: `mediacms/mediacms-dev:latest`
* Frontend: `frontend`

and will start all services required for MediaCMS, as Celery/Redis for asynchronous tasks, PostgreSQL database, Django and React

For Django, the changes from the image produced by docker-compose.yaml are these:

* Django runs in debug mode, with `python manage.py runserver`
* gunicorn and nginx are not run
* Django runs in Debug mode, with Debug Toolbar
* Static files (js/css) are loaded from static/ folder
* corsheaders is installed and configured to allow all origins

For React, it will run `npm start` in the frontend folder, which starts the webpack dev server on http://localhost:8088/ . It proxies every page and API request to Django, and serves the js/css bundles from the live build, so you see the real Django pages with your frontend changes.

### How to develop in Django
Django starts at http://localhost and is reloading automatically. Making any change to the python code should refresh Django.

If Django breaks due to an error (eg SyntaxError, while editing the code), you might have to restart it

```
docker compose -f docker-compose-dev.yaml restart web
```



### How to develop in React
The dev server is on http://localhost:8088/ and the code is in frontend/ , so changes are rebuilt and the page reloads. The pages, data and login are Django's, so forms and POSTs work as on the real site. Django itself only serves what is in static/, so build the frontend before committing.

### Making changes to the frontend

The way React is added is more complicated than the usual SPA project and this is because React is used as a library loaded by Django Templates, so it is not a standalone project and is not handling routes etc.

The two directories to consider are:
* frontend/src , for the React files
* templates/, for the Django templates.

Django is using a highly intuitive hierarchical templating system (https://docs.djangoproject.com/en/4.2/ref/templates/), where the base template is templates/root.html and all other templates are extending it.

React is called through the Django templates, eg templates/cms/media.html is loading js/media.js

In order to make changes to React code, edit code on frontend/src and check its effect on http://localhost:8088/ . Once ready, build it and copy it to the Django static folder, so that it is served by Django.

Each page bundle has an entry file in frontend/src/entries/<name>.js, and templates/cms/<page>.html loads static/js/<name>.js together with static/js/_commons.js. Styles used by more than one page go to static/css/_commons.css; styles used by a single page go to static/css/<name>.css, which that page's template must link. The build is configured in frontend/webpack.config.js.

### Development workflow with the frontend
1. Edit frontend/src/ files
2. Check changes on http://localhost:8088/
3. Build frontend with `docker compose -f docker-compose-dev.yaml exec frontend npm run dist`
4. Copy static files to Django static folder with`cp -r frontend/dist/static/* static/`
5. Restart Django - `docker compose -f docker-compose-dev.yaml restart web` so that it uses the new static files
6. Commit the changes

### Helper commands
There is ongoing effort to provide helper commands, check the Makefile for what it supports. Eg

Bash into the web container:

```
user@user:~/mediacms$ make admin-shell
root@ca8c1096726b:/home/mediacms.io/mediacms# ./manage.py shell
```

Build the frontend:

```
user@user:~/mediacms$ make build-frontend
docker compose -f docker-compose-dev.yaml exec frontend npm run dist

> mediacms-frontend@0.9.2 dist
> webpack --mode=production
...
```