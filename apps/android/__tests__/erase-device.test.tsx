// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مسح هذا الجهاز» (#248, Erase, answer 477): what goes from this phone, with
// the classes and pupils counted, nothing kept elsewhere until devices and
// backups come, and every change on this phone counted as lost; the export
// offered first; «مسح كل شيء» closed until ticked, then erasing once however
// often it is tapped and starting the app again; a failure said with the
// screen kept and nothing started again; and every text in French and
// English. The teacher has 4م1, with 45 made-up pupils, and 4م2.

import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { control, mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import ui from '../src/native/NativeMinhajnaInterface';
import { EraseDevice } from '../src/settings/EraseDevice';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const restart = jest.spyOn(ui, 'restart');

beforeEach(() => {
  missingKeys.length = 0;
  restart.mockClear();
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

async function screen(data: TestData) {
  const onExport = jest.fn();
  await mount(data, <EraseDevice storage={data.storage.asSpec()} onExport={onExport} />);
  return onExport;
}

const disabled = (testID: string) =>
  root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
    .accessibilityState as { disabled?: boolean } | undefined;

test('says what goes and what stays, offers the export, and erases once ticked', async () => {
  const data = await withPupils();
  const changes = data.book.entries.length;
  const onExport = await screen(data);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'خطوة واحدة، ولا رجوع فيها',
      'قسمان، و45 تلميذاً',
      'مفتاح هذا الهاتف: فلا يصله شيء بعد المسح',
      'لا شيء بعد: لا جهاز آخر ولا نسخة احتياطية، فكل شيء على هذا الهاتف وحده.',
      'فهمت أن المسح لا رجوع فيه، وأن المشروع لا يستطيع استرجاع شيء.',
    ]),
  );
  expect(texts().some((text) => text.startsWith(`${changes} تغيير`) && text.endsWith('بالمسح.'))).toBe(true);
  expect(disabled('erase-confirm')).toEqual(expect.objectContaining({ disabled: true }));
  await press('erase-export');
  expect(onExport).toHaveBeenCalledTimes(1);
  await press('erase-confirm');
  expect(data.storage.stopped).toBe(false);
  await press('erase-understood', 'erase-confirm');
  await ReactTestRenderer.act(settle);
  expect(data.storage.stopped).toBe(true);
  expect(data.storage.rows).toEqual([]);
  expect(data.storage.pin).toBeNull();
  expect(restart).toHaveBeenCalledTimes(1);
});

test('two quick taps erase once and start the app again once', async () => {
  const data = await withPupils();
  const erase = jest.spyOn(data.storage, 'eraseDevice');
  await screen(data);
  await press('erase-understood');
  await ReactTestRenderer.act(async () => {
    const onPress = (control('erase-confirm')?.props as PressableProps).onPress;
    onPress?.({} as never);
    onPress?.({} as never);
    await settle();
  });
  await ReactTestRenderer.act(settle);
  expect(erase).toHaveBeenCalledTimes(1);
  expect(restart).toHaveBeenCalledTimes(1);
});

test('a failure is said, the screen stays and nothing starts again', async () => {
  const data = await withPupils();
  data.storage.eraseFails = true;
  await screen(data);
  await press('erase-understood', 'erase-confirm');
  await ReactTestRenderer.act(settle);
  expect(texts()).toContain('لم يكتمل المسح. أعد المحاولة.');
  expect(restart).not.toHaveBeenCalled();
  expect(data.storage.rows.length).toBeGreaterThan(0);
  expect(disabled('erase-confirm')).toEqual(expect.objectContaining({ disabled: false }));
});

test('every text is found in French and English', async () => {
  for (const [language, title] of [
    ['fr', 'Ce qui est effacé de ce téléphone'],
    ['en', 'What is erased from this phone'],
  ] as const) {
    await i18n.changeLanguage(language);
    await screen(await withPupils());
    expect(texts()).toContain(title);
    expect(texts().join(' ')).not.toContain('settings.eraseDevice');
    await unmount();
  }
  expect(missingKeys).toEqual([]);
});
