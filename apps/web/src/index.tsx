// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's start (#250): the phone app itself, as its index.js
// starts it, in the kept language's direction, page and layout alike, with
// crash reports kept as on the phone. The offline worker is registered from
// this page's own folder once the app is started, so the next visit opens
// with no network. A key pressed or a wheel turned counts as use of the
// app for the automatic lock, as a click does through the root view.
// Whether the browser keeps the data is read at once, so the lock page
// knows whether to warn as it shows. The network guard comes first, so it is
// set before any other module runs (#559). The app gets the browser's own
// cryptography for demo worlds, which only the PC offers so far (#560), and
// the PC's drawing kit, Apache ECharts and React Flow, which only the PC
// bundles (#600).

import './network-guard.ts';
import './error-utils.ts';
import '@minhajna/core';
import type { ComponentProps } from 'react';
import { AppRegistry, type RootTag } from 'react-native';
import App from '../../android/App';
import { Drawing } from '../../android/src/drawing/drawing-kit';
import { withCrashBoundary } from '../../android/src/help/CrashBoundary';
import { keepCrashes } from '../../android/src/help/crash-report';
import { noteUse } from '../../android/src/lock/activity';
import { readKept } from '../../android/src/lock/browser-offers';
import { applyDirection } from './direction.ts';
import { drawing } from './drawing/index.ts';
import { worldKit } from './native/world-kit.ts';
import { withLocale } from './locale-root.js';

/** The page's element, which React Native Web mounts into where React Native's types name a view tag. */
const rootTag = document.getElementById('root') as unknown as RootTag;

/** The app with the PC's drawing kit. */
function DrawingApp(props: ComponentProps<typeof App>) {
  return (
    <Drawing.Provider value={drawing}>
      <App {...props} />
    </Drawing.Provider>
  );
}

applyDirection();
keepCrashes();
void readKept();
for (const kind of ['keydown', 'wheel'] as const)
  window.addEventListener(kind, noteUse, { capture: true, passive: true });
AppRegistry.registerComponent('Minhajna', () => withLocale(withCrashBoundary(DrawingApp)));
AppRegistry.runApplication('Minhajna', { rootTag, initialProps: { worldKit } });
if ('serviceWorker' in navigator)
  void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined);
