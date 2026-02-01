# JavaScript Build Instructions

These instructions explain how to manually rebuild the JavaScript modules for the TinyMCE plugin. Moodle requires AMD modules, but the source code is written in ES6.

### Prerequisites
*   Node.js 16+ (Node 22 recommended)

### Build Steps

1.  **Navigate to the package root:**
    ```bash
    cd lms-plugins/mediacms-moodle
    ```

2.  **Initialize dependencies:**
    (Only needed the first time)
    ```bash
    npm init -y
    npm install --save-dev @babel/core @babel/cli @babel/preset-env @babel/plugin-transform-modules-amd
    ```

3.  **Run the Build:**
    This command uses the local Babel binary to avoid version conflicts and transpiles the code to AMD format.
    ```bash
    ./node_modules/.bin/babel tiny/mediacms/amd/src --out-dir tiny/mediacms/amd/build --presets=@babel/preset-env --plugins=@babel/plugin-transform-modules-amd
    ```

4.  **Minify (Optional but Recommended):**
    Moodle loads `.min.js` files by default. This creates copies for production use.
    ```bash
    cd tiny/mediacms/amd/build
    for f in *.js; do cp "$f" "${f%.js}.min.js"; done
    ```
