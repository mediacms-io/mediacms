module.exports = {
    "extends": ["eslint:recommended"],
    "env": { "es6": true, "browser": true, "node": true },
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2018
    },
    "rules": {
        "indent": ["error", "tab"],
        "linebreak-style": ["error", "unix"],
        "quotes": ["error", "single"],
        "semi": ["error", "always"],
        'no-empty': ["error", { "allowEmptyCatch": true }],
        'no-constant-condition': ["error", { "checkLoops": false }],
    },
    "overrides": [{
        "plugins": [ "@typescript-eslint" ],
        "parser": "@typescript-eslint/parser",
        "files": ["**/*.ts", "**/*.tsx"],
        "extends": [
            "eslint:recommended",
            "plugin:@typescript-eslint/eslint-recommended",
            "plugin:@typescript-eslint/recommended"
        ],
        "parserOptions": {
            "ecmaFeatures": { "jsx": true },
            "ecmaVersion": 2018,
            "sourceType": "module",
            "project": "./tsconfig.json"
        },
        "rules": {
            "no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
            "@typescript-eslint/no-var-requires": "off"
        },
    }]
}