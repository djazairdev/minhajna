// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@minhajna/core$': '<rootDir>/../../packages/core/src/index.ts',
  },
  // Core files are outside the app, but use the app's Babel runtime helpers.
  modulePaths: ['<rootDir>/node_modules'],
};
