// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مسح هذا الجهاز» (#248, Erase, answer 477): what goes from this phone, with
// the classes and pupils counted; before any backup, nothing kept elsewhere
// and every change counted as lost; after one (#482), the backup's day, what
// it leaves out, and only the changes since it counted, in every language;
// the export offered first; «مسح كل شيء» closed until ticked, then erasing
// once however often it is tapped and starting the app again; a failure said
// with the screen kept and nothing started again; and every text in French
// and English. The teacher has 4م1, with 45 made-up pupils, and 4م2.

import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { parseDay } from '@minhajna/core';
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

/** The made-up class with a backup on Tuesday 20 October, and `changes` made-up pupils added after it. */
async function backedUp(changes: number) {
  const data = await withPupils();
  await data.book.record(parseDay('2026-10-20'), { kind: 'backup.saved' });
  for (let index = 0; index < changes; index += 1) {
    const pupil = {
      id: `p-${50 + index}`,
      classId: 'k-1',
      name: 'Amel B.',
      sex: 'f' as const,
      groups: [],
      movements: [],
    };
    await data.book.record(parseDay('2026-10-21'), { kind: 'pupil.set', pupil });
  }
  return data;
}

test('names the last backup, what it leaves out, and counts only the changes since it', async () => {
  await screen(await backedUp(2));
  expect(accessibilityProblems(root())).toEqual([]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      '\u0622\u062e\u0631 \u0646\u0633\u062e\u0629\u060c \u064a\u0648\u0645 \u0627\u0644\u062b\u0644\u0627\u062b\u0627\u0621 20 \u0623\u0643\u062a\u0648\u0628\u0631\u060c \u0648\u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u062a\u064a \u062d\u0641\u0638\u062a\u0647\u0627 \u0641\u064a \u0645\u0643\u0627\u0646 \u0622\u062e\u0631: \u0644\u0627 \u064a\u0645\u0633\u0651\u0647\u0627 \u0627\u0644\u0645\u0633\u062d.',
      '\u0648\u0644\u0627 \u062a\u062d\u0645\u0644 \u0623\u064a \u0646\u0633\u062e\u0629 \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0634\u062e\u0635\u064a\u0629 \u0641\u064a \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0623\u0633\u062a\u0627\u0630 \u0648\u0644\u0627 \u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0645\u0631\u0633\u0648\u0645: \u064a\u0636\u064a\u0639\u0627\u0646 \u0628\u0627\u0644\u0645\u0633\u062d.',
      '\u062a\u063a\u064a\u064a\u0631\u0627\u0646 \u0645\u0646\u0630 \u0622\u062e\u0631 \u0646\u0633\u062e\u0629\u060c \u064a\u0648\u0645 \u0627\u0644\u062b\u0644\u0627\u062b\u0627\u0621 20 \u0623\u0643\u062a\u0648\u0628\u0631\u060c \u0644\u0645 \u064a\u0635\u0644\u0627 \u0625\u0644\u0649 \u062c\u0647\u0627\u0632 \u0622\u062e\u0631 \u0648\u0644\u0627 \u0625\u0644\u0649 \u0646\u0633\u062e\u0629\u060c \u0641\u064a\u0636\u064a\u0639\u0627\u0646 \u0628\u0627\u0644\u0645\u0633\u062d.',
    ]),
  );
  expect(texts()).not.toContain(
    '\u0644\u0627 \u0634\u064a\u0621 \u0628\u0639\u062f: \u0644\u0627 \u062c\u0647\u0627\u0632 \u0622\u062e\u0631 \u0648\u0644\u0627 \u0646\u0633\u062e\u0629 \u0627\u062d\u062a\u064a\u0627\u0637\u064a\u0629\u060c \u0641\u0643\u0644 \u0634\u064a\u0621 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0647\u0627\u062a\u0641 \u0648\u062d\u062f\u0647.',
  );
  await unmount();
  await screen(await backedUp(0));
  expect(texts()).toContain(
    '\u0644\u0627 \u062a\u063a\u064a\u064a\u0631 \u0645\u0646\u0630 \u0622\u062e\u0631 \u0646\u0633\u062e\u0629\u060c \u064a\u0648\u0645 \u0627\u0644\u062b\u0644\u0627\u062b\u0627\u0621 20 \u0623\u0643\u062a\u0648\u0628\u0631: \u0643\u0644 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0641\u064a\u0647\u0627.',
  );
});

test.each([
  [
    'fr',
    'La dernière sauvegarde, faite le Mardi 20 octobre, et les fichiers enregistrés ailleurs : l’effacement n’y touche pas.',
    '2 changements depuis la dernière sauvegarde, le Mardi 20 octobre, n’ont atteint ni un autre appareil ni une sauvegarde : ils sont perdus avec l’effacement.',
    'Aucun changement depuis la dernière sauvegarde, le Mardi 20 octobre : tous les changements y sont.',
    'Rien pour l’instant : aucun autre appareil ni sauvegarde, tout est sur ce téléphone seulement.',
    'changements n’ont atteint ni un autre appareil ni une sauvegarde : ils sont perdus avec l’effacement.',
    'Aucune sauvegarde ne contient les champs personnels de la fiche de l’enseignant ni la signature dessinée : ils partent avec l’effacement.',
  ],
  [
    'en',
    'The last backup, made on Tuesday 20 October, and the files saved elsewhere: the erasure does not touch them.',
    '2 changes since the last backup, on Tuesday 20 October, have reached neither another device nor a backup, and are lost with the erasure.',
    'No change since the last backup, on Tuesday 20 October: every change is in it.',
    'Nothing yet: no other device and no backup, so everything is on this phone alone.',
    'changes have reached neither another device nor a backup, and are lost with the erasure.',
    'No backup holds the teacher card’s personal fields or the drawn signature: they go with the erasure.',
  ],
] as const)('says no backup, the backup and the changes since it in %s', async (language, ...lines) => {
  const [keptLine, twoLost, noneLost, keptNone, allLost, leftOut] = lines;
  await i18n.changeLanguage(language);
  const data = await withPupils();
  await screen(data);
  expect(texts()).toEqual(expect.arrayContaining([keptNone, `${data.book.entries.length} ${allLost}`]));
  await unmount();
  await screen(await backedUp(2));
  expect(texts()).toEqual(expect.arrayContaining([keptLine, leftOut, twoLost]));
  await unmount();
  await screen(await backedUp(0));
  expect(texts()).toContain(noneLost);
  expect(missingKeys).toEqual([]);
});
