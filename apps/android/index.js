// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

/**
 * @format
 */

// Load the shared rules in the APK now; the record store follows in #19.
// A JavaScript crash that stops the app, an error in a screen's render
// among them, is kept for a report only while crash reports are on in Help
// (#249).
import '@minhajna/core';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { withCrashBoundary } from './src/help/CrashBoundary';
import { keepCrashes } from './src/help/crash-report';

keepCrashes();
AppRegistry.registerComponent(appName, () => withCrashBoundary(App));
