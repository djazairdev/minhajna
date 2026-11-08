// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard app's start (answer 855), as the PC web app starts the
// teacher's: the network guard first, so it is set before any other module
// runs, and only the directory reaches the demo server; the ErrorUtils global
// React Native's code expects; then the page's language, direction and title
// from the kept language, again whenever the language changes, and the
// dashboard in it. Crash reports are kept as in the PC web app, for reader
// mode's crash sheet, and a key pressed or a wheel turned counts as use for
// its automatic lock, as a click does (answer 856). There is no offline
// worker: the dashboard works with the server alone.

import '../../web/src/network-guard.ts';
import '../../web/src/error-utils.ts';
import { AppRegistry, type RootTag } from 'react-native';
import { withCrashBoundary } from '../../android/src/help/CrashBoundary';
import { keepCrashes } from '../../android/src/help/crash-report';
import { noteUse } from '../../android/src/lock/activity';
import { i18n } from '../../android/src/text/i18n';
import { applyDirection } from '../../web/src/direction.ts';
import { withLocale } from '../../web/src/locale-root.js';
import { DashboardApp } from './DashboardApp';
import { dashboardWord } from './text';

/** The page's element, which React Native Web mounts into where React Native's types name a view tag. */
const rootTag = document.getElementById('root') as unknown as RootTag;

/** Sets the page's language, direction and title from the kept language. */
function namePage(): void {
  applyDirection();
  document.title = dashboardWord('dashboard.title');
}

namePage();
i18n.on('languageChanged', namePage);
keepCrashes();
for (const kind of ['keydown', 'wheel'] as const)
  window.addEventListener(kind, noteUse, { capture: true, passive: true });
AppRegistry.registerComponent('MinhajnaDashboard', () => withLocale(withCrashBoundary(DashboardApp)));
AppRegistry.runApplication('MinhajnaDashboard', { rootTag, initialProps: {} });
