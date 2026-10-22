// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writing a lesson note (#237, Note-edit, Note-add, answers 416 and 419): a
// plan paragraph written in ink or left empty to go back to grey, the plan's
// text put back with «إعادة نص المخطط», and the teacher's own paragraphs
// added, changed and deleted, each needing a title and a text. Made-up
// schools, classes and notes only.

import { parseDay } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import { control, mount, press, root, staged, texts, type, unmount } from '../jest/note-screens';
import { withDay } from '../jest/today-day';
import { NoteEdit } from '../src/notes/NoteEdit';
import { NoteOwn } from '../src/notes/NoteOwn';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const onDone = jest.fn();
const day = parseDay('2026-10-22');

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const notes = (data: Awaited<ReturnType<typeof withDay>>) => [...data.book.state.lessonNotes.values()];
const disabled = (testID: string) =>
  (
    root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props as
      { accessibilityState?: { disabled?: boolean } } | undefined
  )?.accessibilityState?.disabled;

test('writes a plan paragraph in ink, and an empty box sends it back to grey', async () => {
  const data = await withDay();
  await mount(data, <NoteEdit sessionKey={staged} day={day} noteKey="stage-2" onDone={onDone} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'المذكرة 1 · تعديل فقرة',
      'بناء',
      'النص من المخطط، ويُعدَّل هنا كما يُراد. ولا يتغيّر المخطط.',
    ]),
  );
  expect(control('note-edit-reset')).toBeUndefined();
  expect(accessibilityProblems(root())).toEqual([]);
  await type('note-edit-text', '  قراءة نموذجية ثم قراءات فردية\n');
  await press('note-edit-save');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(notes(data)).toEqual([
    expect.objectContaining({ number: 1, paragraphs: [{ key: 'stage-2', text: 'قراءة نموذجية ثم قراءات فردية' }] }),
  ]);
  await mount(data, <NoteEdit sessionKey={staged} day={day} noteKey="stage-2" onDone={onDone} />);
  expect(root().findByProps({ testID: 'note-edit-text', multiline: true }).props.value).toBe(
    'قراءة نموذجية ثم قراءات فردية',
  );
  await type('note-edit-text', '   ');
  await press('note-edit-save');
  expect(notes(data)[0]?.paragraphs).toEqual([]);
});

test('shows the plan’s text in pencil and puts it back, and cancelling keeps nothing', async () => {
  const base = await withDay();
  const data = {
    ...base,
    packs: base.packs.map((pack) =>
      pack.id !== 'dz.cem.4am.arabic.example'
        ? pack
        : { ...pack, items: pack.items.map((item) => (item.id === 'u1-2' ? { ...item, pages: '12–13' } : item)) },
    ),
  };
  await mount(data, <NoteEdit sessionKey={staged} day={day} noteKey="resources" onDone={onDone} />);
  expect(texts()).toEqual(expect.arrayContaining(['من المخطط', 'الكتاب المدرسي ص 12–13']));
  expect(disabled('note-edit-reset')).toBe(true);
  await type('note-edit-text', 'السبورة');
  expect(disabled('note-edit-reset')).toBe(false);
  await press('note-edit-reset');
  expect(root().findByProps({ testID: 'note-edit-text', multiline: true }).props.value).toBe('الكتاب المدرسي ص 12–13');
  await press('note-edit-cancel');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(notes(data)).toEqual([]);
});

test('adds the teacher’s own paragraphs at the end, then changes and deletes one', async () => {
  const data = await withDay();
  await mount(data, <NoteOwn sessionKey={staged} day={day} onDone={onDone} />);
  expect(texts()).toEqual(
    expect.arrayContaining(['المذكرة 1 · فقرة جديدة', 'تُضاف الفقرة بالحبر في آخر المذكرة، وتُطبع معها.']),
  );
  expect(control('note-own-remove')).toBeUndefined();
  expect(accessibilityProblems(root())).toEqual([]);
  expect(disabled('note-own-save')).toBe(true);
  await type('note-own-title', 'الواجب\nالمنزلي');
  expect(disabled('note-own-save')).toBe(true);
  await type('note-own-text', 'التمرين 3 ص 18');
  await press('note-own-save', 2);
  expect(notes(data)).toHaveLength(1);
  expect(notes(data)[0]?.paragraphs).toEqual([
    { title: 'الواجب المنزلي', text: 'التمرين 3 ص 18' },
    { title: 'الواجب المنزلي', text: 'التمرين 3 ص 18' },
  ]);
  await mount(data, <NoteOwn sessionKey={staged} day={day} index={1} onDone={onDone} />);
  expect(texts()).toContain('المذكرة 1 · فقرتك');
  await type('note-own-text', 'التمرين 4 ص 18');
  await press('note-own-save');
  expect(notes(data)[0]?.paragraphs[1]).toEqual({ title: 'الواجب المنزلي', text: 'التمرين 4 ص 18' });
  await mount(data, <NoteOwn sessionKey={staged} day={day} index={0} onDone={onDone} />);
  await press('note-own-remove');
  expect(texts()).toContain('تُحذف الفقرة من المذكرة ولا تُطبع معها.');
  await press('note-own-keep');
  expect(control('note-own-confirm')).toBeUndefined();
  expect(notes(data)[0]?.paragraphs).toHaveLength(2);
  await press('note-own-remove');
  await press('note-own-confirm');
  expect(notes(data)[0]?.paragraphs).toEqual([{ title: 'الواجب المنزلي', text: 'التمرين 4 ص 18' }]);
  await mount(data, <NoteOwn sessionKey={staged} day={day} index={3} onDone={onDone} />);
  expect(texts()).toEqual(['لا مذكرة لهذه الحصة: ليس لها درس من المخطط.']);
});

test('words the paragraph screens in French', async () => {
  await i18n.changeLanguage('fr');
  const data = await withDay();
  await mount(data, <NoteOwn sessionKey={staged} day={day} onDone={onDone} />, 'ltr');
  expect(texts()).toEqual(expect.arrayContaining(['Fiche 1 · nouveau paragraphe', 'Enregistrer le paragraphe']));
  expect(accessibilityProblems(root())).toEqual([]);
});
