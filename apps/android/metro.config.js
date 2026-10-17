// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const coreRoot = path.resolve(__dirname, '../../packages/core');
// The reference data ships from the repository's data folder, with no copy.
const dataRoot = path.resolve(__dirname, '../../data');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // The core stays in the root workspace; the app keeps its own install.
  watchFolders: [coreRoot, dataRoot],
  resolver: {
    extraNodeModules: { '@minhajna/core': coreRoot, '@minhajna/data': dataRoot },
    // Babel's helpers for core files come from the app's locked dependencies.
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // Debug builds run the core's shared storage checks on the phone, and can
    // write its demo year (#19). Hermes has no Node modules, so the checks get
    // a strict assert of the app's. Release bundles leave all of the core's
    // test support out: the storage check is never shown there.
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('@minhajna/core/test-support') && !context.dev) return { type: 'empty' };
      if (moduleName === 'node:assert/strict') {
        return { type: 'sourceFile', filePath: path.resolve(__dirname, 'src/debug/strict-assert.ts') };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
