// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's printed timetable grids (#581, answer 609): every class gets an
// A4 landscape page with the official header, the school and year, its grid
// with spans and escaped, isolated names, the A/B note only on a page that
// alternates, the boxes for the director and the censeur in a lycée, the day
// printed and a demo mark at head and foot; a teacher's and a room's grids name
// the class, the education counsellor's box in a CEM and the inspector's in a
// primary school; the directorate's line is left out when the wilaya is
// unknown; a page whose cells hold two sessions sets them smaller; the school
// year runs from August; and the card prints the chosen set, saves it as a PDF
// named for the set, school and day and says so, says when the timetable names
// no room and waits, and says a failure. Every school, class and teacher is
// made up.

import { parseDay, type DemoSchool, type ImportedSession } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import pdf from '../src/native/NativeMinhajnaPdf';
import en from '../src/text/en.json';
import { i18n } from '../src/text/i18n';
import { cellText, gridsHtml, yearOf, type GridsPrint } from '../src/timetable/grids-print';
import { TimetablePrint } from '../src/timetable/TimetablePrint';
import { isolate } from '../src/week/grid-labels';

const words = en.ttPrint;
const printHtml = jest.spyOn(pdf, 'printHtml');
const savePdf = jest.spyOn(pdf, 'savePdf');
const t = i18n.getFixedT('en');
let row = 1;
const session = (fields: Partial<ImportedSession>): ImportedSession => ({
  row: (row += 1),
  class: '4AM1',
  group: '',
  subject: 'Maths',
  teacher: 'Teacher A',
  room: '',
  day: 0,
  start: 480,
  end: 540,
  week: 'both',
  ...fields,
});
const SESSIONS = [
  session({ room: 'Lab <2>' }),
  session({ class: '4AM2', teacher: 'Teacher B', subject: 'Physics', day: 1, week: 'A', group: 'G1' }),
  session({ class: '4AM2', teacher: 'Teacher A', day: 2, start: 540, end: 600 }),
];
const print = (change: Partial<GridsPrint> = {}): GridsPrint => ({
  of: 'class',
  sessions: SESSIONS,
  workingDays: [0, 1, 2, 3, 4],
  school: 'CEM Made-up',
  wilaya: 'Made-up wilaya',
  year: '2026/2027',
  level: 'lycee',
  day: 'Saturday 31 October 2026',
  ...change,
});
const pages = (html: string) => html.split('<section class="page"').slice(1);

test('every class gets a page with the official header, its grid, the A/B note and the boxes', () => {
  const html = gridsHtml(t, print({ mark: words.demo }), 'en', 'ltr');
  const [first, second] = pages(html);
  expect(pages(html)).toHaveLength(2);
  for (const said of [
    words.republic,
    words.ministry,
    'Directorate of Education of the Wilaya of',
    'School year 2026/2027',
  ])
    expect(first).toContain(said);
  expect(first).toContain(words.titles.class.replace('{{name}}', isolate('4AM1')));
  expect(first).toContain('<bdi>08:00–09:00</bdi>');
  expect(first).toContain('Lab &lt;2&gt;');
  expect(first).not.toContain('Lab <2>');
  expect(first).not.toContain(words.weeks);
  expect(second).toContain(words.weeks);
  expect(second).toContain(`${isolate('Physics')} · ${isolate('Teacher B')} · ${isolate('G1')} · Week A`);
  expect(first).toContain(words.boxes.director);
  expect(first).toContain(words.boxes.censeur);
  expect(first).not.toContain(words.boxes.inspector);
  expect(first).not.toContain(words.boxes.counsellor);
  expect(first).toContain('Printed on Saturday 31 October 2026');
  expect(first.split(words.demo)).toHaveLength(3);
  expect(html).toContain('size:A4 landscape');
});

test('a teacher’s and a room’s grid name the class, and the boxes beside the director follow the level', () => {
  const teachers = pages(gridsHtml(t, print({ of: 'teacher', level: 'primary' }), 'en', 'ltr'));
  expect(teachers).toHaveLength(2);
  expect(teachers[0]).toContain(isolate('4AM2'));
  expect(teachers[0]).toContain(words.boxes.inspector);
  expect(teachers[0]).not.toContain(words.boxes.censeur);
  expect(teachers[0]).not.toContain(words.demo);
  const cem = pages(gridsHtml(t, print({ level: 'cem', wilaya: '' }), 'en', 'ltr'))[0];
  expect([words.boxes.counsellor, words.boxes.censeur, words.boxes.inspector].map((box) => cem.includes(box))).toEqual([
    true,
    false,
    false,
  ]);
  expect(cem).toContain(words.ministry);
  expect(cem).not.toContain('Directorate of Education');
  const pair = [session({ week: 'A' }), session({ class: '4AM2', week: 'B' })];
  expect(gridsHtml(t, print({ of: 'teacher', sessions: pair }), 'en', 'ltr')).toContain('<table class="week dense2">');
  expect(teachers[0]).toContain('<table class="week">');
  const rooms = pages(gridsHtml(t, print({ of: 'room' }), 'en', 'ltr'));
  expect(rooms).toHaveLength(1);
  expect(rooms[0]).toContain(words.titles.room.replace('{{name}}', isolate('Lab &lt;2&gt;')));
  expect(cellText(t, 'room', SESSIONS[0])).toBe([isolate('4AM1'), isolate('Maths'), isolate('Teacher A')].join(' · '));
  expect(cellText(t, 'teacher', SESSIONS[0])).toBe([isolate('4AM1'), isolate('Maths'), isolate('Lab <2>')].join(' · '));
});

test('the school year runs from August', () => {
  expect([yearOf('2026-10-31'), yearOf('2027-03-01'), yearOf('2027-08-20')]).toEqual([
    '2026/2027',
    '2026/2027',
    '2027/2028',
  ]);
});

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  printHtml.mockClear();
  savePdf.mockClear();
});

const school = { name: 'متوسطة المختلقة', latinName: 'CEM Made-up', level: 'cem' } as unknown as DemoSchool;
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const button = (testID: string) =>
  tree!.root.find((node) => node.props.testID === testID && typeof node.props.onPress === 'function');
async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (button(testID).props as PressableProps).onPress?.({} as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
async function render(sessions: readonly ImportedSession[]) {
  await i18n.changeLanguage('en');
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="ltr">
        <TimetablePrint
          school={school}
          wilaya="Made-up wilaya"
          sessions={sessions}
          workingDays={[0, 1, 2, 3, 4]}
          date={parseDay('2026-10-31')}
          dayText={(day) => `day ${day}`}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

test('the card prints the chosen set, saves it as a PDF named for it, and says so', async () => {
  await render(SESSIONS);
  expect(texts()).toEqual(expect.arrayContaining([words.title, words.lines.cem, 'Classes · 2', 'Rooms · 1']));
  await press('tt-print-go');
  const [html, title, landscape] = printHtml.mock.calls[0];
  expect([pages(html).length, title, landscape]).toEqual([2, words.files.class, true]);
  expect(html).toContain(words.demo);
  await press('tt-print-of-teacher');
  await press('tt-print-pdf');
  const name = `${words.files.teacher} CEM Made-up 2026-10-31.pdf`;
  expect(savePdf.mock.calls[0][1]).toBe(name);
  expect(texts()).toContain(words.said.saved.replace('{{name}}', name));
});

test('a timetable with no room says so and waits, and a failure is said', async () => {
  await render([session({})]);
  await press('tt-print-of-room');
  expect(texts()).toContain(words.noRooms);
  expect((button('tt-print-go').props as PressableProps).disabled).toBe(true);
  await press('tt-print-of-class');
  printHtml.mockRejectedValueOnce(new Error('No printer'));
  await press('tt-print-go');
  expect(texts()).toContain(words.said.failed);
});
