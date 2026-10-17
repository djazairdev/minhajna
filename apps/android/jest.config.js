// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

module.exports = {
  preset: '@react-native/jest-preset',
  // Exercise real navigation state in Jest; only the native views are absent.
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)'],
  setupFiles: ['<rootDir>/jest/setup.ts'],
  moduleNameMapper: {
    '^@minhajna/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@minhajna/core/test-support$': '<rootDir>/../../packages/core/test/history-store-suite.ts',
    '^@minhajna/core/test-support/demo-year$': '<rootDir>/../../packages/core/test/demo-year.ts',
    '^@minhajna/data/(.*)$': '<rootDir>/../../data/$1',
  },
  // Core files are outside the app, but use the app's Babel runtime helpers.
  modulePaths: ['<rootDir>/node_modules'],
};
