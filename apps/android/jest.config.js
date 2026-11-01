// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

module.exports = {
  preset: '@react-native/jest-preset',
  // Exercise real navigation state in Jest; only the native views are absent.
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)'],
  setupFiles: ['<rootDir>/jest/setup.ts'],
  // The release build's checks start with no transform cache, so a suite's
  // first test also compiles everything its screen imports. On CI runners that
  // has taken more than Jest's usual 5 s.
  testTimeout: 20000,
  moduleNameMapper: {
    '^@minhajna/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@minhajna/core/test-support$': '<rootDir>/../../packages/core/test/history-store-suite.ts',
    '^@minhajna/core/test-support/demo-year$': '<rootDir>/../../packages/core/test/demo-year.ts',
    '^@minhajna/data/(.*)$': '<rootDir>/../../data/$1',
    // The server's own modules, which the demo server's tests import, name
    // the files they import as Node runs them, compiled.
    '^\\.\\./worlds/(stand-in-ca|world-rules)\\.js$': '<rootDir>/../server/src/worlds/$1.ts',
    '^\\.\\./spaces/(space-rules|space-store)\\.js$': '<rootDir>/../server/src/spaces/$1.ts',
    '^\\./stand-in-ca\\.js$': '<rootDir>/../server/src/worlds/stand-in-ca.ts',
  },
  // Core files are outside the app, but use the app's Babel runtime helpers.
  modulePaths: ['<rootDir>/node_modules'],
};
