// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A file of its own: the catalogue module must load fresh here, against a
// phone that already keeps English.

import { FakeInterface } from '../jest/fake-interface';

test('starts i18next in the language kept on the phone', () => {
  jest.isolateModules(() => {
    jest.doMock('../src/native/NativeMinhajnaInterface', () => {
      const phone = new FakeInterface();
      phone.kept = 'en';
      return { __esModule: true, default: phone.asSpec() };
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('../src/text/i18n') as typeof import('../src/text/i18n');
    expect(fresh.currentLanguage()).toBe('en');
    expect(fresh.i18n.t('navigation.today')).toBe('Today');
  });
});
