const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/", "coverage/"],
  },

  // Base appliquée à TOUS les fichiers .js du projet.
  // Sans ce bloc "**/*.js", un fichier nouvellement créé ne correspondrait à
  // aucune configuration et ne serait donc analysé par aucune règle.
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // no-unused-vars et no-undef viennent de la base recommandée
      ...js.configs.recommended.rules,
      semi: ["error", "always"],
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  // Le jeu s'exécute dans le navigateur : document, fetch, setInterval, etc.
  {
    files: ["script.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Les tests tournent dans un navigateur simulé, avec les globales de Jest
  {
    files: ["script.test.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
];
