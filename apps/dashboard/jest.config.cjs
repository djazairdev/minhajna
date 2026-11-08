// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard's screen tests run with the Android app's Jest, its settings
// and its fakes (answer 855), as the dashboard is built from the app's own
// components. The packages both use come from the app's install alone, so
// one React runs, whichever folder a module sits in.

const path = require('node:path');
const app = require('../android/jest.config.js');

module.exports = {
  ...app,
  rootDir: path.resolve(__dirname, '../android'),
  roots: [__dirname],
  testMatch: [path.join(__dirname, '__tests__/*.test.{ts,tsx}')],
  moduleNameMapper: {
    '^(react|i18next|react-i18next|react-native-safe-area-context|@react-navigation/[a-z-]+)(/.*)?$':
      '<rootDir>/node_modules/$1$2',
    ...app.moduleNameMapper,
  },
};
