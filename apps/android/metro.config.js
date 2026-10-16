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
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
