// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where a lesson note opens (#237, answer 419): the row in «تفاصيل الحصة»,
// «مذكرة الدرس» before the note is kept and its number after, none for a
// session with no lesson from the plan; and «المذكرات» in «الوثائق», naming
// the next session awaiting confirmation that has a lesson and its note.
// Made-up schools, classes and notes only.

import { confirmSessions, parseDay, todayView, type RecordEvent } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import { control, mount, press, root, texts, unmount } from '../jest/note-screens';
import { key, withDay } from '../jest/today-day';
import { DocumentsTab } from '../src/documents/DocumentsTab';
import { Entry } from '../src/entry/Entry';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const onNote = jest.fn();
const none = () => undefined;
const day = parseDay('2026-10-15');

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const kept = (itemId: string, number: number): RecordEvent => ({
  kind: 'lesson-note.set',
  note: { id: `n-${itemId}`, courseId: 'c-1', itemId, number, paragraphs: [{ key: 'objectives', text: 'يقرأ' }] },
});

test('gives a session’s details a row to its lesson’s note, and none without a lesson from the plan', async () => {
  const data = await withDay();
  await mount(data, <Entry sessionKey={key(1)} day={day} onDone={none} onNote={onNote} />);
  expect(texts()).toEqual(expect.arrayContaining(['مذكرة الدرس', 'تقويم تشخيصي (مثال)']));
  expect(accessibilityProblems(root())).toEqual([]);
  await press('entry-note-link');
  expect(onNote).toHaveBeenCalledTimes(1);
  await data.book.record(day, kept('d1', 5));
  await mount(data, <Entry sessionKey={key(1)} day={day} onDone={none} onNote={onNote} />);
  expect(texts()).toContain('المذكرة 5');
  await mount(data, <Entry sessionKey={key(1)} day={day} onDone={none} />);
  expect(control('entry-note-link')).toBeUndefined();
  await mount(data, <Entry sessionKey={key(3, 'c-2', 'k-2-w')} day={day} onDone={none} onNote={onNote} />);
  expect(control('entry-note-link')).toBeUndefined();
});

test('names the next session’s note in «المذكرات», new, to complete or complete, and opens it', async () => {
  const data = await withDay();
  const tab = <DocumentsTab onOpen={none} onPrintWeek={none} onFixes={none} onNote={onNote} />;
  const line = () => String(root().findAll((node) => node.props.testID === 'documents-notes')[0]?.props.description);
  await mount(data, tab);
  expect(line()).toBe('مذكرة جديدة لحصة \u20684م1\u2069 الخميس 15/10');
  await press('documents-notes');
  expect(onNote).toHaveBeenCalledWith(key(1), '2026-10-15');
  await data.book.record(day, kept('d1', 2));
  await mount(data, tab);
  expect(line()).toBe('المذكرة 2 لحصة \u20684م1\u2069 الخميس 15/10، تنتظر الإكمال');
  await data.book.record(day, {
    kind: 'lesson-note.set',
    note: {
      id: 'n-d1',
      courseId: 'c-1',
      itemId: 'd1',
      number: 2,
      paragraphs: ['indicator', 'objectives', 'resources'].map((one) => ({ key: one as 'indicator', text: 'نص' })),
    },
  });
  await mount(data, tab);
  expect(line()).toBe('المذكرة 2 لحصة \u20684م1\u2069 الخميس 15/10، مكتملة');
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = todayView(context, day).sessions.filter((one) => one.session.courseId === 'c-1');
  await data.book.recordAll(
    day,
    confirmSessions(
      context,
      sessions.map((one) => ({ session: one.session, choice: { outcome: 'done' } })),
    ),
  );
  await mount(data, tab);
  expect(line()).toBe('مذكرة جديدة لحصة \u20684م1\u2069 الخميس 22/10');
  expect(texts()).toContain('المذكرات');
});

test('shows no «المذكرات» row with no session ahead that has a lesson, nor without a way to open it', async () => {
  const data = await withDay();
  await mount(data, <DocumentsTab onOpen={none} onPrintWeek={none} onFixes={none} />);
  expect(control('documents-notes')).toBeUndefined();
  await data.book.record(day, {
    kind: 'course.set',
    course: { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null },
  });
  await mount(data, <DocumentsTab onOpen={none} onPrintWeek={none} onFixes={none} onNote={onNote} />);
  expect(control('documents-notes')).toBeUndefined();
});
