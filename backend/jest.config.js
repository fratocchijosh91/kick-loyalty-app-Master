{
  "testEnvironment": "node",
  "coveragePathIgnorePatterns": ["/node_modules/"],
  "collectCoverageFrom": [
    "**/*.js",
    "!**/node_modules/**",
    "!**/__tests__/**",
    "!**/dist/**"
  ],
  "testMatch": [
    "**/__tests__/**/*.test.js"
  ],
  "setupFilesAfterEnv": [
    "<rootDir>/jest.setup.js"
  ]
}
