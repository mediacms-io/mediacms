# How to

## Deploy changes on server

Pull new commits by Git. Then, if server is not up, bring it up:

```
sudo su
cd /home/mediacms.io/mediacms/
/usr/local/bin/docker-compose -f docker-compose-letsencrypt.yaml up -d
```

Deploy changes on server after modifying database table models:

```
sudo su
/usr/local/bin/docker-compose exec -T web python manage.py makemigrations
/usr/local/bin/docker-compose exec -T web python manage.py migrate
/usr/local/bin/docker-compose restart web celery_worker celery_beat
```

## Add user to admin panel:

```
sudo su
/usr/local/bin/docker-compose exec web python manage.py createsuperuser
```

## Troubleshoot server PIP

If Django version is messed up by playing around with `python -m pip install ...`, it can restored by:

```
sudo su
/usr/local/bin/docker-compose exec web python -m pip install -r requirements.txt
/usr/local/bin/docker-compose restart web celery_worker celery_beat
```

## Start development

```
docker-compose -f docker-compose-dev.yaml build
docker-compose -f docker-compose-dev.yaml up
```

## Deploy front-end changes

There is no need for back-end restart.

```
cd /home/mediacms.io/mediacms
docker-compose -f docker-compose-dev.yaml exec frontend npm run dist
cp -r frontend/dist/static/* static/
git checkout static/favicons/ static/images/
git add static/
git commit
```

## Merge upstream

### Undeploy before upstream merge

While pulling from upstream, if some deployed files like `static/js/_commons.js`, `static/js/embed.js`, `static/js/media.js` have conflict, they can be un-deployed by:

```
git checkout upstream/main --  static/js/_commons.js static/js/embed.js static/js/media.js
```

### Re-deploy

After pulling from upstream and getting latest updates, then, front-end redeployment can be done by the previous instructions.

## Custom DAW

### How to build

```
git clone https://github.com/Micrufun/daw.git frontend/packages/wfpl
cd frontend/packages/wfpl/
npm install --legacy-peer-deps
```

### Notes

* There would be some errors without the `--legacy-peer-deps` option.
* Command `npm run prepare` creates these folders:
   * `lib`
   * `styles`
   * `build`
* `prepare` script is also executed when you run `npm install --legacy-peer-deps` 
   * https://stackoverflow.com/a/44835454/3405291
* To start development server on openSUSE Leap 15.4:
   * zypper in ruby-devel
   * gem install jekyll
   * cd /usr/bin/
   * ln -sv jekyll.ruby2.5 jekyll
   * cd /home/mediacms.io/mediacms/frontend/packages/wfpl/
   * npm run build
   * npm run start
* Maybe helpful: https://github.com/naomiaro/waveform-playlist/issues/51#issuecomment-284560392
