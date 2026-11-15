# MediaCMS Web Client (demo)

### **Requirements**

- nodejs: version >= 20.9.0

---

### **Installation**

    npm install

---

### **Development**

    npm run start

Open in browser: [http://localhost:8088](http://localhost:8088)

The dev server proxies every request to the Django app set in `MEDIACMS_BACKEND` (default `http://localhost`, `http://web` in docker-compose-dev via `.env`) and serves the `static/js` and `static/css` bundles from the live build, so pages, data, login and POSTs are the real ones.

Each page bundle has an entry file in `src/entries/<name>.js`, built to `static/js/<name>.js` and loaded by the matching Django template. Styles used by more than one entry go to `static/css/_commons.css`; styles used by a single entry go to `static/css/<name>.css`.

---

### **Build**

    npm run dist

Generates the folder "**_frontend/dist_**".

Copy folders and files from "**_frontend/dist/static_**" into "**_static_**".

---

### Test Scripts

#### test

Run all unit tests once.

```sh
npm run test
```

#### test-watch

Run tests in watch mode for development.

```sh
npm run test-watch
```

#### test-coverage

Run tests with coverage reporting in `./coverage` folder.

```sh
npm run test-coverage
```

#### test-coverage-watch

Run tests with coverage in watch mode.

```sh
npm run test-coverage-watch
```
