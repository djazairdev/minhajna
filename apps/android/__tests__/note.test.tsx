// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «المذكرة» (#237, Note, answers 416 to 419): a session's lesson note with
// its number, the class, the day and the time, the head from the plan, the
// paragraphs in grey until written or accepted, a tap that accepts or
// reverts one the plan wrote and never one the teacher wrote, the earlier
// year's note offered while this one has no text, and nothing for a session
// with no lesson from the plan. Made-up schools, classes and notes only.

import { parseDay, type NoteParagraph, type RecordEvent } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import { key, withDay } from '../jest/today-day';
import { control, mount, press, root, staged, texts, unmount } from '../jest/note-screens';
import { Note } from '../src/notes/Note';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const onWrite = jest.fn();
const onOwn = jest.fn();

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const show = (data: Awaited<ReturnType<typeof withDay>>, sessionKey = staged, day = '2026-10-22') =>
  mount(data, <Note sessionKey={sessionKey} day={parseDay(day)} onWrite={onWrite} onOwn={onOwn} />);

const tag = (id: string) =>
  String(
    root().findAll((node) => node.props.testID === id && node.props.accessibilityLabel !== undefined)[0]?.props
      .accessibilityLabel,
  );

test('shows the head from the plan and every paragraph in grey, the pencil opening each', async () => {
  const data = await withDay();
  await show(data);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'المذكرة 1',
      'المقطع: ',
      'المقطع 1 (مثال)',
      'فهم المنطوق 1 (مثال)',
      '60 د',
      'مؤشر الكفاءة · من المخطط',
      'تهيئة · من المخطط',
      'تقويم · من المخطط',
      'لا نص في المخطط بعد. القلم يفتحها للكتابة.',
      'إضافة فقرة',
    ]),
  );
  expect(texts().some((one) => one.startsWith('4م1 · الخميس 22/10/2026'))).toBe(true);
  expect(texts()).not.toContain('الميدان: ');
  expect(control('note-objectives')).toBeUndefined();
  await press('note-stage-2-write');
  expect(onWrite).toHaveBeenCalledWith('stage-2');
  await press('note-add');
  expect(onOwn).toHaveBeenCalledWith();
  expect(accessibilityProblems(root())).toEqual([]);
  expect(data.book.state.lessonNotes.size).toBe(0);
});

test('accepts and reverts a paragraph the plan wrote, but a tap never takes back one the teacher wrote', async () => {
  const data = await withDay();
  const note = (paragraphs: NoteParagraph[]): RecordEvent => ({
    kind: 'lesson-note.set',
    note: { id: 'n-1', courseId: 'c-1', itemId: 'u1-2', number: 4, paragraphs },
  });
  await data.book.record(parseDay('2026-10-15'), note([{ key: 'objectives', text: 'يستخرج الفكرة العامة' }]));
  await show(data);
  expect(texts()).toContain('المذكرة 4');
  expect(texts()).toContain('الأهداف · مكتوب');
  expect(control('note-objectives')).toBeUndefined();
  await data.book.record(
    parseDay('2026-10-15'),
    note([
      { key: 'objectives', text: 'يستخرج الفكرة العامة' },
      { key: 'resources', text: '' },
    ]),
  );
  await show(data);
  expect(texts()).toContain('السندات · مقبول');
  expect(tag('note-resources')).toBe('السندات · مقبول. لا نص في المخطط بعد. القلم يفتحها للكتابة.');
  await press('note-resources');
  expect(data.book.state.lessonNotes.get('n-1')?.paragraphs).toEqual([
    { key: 'objectives', text: 'يستخرج الفكرة العامة' },
  ]);
  expect(texts()).toContain('السندات · من المخطط');
});

test('offers last year’s written note for the same lesson until this one has text, and copies it in ink', async () => {
  const data = await withDay();
  const pack = { id: 'dz.cem.4am.arabic.example', release: '2026.1' };
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: { id: 'k-old', schoolId: 's-1', level: 'cem', grade: '4am', name: '4م1', groups: [] },
    },
    { kind: 'course.set', course: { id: 'c-old', classId: 'k-old', subject: 'arabic', year: '2025-2026', pack } },
    {
      kind: 'lesson-note.set',
      note: {
        id: 'n-old',
        courseId: 'c-old',
        itemId: 'u1-2',
        number: 7,
        paragraphs: [
          { key: 'indicator', text: 'يفهم خطاباً منطوقاً' },
          { title: 'الواجب', text: 'التمرين 2' },
        ],
      },
    },
  ]);
  await show(data);
  expect(texts()).toContain('مذكرتك لهذا المورد من السنة الماضية متوفرة');
  await press('note-earlier-open');
  const [kept] = [...data.book.state.lessonNotes.values()].filter((one) => one.courseId === 'c-1');
  expect(kept).toMatchObject({ itemId: 'u1-2', number: 1 });
  expect(kept?.paragraphs).toEqual([
    { key: 'indicator', text: 'يفهم خطاباً منطوقاً' },
    { title: 'الواجب', text: 'التمرين 2' },
  ]);
  expect(texts()).not.toContain('مذكرتك لهذا المورد من السنة الماضية متوفرة');
  expect(texts()).toEqual(expect.arrayContaining(['مؤشر الكفاءة · مكتوب', 'الواجب', 'التمرين 2']));
  await press('note-own-0-write');
  expect(onOwn).toHaveBeenCalledWith(0);
});

test('accepts the textbook’s pages for «السندات» with a tap, two quick taps making one note', async () => {
  const base = await withDay();
  const data = {
    ...base,
    packs: base.packs.map((pack) =>
      pack.id !== 'dz.cem.4am.arabic.example'
        ? pack
        : { ...pack, items: pack.items.map((item) => (item.id === 'u1-2' ? { ...item, pages: '12–13' } : item)) },
    ),
  };
  await show(data);
  expect(texts()).toEqual(expect.arrayContaining(['السندات · من المخطط', 'الكتاب المدرسي ص 12–13']));
  await press('note-resources', 2);
  const notes = [...data.book.state.lessonNotes.values()];
  expect(notes).toHaveLength(1);
  expect(notes[0]).toMatchObject({
    courseId: 'c-1',
    itemId: 'u1-2',
    number: 1,
    paragraphs: [{ key: 'resources', text: 'الكتاب المدرسي ص 12–13' }],
  });
  expect(texts()).toContain('السندات · مقبول');
  await press('note-resources');
  expect(data.book.state.lessonNotes.get(notes[0].id)?.paragraphs).toEqual([]);
  expect(texts()).toContain('السندات · من المخطط');
});

test('says a session with no lesson from the plan has no note', async () => {
  const data = await withDay();
  await show(data, key(3, 'c-2', 'k-2-w'), '2026-10-15');
  expect(texts()).toEqual(['لا مذكرة لهذه الحصة: ليس لها درس من المخطط.']);
});

test('reads in English, left to right, at twice the text size', async () => {
  await i18n.changeLanguage('en');
  const data = await withDay();
  await mount(
    data,
    <Note sessionKey={staged} day={parseDay('2026-10-22')} onWrite={onWrite} onOwn={onOwn} />,
    'ltr',
    2,
  );
  expect(texts()).toEqual(
    expect.arrayContaining(['Lesson note 1', 'Competence indicator · from the plan', 'Add a paragraph']),
  );
  expect(accessibilityProblems(root())).toEqual([]);
});
