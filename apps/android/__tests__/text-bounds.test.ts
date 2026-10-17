// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="node" />

// React Native sizes a text by its advances, while Android 15 breaks lines by
// glyph bounds for apps that target it. The app theme turns that off, or a
// label whose ink runs past its last letter wraps out of sight in a box sized
// for one line (#185).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const styles = readFileSync(join(__dirname, '../android/app/src/main/res/values/styles.xml'), 'utf8');

test('the app theme breaks text by advances, as React Native measures it', () => {
  const theme = /<style name="AppTheme"[^>]*>([\s\S]*?)<\/style>/.exec(styles)?.[1] ?? '';
  expect(theme).toMatch(/<item name="android:useBoundsForWidth"[^>]*>false<\/item>/);
});
