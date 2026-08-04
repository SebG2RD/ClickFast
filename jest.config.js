/** @type {import('jest').Config} */
module.exports = {
  // jsdom simule un navigateur (document, window, événements) dans Node
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: ["script.js"],
};
