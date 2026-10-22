// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The notification choices (#234, answer 403): the digest on and the daily
// preview off by default, each choice falling back to its default when the
// saved value cannot be read, and a change kept with the others.

import face from '../src/native/NativeMinhajnaInterface';

type Prefs = typeof import('../src/settings/notify-prefs');

/** The module freshly loaded, after the saved value is set to `saved`. */
function load(saved: string | null): Prefs {
  if (saved !== null) face.setSetting('notify', saved);
  let prefs: Prefs | undefined;
  jest.isolateModules(() => {
    prefs = jest.requireActual<Prefs>('../src/settings/notify-prefs');
  });
  return prefs!;
}

test('the digest is on and the preview off by default', () => {
  expect(load(null).notifyPrefs()).toEqual({ digest: true, preview: false, saturday: false });
});

test('a value that cannot be read falls back to the defaults, choice by choice', () => {
  expect(load('not json').notifyPrefs()).toEqual({ digest: true, preview: false, saturday: false });
  expect(load('[true]').notifyPrefs()).toEqual({ digest: true, preview: false, saturday: false });
  expect(load('{"preview":true,"saturday":"yes"}').notifyPrefs()).toEqual({
    digest: true,
    preview: true,
    saturday: false,
  });
});

test('a change is kept with the other choices', () => {
  const prefs = load('{}');
  prefs.setNotifyPrefs({ saturday: true });
  prefs.setNotifyPrefs({ digest: false });
  expect(load(null).notifyPrefs()).toEqual({ digest: false, preview: false, saturday: true });
});
