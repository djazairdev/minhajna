// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصدير كل البيانات» (#248, Export-all, answer 472): the archive chosen by
// default, protected, without private notes or the teacher's personal fields;
// saved through the file picker as one ZIP named by the day, and logged as
// the archive; the notes only when included; a password the rule refuses;
// protection off; the three CSV files with a line per mark, absence or
// lateness, and session; a cancelled save neither said nor logged; and every
// text found in each language. Made-up records only.

import { eventOf, parseDay, readArchive, setMark, type RecordEvent } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import files from '../src/native/NativeMinhajnaFiles';
import { ExportAll } from '../src/settings/ExportAll';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const makeZip = jest.spyOn(files, 'makeZip');
const saveFile = jest.spyOn(files, 'saveFile');

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const digest = (text: string) => {
  const { createHash } = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return Promise.resolve(createHash('sha256').update(text, 'utf8').digest('hex'));
};

async function act(testID: string, prop: 'onChangeText' | 'onValueChange', value: string | boolean) {
  await ReactTestRenderer.act(async () => {
    const [node] = root().findAll(
      (one) => one.props.testID === testID && typeof (one.props as Record<string, unknown>)[prop] === 'function',
    );
    (node?.props as Record<string, (input: string | boolean) => void>)[prop]?.(value);
    await settle();
  });
}

async function save() {
  await press('export-save');
  await ReactTestRenderer.act(settle);
}

/** 4م1 with its marks, a roll call, two sessions, a private note and the teacher's personal fields. */
async function filled(): Promise<TestData> {
  const data = await marked();
  await data.book.recordAll(DAY, [
    { kind: 'teacher.personal.set', personal: { name: 'اسم شخصي (مثال)', signatureOn: false } },
    { kind: 'session.noted', note: { sessionKey: 'c-1/2026-10-15/m1/k-1-w', note: 'ملاحظة خاصة (مثال)' } },
    {
      kind: 'roll-call.taken',
      rollCall: {
        unit: 'k-1/2026-10-15/morning/k-1-w',
        classId: 'k-1',
        groupId: 'k-1-w',
        day: DAY,
        half: 'morning',
        absent: [{ pupilId: 'p-2', justified: true }],
        late: ['p-3'],
      },
    },
    ...[1, 2].map((index): RecordEvent => ({
      kind: 'session.recorded',
      record: {
        session: {
          key: `c-1/2026-10-15/m${index}/k-1-w`,
          courseId: 'c-1',
          groupId: 'k-1-w',
          day: DAY,
          slot: { half: 'morning', index },
        },
        outcome: index === 1 ? 'done' : 'not-held',
        sessionType: 'lesson',
        coverage: [],
        ...(index === 1 && {
          unplanned: 'محتوى خارج المخطط (مثال)',
          homework: { text: 'تمرين منزلي (مثال)', due: parseDay('2026-10-18') },
        }),
      },
    })),
  ]);
  return data;
}

const outputs = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event = eventOf(entry);
    return event?.kind === 'output.recorded' ? [[event.output.document, event.output.period, event.output.how]] : [];
  });

const zipped = () => {
  const [names, contents, fileName, password] = makeZip.mock.calls[0] ?? [];
  return { names, contents, fileName, password };
};

test('saves the archive, protected, without the private notes or the personal fields, and logs it', async () => {
  const data = await filled();
  await mount(data, <ExportAll />);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(texts()).toEqual(
    expect.arrayContaining(['كل السنوات حتى الآن: 2026-2027. يأتي اختيار سنة واحدة مع أرشيف السنة.']),
  );
  expect(texts().some((text) => /^الحجم قبل الضغط: نحو \d+ كيلوبايت\.$/.test(text))).toBe(true);
  await act('export-password', 'onChangeText', 'Arshif-2026');
  await save();
  const { names, contents, fileName, password } = zipped();
  expect([names, fileName, password]).toEqual([['minhajna-archive.json'], 'أرشيف منهاجنا 2026-10-15', 'Arshif-2026']);
  const text = contents?.[0] ?? '';
  expect(text).not.toContain('اسم شخصي (مثال)');
  expect(text).not.toContain('ملاحظة خاصة (مثال)');
  expect(text).toContain('تلميذة ثالثة');
  const read = await readArchive(text, digest);
  expect(read.ok && [read.archive.app, read.archive.made, read.archive.privateNotes]).toEqual([
    '0.1.0',
    '2026-10-15',
    false,
  ]);
  expect(read.ok && read.entries.length).toBe(data.book.entries.length - 1);
  expect(saveFile).toHaveBeenCalledWith('00112233aabbccdd');
  expect(outputs(data)).toEqual([['export-all', '2026-10-15', 'archive']]);
  expect(texts()).toContain('حُفظ الملف.');
  expect(missingKeys).toEqual([]);
});

test('includes the private notes when asked, and saves without a password once protection is off', async () => {
  await mount(await filled(), <ExportAll />);
  await act('export-notes', 'onValueChange', true);
  await act('export-protect', 'onValueChange', false);
  expect(root().findAll((node) => node.props.testID === 'export-password')).toHaveLength(0);
  await save();
  const { contents, password } = zipped();
  expect(password).toBe('');
  expect(contents?.[0]).toContain('ملاحظة خاصة (مثال)');
  expect(contents?.[0]).not.toContain('اسم شخصي (مثال)');
});

test('refuses a password the rule does not accept, and makes nothing', async () => {
  await mount(await filled(), <ExportAll />);
  await act('export-password', 'onChangeText', 'كلمة');
  await save();
  expect(makeZip).not.toHaveBeenCalled();
  expect(texts()).toContain(i18n.t('marks.export.file.passwordRule'));
});

test('saves the three CSV files, a line per mark, absence or lateness, and session', async () => {
  const data = await filled();
  await mount(data, <ExportAll />);
  await press('export-format-csv');
  expect(root().findAll((node) => node.props.testID === 'export-notes')).toHaveLength(0);
  await act('export-password', 'onChangeText', 'Arshif-2026');
  await save();
  const { names, contents, fileName } = zipped();
  expect([names, fileName]).toEqual([['marks.csv', 'roll-call.csv', 'lessons.csv'], 'بيانات منهاجنا CSV 2026-10-15']);
  const [marks, roll, lessons] = (contents ?? []).map((text) => text.split('\r\n'));
  expect(marks?.slice(0, 2)).toEqual([
    '\uFEFFداخلي · سري;النقاط;2026-2027',
    'القسم;المادة;الفصل;الرقم;الاسم واللقب;رقم التسجيل;التقويم;اليوم;النقطة',
  ]);
  expect(marks).toContain('4م1;اللغة العربية;الفصل الأول;3;تلميذة ثالثة;;الفرض الأول;2026-11-08;16,00');
  expect(marks).toContain('4م1;اللغة العربية;الفصل الأول;3;تلميذة ثالثة;;الاختبار;;15,00');
  expect(marks?.filter((line) => line.startsWith('4م1;'))).toHaveLength(24);
  expect(roll?.slice(2, 4)).toEqual([
    '4م1;2026-10-15;صباحاً;2;تلميذة ثانية;;غياب;نعم',
    '4م1;2026-10-15;صباحاً;3;تلميذة ثالثة;;تأخر;',
  ]);
  expect(lessons?.[1]).toBe('القسم;المادة;اليوم;ما سُجّل;الواجب;موعد الواجب');
  expect(lessons?.slice(2, 4)).toEqual([
    expect.stringMatching(
      /^4م1;اللغة العربية;2026-10-15;[^;]*محتوى خارج المخطط \(مثال\)[^;]*;تمرين منزلي \(مثال\);2026-10-18$/,
    ),
    expect.stringMatching(/^4م1;اللغة العربية;2026-10-15;[^;]+;;$/),
  ]);
  expect((contents ?? []).join('')).not.toContain('ملاحظة خاصة (مثال)');
  expect(outputs(data)).toEqual([['export-all', '2026-10-15', 'csv']]);
});

test('sorts each file by what its lines are, in any language, and leaves out a removed test', async () => {
  const data = await filled();
  const exam = (term: number, value: number) =>
    setMark({ courseId: 'c-1', term, target: { kind: 'exam' }, pupilId: 'p-1' }, value, 20);
  await data.book.recordAll(DAY, [
    exam(3, 12),
    exam(2, 11),
    {
      kind: 'test.set',
      test: {
        id: 't-2',
        courseId: 'c-1',
        day: parseDay('2026-11-22'),
        slot: { half: 'morning', index: 1 },
        groupId: 'k-1-w',
        title: 'فرض محذوف (مثال)',
      },
    },
    setMark({ courseId: 'c-1', term: 1, target: { kind: 'test', testId: 't-2' }, pupilId: 'p-1' }, 9, 20),
    { kind: 'test.removed', id: 't-2' },
    {
      kind: 'roll-call.taken',
      rollCall: {
        unit: 'k-1/2026-10-15/afternoon/k-1-w',
        classId: 'k-1',
        groupId: 'k-1-w',
        day: DAY,
        half: 'afternoon',
        absent: [{ pupilId: 'p-1', justified: false }],
        late: [],
      },
    },
  ]);
  await i18n.changeLanguage('fr');
  await mount(data, <ExportAll />);
  await press('export-format-csv');
  await act('export-password', 'onChangeText', 'Arshif-2026');
  await save();
  const [marks, roll] = (zipped().contents ?? []).map((text) => text.split('\r\n'));
  const exams = (marks ?? []).filter((line) => line.includes(';1;تلميذة أولى;') && line.includes(';Examen;'));
  expect(exams.map((line) => line.split(';')[2])).toEqual(['Trimestre 1', 'Trimestre 2', 'Trimestre 3']);
  expect((marks ?? []).join('')).not.toContain('فرض محذوف (مثال)');
  expect(roll?.slice(2).map((line) => line.split(';').slice(2, 4))).toEqual([
    ['matin', '2'],
    ['matin', '3'],
    ['après-midi', '1'],
    [],
  ]);
});

test('a cancelled save is neither said nor logged', async () => {
  saveFile.mockResolvedValueOnce(false);
  const data = await filled();
  await mount(data, <ExportAll />);
  await act('export-password', 'onChangeText', 'Arshif-2026');
  await save();
  expect(outputs(data)).toEqual([]);
  expect(root().findAll((node) => node.props.testID === 'export-said')).toHaveLength(0);
});

test('every text is found in French and English', async () => {
  for (const language of ['fr', 'en']) {
    await i18n.changeLanguage(language);
    await mount(await filled(), <ExportAll />);
    expect(texts().length).toBeGreaterThan(5);
    await unmount();
  }
  expect(missingKeys).toEqual([]);
});
