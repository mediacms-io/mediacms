# MediaCMS Web Client (demo)

### **Requirements**

- nodejs: version >= 14.17.0

---

### **Installation**

    npm install

---

### **Development**

    npm run start

Open in browser: [http://localhost:8088](http://localhost:8088)

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
