// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «حذف بيانات هذا التلميذ» on a pupil's page (#248, Pupil-erase, answer 473):
// no row for a pupil still on the list, a closed row while the director's
// confirmation waits, and once confirmed a sheet that says what goes and what
// stays, offers the export first, shows the activity log's one line, and
// erases only once ticked, then closes the page; two quick taps erasing once;
// a pupil girl's wording; a failed erasure said and the page kept; and every
// text in French and English. The teacher has 4م1, with 45 made-up pupils.

import { activityLog, parseDay, type RecordEvent } from '@minhajna/core';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { control, mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { PupilPage, type PupilPageProps } from '../src/rollbook/PupilPage';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const left = (pupilId: string, confirmed: boolean): RecordEvent => ({
  kind: 'pupil.moved',
  pupilId,
  movement: { day: parseDay('2026-10-11'), kind: 'out', reason: 'transfer', ...(confirmed && { confirmed }) },
});

async function page(data: TestData, pupilId: string) {
  const props: PupilPageProps = {
    courseId: 'c-1',
    pupilId,
    month: '',
    onMonth: jest.fn(),
    onClassYear: jest.fn(),
    onCorrect: jest.fn(),
    onMove: jest.fn(),
    onExport: jest.fn(),
    onErased: jest.fn(),
  };
  await mount(data, <PupilPage {...props} />);
  return props;
}

const shown = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

const disabled = (testID: string) =>
  root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
    .accessibilityState as { disabled?: boolean } | undefined;

test('no row for a pupil on the list, and a closed one while the confirmation waits', async () => {
  const data = await withPupils();
  await page(data, 'p-3');
  expect(shown('pupil-erase')).toBe(false);
  await unmount();
  await data.book.record(parseDay('2026-10-12'), left('p-3', false));
  await page(data, 'p-3');
  expect(texts()).toContain('حذف بيانات هذا التلميذ');
  expect(texts()).toContain('يُتاح بعد المغادرة وتأكيد المدير');
  expect(disabled('pupil-erase')).toEqual(expect.objectContaining({ disabled: true }));
});

test('the sheet says what goes and what stays, and erases once ticked', async () => {
  const data = await withPupils();
  await data.book.record(parseDay('2026-10-12'), left('p-3', true));
  const props = await page(data, 'p-3');
  const name = data.book.state.pupils.get('p-3')?.name ?? '';
  await press('pupil-erase');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      `${name} · 4م1 · غادر في 11/10/2026`,
      'الاسم ورقم التسجيل، وتاريخ المغادرة وسببها',
      'المقعد في مخطط الجلوس',
      'دفتر النصوص والدفتر اليومي، ولا اسم فيهما',
      'حُذفت بيانات تلميذ · 15/10/2026 · دون محتواها',
      'فهمت أن الحذف لا رجوع فيه.',
    ]),
  );
  expect(disabled('pupil-erase-confirm')).toEqual(expect.objectContaining({ disabled: true }));

  await press('pupil-erase-export');
  expect(props.onExport).toHaveBeenCalledTimes(1);
  await press('pupil-erase', 'pupil-erase-understood', 'pupil-erase-confirm');
  await ReactTestRenderer.act(settle);
  expect(data.book.state.pupils.has('p-3')).toBe(false);
  expect(JSON.stringify(data.book.entries)).not.toContain(name);
  expect(props.onErased).toHaveBeenCalledTimes(1);
  expect(activityLog(data.book.entries)[0]?.items.map((item) => item.line)).toEqual([{ kind: 'pupil-erased' }]);
});

test('two quick taps erase once and close the page once', async () => {
  const data = await withPupils();
  await data.book.record(parseDay('2026-10-12'), left('p-3', true));
  const erase = jest.spyOn(data.book, 'erasePupil');
  const props = await page(data, 'p-3');
  await press('pupil-erase', 'pupil-erase-understood');
  await ReactTestRenderer.act(async () => {
    const onPress = (control('pupil-erase-confirm')?.props as PressableProps).onPress;
    onPress?.({} as never);
    onPress?.({} as never);
    await settle();
  });
  await ReactTestRenderer.act(settle);
  expect(erase).toHaveBeenCalledTimes(1);
  expect(data.book.state.pupils.has('p-3')).toBe(false);
  expect(props.onErased).toHaveBeenCalledTimes(1);
});

test('a girl’s wording, and a failed erasure said with the page kept', async () => {
  const data = await withPupils();
  await data.book.record(parseDay('2026-10-12'), left('p-2', true));
  jest.spyOn(data.book, 'erasePupil').mockRejectedValueOnce(new Error('Made-up failure'));
  const props = await page(data, 'p-2');
  await press('pupil-erase', 'pupil-erase-understood', 'pupil-erase-confirm');
  await ReactTestRenderer.act(settle);
  expect(texts()).toEqual(expect.arrayContaining(['حذف بيانات هذه التلميذة', 'لم تُحذف البيانات. أعد المحاولة.']));
  expect(texts().some((text) => text.endsWith('· 4م1 · غادرت في 11/10/2026'))).toBe(true);
  expect(data.book.state.pupils.has('p-2')).toBe(true);
  expect(props.onErased).not.toHaveBeenCalled();
});

test('every text is found in French and English', async () => {
  for (const language of ['fr', 'en']) {
    await i18n.changeLanguage(language);
    const data = await withPupils();
    await data.book.record(parseDay('2026-10-12'), left('p-3', true));
    await page(data, 'p-3');
    await press('pupil-erase');
    expect(texts()).toContain(language === 'fr' ? 'Effacer les données de cet élève' : 'Erase this pupil’s data');
    expect(texts().join(' ')).not.toContain('pupilPage.erase');
    await unmount();
  }
  expect(missingKeys).toEqual([]);
});
