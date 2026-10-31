// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

/**
 * @format
 */

// Load the shared rules in the APK now; the record store follows in #19.
// A JavaScript crash that stops the app, an error in a screen's render
// among them, is kept for a report only while crash reports are on in Help
// (#249). The network guard comes first, so it is set before any other
// module runs: only a demo world's client reaches the demo server, and debug
// builds keep Metro (#559). The app gets the phone's own cryptography for
// demo worlds, which Help leads to, only in a build that may connect (#561).
import './src/network/phone-guard';
import '@minhajna/core';
import { createElement } from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { phoneWorldKit } from './src/demo/phone-world-kit';
import { withCrashBoundary } from './src/help/CrashBoundary';
import { keepCrashes } from './src/help/crash-report';
import NativeSignature from './src/native/NativeMinhajnaSignature';
import NativeStorage from './src/native/NativeMinhajnaStorage';
import NativeWorldKit from './src/native/NativeMinhajnaWorldKit';

const worldKit = phoneWorldKit(NativeWorldKit, NativeStorage, NativeSignature);

/** The app with the phone's world kit. */
function PhoneApp(props) {
  return createElement(App, { ...props, worldKit });
}

keepCrashes();
AppRegistry.registerComponent(appName, () => withCrashBoundary(PhoneApp));
