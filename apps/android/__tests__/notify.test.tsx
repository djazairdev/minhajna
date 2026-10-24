// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الإشعارات» in Settings (#234, Notif, answers 402 to 404 and 482): the digest
// and the backup reminder on and the preview off at first, the reminder under
// «تذكيرات نادرة», each switch kept the moment it changes, «العمل يوم السبت»
// moving the digest and the weekend's quiet hours to Saturday morning, a choice
// that cannot be kept said so, and the row in Settings that opens it, in
// Arabic, French and English. Made-up data only.

import { settingsData } from '../jest/settings-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { accessibilityProblems } from '../jest/accessibility';
import face from '../src/native/NativeMinhajnaInterface';
import { Notify } from '../src/settings/Notify';
import { notifyPrefs, setNotifyPrefs } from '../src/settings/notify-prefs';
import { Settings } from '../src/settings/Settings';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await closeSettingsScreen();
  setNotifyPrefs({ digest: true, preview: false, saturday: false, backup: true });
  await i18n.changeLanguage('ar');
});

const checked = (id: string) => settingsControl(id).accessibilityState?.checked;

test.each(['ar', 'fr', 'en'] as const)('the digest and the reminder are on at first (%s)', async (language) => {
  missingKeys.length = 0;
  await showSettingsScreen(<Notify />, await settingsData(), language);
  const ids = ['notify-digest', 'notify-preview', 'notify-saturday', 'notify-backup'];
  expect(ids.map(checked)).toEqual([true, false, false, true]);
  expect(settingsTexts()).toEqual(
    expect.arrayContaining([
      i18n.t('settings.notify.digestLine'),
      i18n.t('settings.notify.rare'),
      i18n.t('settings.notify.backupLine'),
      i18n.t('settings.notify.rareLine'),
      i18n.t('settings.notify.quietDaily'),
      i18n.t('settings.notify.quietWeekend'),
      i18n.t('settings.notify.noNames'),
    ]),
  );
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('each switch is kept the moment it changes, and Saturday work moves the digest and the quiet hours', async () => {
  await showSettingsScreen(<Notify />, await settingsData());
  await pressSettings('notify-preview');
  await pressSettings('notify-digest');
  await pressSettings('notify-saturday');
  await pressSettings('notify-backup');
  const saved = { digest: false, preview: true, saturday: true, backup: false };
  expect(notifyPrefs()).toEqual(saved);
  expect(JSON.parse(face.setting('notify') ?? '{}')).toEqual(saved);
  expect(checked('notify-saturday')).toBe(true);
  expect(settingsTexts()).toEqual(
    expect.arrayContaining([
      i18n.t('settings.notify.digestLineSaturday'),
      i18n.t('settings.notify.quietWeekendSaturday'),
    ]),
  );
  expect(settingsTexts()).not.toContain(i18n.t('settings.notify.quietWeekend'));
});

test('a choice that cannot be kept says so and stays as it was', async () => {
  await showSettingsScreen(<Notify />, await settingsData());
  const write = jest.spyOn(face, 'setSetting').mockImplementation(() => {
    throw new Error('Full');
  });
  await pressSettings('notify-preview');
  write.mockRestore();
  expect(checked('notify-preview')).toBe(false);
  expect(settingsRoot().findAll((node) => node.props.testID === 'notify-failed').length).toBeGreaterThan(0);
});

test('Settings opens «الإشعارات»', async () => {
  const onOpen = jest.fn();
  await showSettingsScreen(<Settings onOpen={onOpen} />, await settingsData());
  expect(settingsControl('settings-notifications').accessibilityState?.disabled).not.toBe(true);
  await pressSettings('settings-notifications');
  expect(onOpen).toHaveBeenCalledWith('notifications');
});
