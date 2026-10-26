// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's start (#250): the phone app itself, as its index.js
// starts it, in the kept language's direction, page and layout alike, with
// crash reports kept as on the phone. The offline worker is registered from
// this page's own folder once the app is started, so the next visit opens
// with no network. A key pressed or a wheel turned counts as use of the
// app for the automatic lock, as a click does through the root view.

import './error-utils.ts';
import '@minhajna/core';
import { AppRegistry, type RootTag } from 'react-native';
import App from '../../android/App';
import { withCrashBoundary } from '../../android/src/help/CrashBoundary';
import { keepCrashes } from '../../android/src/help/crash-report';
import { noteUse } from '../../android/src/lock/activity';
import { applyDirection } from './direction.ts';
import { withLocale } from './locale-root.js';

/** The page's element, which React Native Web mounts into where React Native's types name a view tag. */
const rootTag = document.getElementById('root') as unknown as RootTag;

applyDirection();
keepCrashes();
for (const kind of ['keydown', 'wheel'] as const)
  window.addEventListener(kind, noteUse, { capture: true, passive: true });
AppRegistry.registerComponent('Minhajna', () => withLocale(withCrashBoundary(App)));
AppRegistry.runApplication('Minhajna', { rootTag, initialProps: {} });
if ('serviceWorker' in navigator)
  void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined);
