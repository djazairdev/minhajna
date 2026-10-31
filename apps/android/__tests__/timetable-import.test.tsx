// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bringing in the timetable from a file (#576, answer 592), against a made-up
// demo server: the preparer's workspace opens on it, and the director's has it
// too; a FET export reads, its numbered hours taking the school level's bell
// times, counted, a group meeting its own class said on its row, the grid's
// check said to wait, and its guessed groups listed to confirm with how to
// correct them; the school's template reads with Arabic columns and French days
// at once, and its clashes and missing cells are said on their rows in plain
// words, with the sessions shared by several classes; a missing column refuses
// the file, said apart, with a hint to try the other source when no time column
// it expects is there; a file with only
// its header reads no session; a file that cannot be read says so, while a
// cancelled one changes nothing. A header cell no reader knows is listed apart
// and leaves the file clean; what was read is said aloud, again for the same
// file read twice on a PC and through TalkBack on the phone; it outlives a
// change of page and goes with another source, which is fixed while a file is
// being chosen; and the app's words in every language read without a word
// naming two things. Every school, class and person is made up.

import { readFetTimetable, readTimetable, type SchoolCalendar } from '@minhajna/core';
import { AccessibilityInfo, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput } from '../jest/calendar-input';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import text from '../src/text/ar.json';
import { TimetableImport } from '../src/timetable/TimetableImport';
import { fetWords, levelBells, timetableWords } from '../src/timetable/timetable-words';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const tt = text.ttImport;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  jest.restoreAllMocks();
  calendarInput.readTable.mockReset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

/** A national world started on this PC, entered in a role. */
async function enter(role: 'preparer' | 'director') {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={reference.profile}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={() => undefined}
        reference={reference}
      />,
    );
    await settle();
  });
  await press('demo-start-national');
  await press(`world-role-${role}`);
}

/** Opens a file with the given text in the chosen source. */
async function openFile(source: 'fet' | 'template', file: string) {
  await press(`tt-source-${source}`);
  calendarInput.readTable.mockResolvedValueOnce(file);
  await press('tt-open');
}

const FET =
  '"Activity Id","Day","Hour","Students Sets","Subject","Teachers","Activity Tags","Room","Comments"\n' +
  '"1","Sunday","1","4AM2","arabic","Made-up Teacher A","","R1",""\n' +
  '"1","Sunday","2","4AM2","arabic","Made-up Teacher A","","R1",""\n' +
  '"2","Sunday","1","4AM2 G1","physics","Made-up Teacher B","","Lab",""\n' +
  '"3","Monday","08:00-09:00","4AM3","math","Made-up Teacher C","","R2",""\n';

test('the preparer brings in a FET export: counted, its clash said, and its guessed groups to confirm', async () => {
  await enter('preparer');
  expect(shown('timetable-import')).toBe(true);
  expect(texts()).toContain(tt.lead);
  await openFile('fet', FET);
  expect(texts()).toEqual(
    expect.arrayContaining([
      tt.read
        .replace('{{sessions}}', text.count.sessions_two)
        .replace('{{classes}}', '2')
        .replace('{{teachers}}', '2')
        .replace('{{rooms}}', '2'),
      tt.checks,
      tt.problems,
      tt.gridLater,
      tt.groups,
      tt.groupRow.replace('{{set}}', '4AM2 G1').replace('{{group}}', 'G1').replace('{{class}}', '4AM2'),
      tt.groupsLine,
    ]),
  );
  expect(texts()).toContain(
    tt.row.replace('{{row}}', '4').replace('{{what}}', tt.problem.class.replace('{{with}}', '2')),
  );
});

test('the template reads with Arabic columns and French days, and says each problem on its row', async () => {
  await enter('director');
  await press('world-page-timetable');
  await openFile(
    'template',
    'القسم,المادة,الأستاذ,اليوم,من,إلى,القاعة\n' +
      '4AM2,arabic,Made-up Teacher A,dimanche,8:00,9:00,R1\n' +
      '4AM3,math,Made-up Teacher A,dimanche,8:30,9:30,R2\n' +
      '4AM1,french,Made-up Teacher D,lundi,8:00,9:00,R3\n' +
      '4AM4,french,Made-up Teacher D,lundi,8:00,9:00,R3\n' +
      '4AM1,,Made-up Teacher E,mardi,8:00,9:00,R4\n',
  );
  expect(texts()).toEqual(
    expect.arrayContaining([
      tt.row.replace('{{row}}', '3').replace('{{what}}', tt.problem.teacher.replace('{{with}}', '2')),
      tt.row.replace('{{row}}', '6').replace('{{what}}', tt.problem.empty.replace('{{column}}', tt.column.subject)),
      tt.together,
      tt.togetherRow.replace('{{row}}', '5').replace('{{with}}', '4'),
    ]),
  );
  await openFile('template', 'القسم,اليوم\n4AM2,dimanche\n');
  expect(shown('tt-read')).toBe(false);
  expect(texts()).toEqual(expect.arrayContaining([tt.refused, tt.otherSource, tt.notImported]));
  expect(texts()).not.toContain(tt.problems);
  expect(texts()).toContain(
    tt.row
      .replace('{{row}}', '1')
      .replace(
        '{{what}}',
        tt.problem.columns.replace(
          '{{columns}}',
          [tt.column.subject, tt.column.teacher, tt.column.start, tt.column.end].join(tt.listSeparator),
        ),
      ),
  );
  await openFile('template', 'القسم,المادة,الأستاذ,اليوم,من\n4AM2,arabic,Made-up Teacher A,dimanche,8:00\n');
  expect(texts()).toContain(tt.refused);
  expect(texts()).not.toContain(tt.otherSource);
  await openFile('fet', 'القسم,المادة,الأستاذ,اليوم,من,إلى\n');
  expect(texts()).toEqual(expect.arrayContaining([tt.refused, tt.otherSource]));
});

test('a clean file says so; one that cannot be read says so, and a cancelled one changes nothing', async () => {
  await enter('preparer');
  await openFile('fet', FET.split('\n')[0]);
  expect(texts()).toContain(tt.noSessions);
  expect(texts()).not.toContain(tt.clean);
  expect(texts()).not.toContain(tt.weeksNone);
  await openFile('fet', FET.split('\n').slice(0, 3).join('\n'));
  expect(texts()).toContain(tt.clean);
  calendarInput.readTable.mockResolvedValueOnce(null);
  await press('tt-open');
  expect(texts()).toContain(tt.clean);
  calendarInput.readTable.mockRejectedValueOnce(new Error('E_CALENDAR_FILE'));
  await press('tt-open');
  expect(texts()).toEqual(expect.arrayContaining([tt.unreadable, tt.clean]));
});

test('an unknown column is listed apart; what was read is said, kept across pages, cleared by a source', async () => {
  await enter('director');
  await press('world-page-timetable');
  await openFile(
    'template',
    'القسم,المادة,الأستاذ,اليوم,من,إلى,ملاحظات\n4AM2,arabic,Made-up Teacher A,dimanche,8:00,9:00,x\n',
  );
  expect(calendarInput.readTable).toHaveBeenCalledTimes(1);
  expect(texts()).toEqual(
    expect.arrayContaining([
      tt.clean,
      tt.notRead,
      tt.row.replace('{{row}}', '1').replace('{{what}}', tt.problem.columnUnknown.replace('{{value}}', 'ملاحظات')),
    ]),
  );
  expect(texts()).not.toContain(tt.problems);
  const said = tt.done.replace('{{sessions}}', text.count.sessions_one).replace('{{left}}', '0');
  expect(texts()).toContain(said);
  const before = tree!.root.findAllByProps({ testID: 'tt-said' })[0];
  calendarInput.readTable.mockResolvedValueOnce(
    'القسم,المادة,الأستاذ,اليوم,من,إلى,ملاحظات\n4AM2,arabic,Made-up Teacher A,dimanche,8:00,9:00,x\n',
  );
  await press('tt-open');
  expect(tree!.root.findAllByProps({ testID: 'tt-said' })[0]).not.toBe(before);
  expect(texts()).toContain(said);
  await press('world-page-dashboard');
  expect(shown('tt-read')).toBe(false);
  await press('world-page-timetable');
  expect(texts()).toContain(tt.notRead);
  await press('tt-source-fet');
  expect(shown('tt-read')).toBe(false);
});

test('the app words in every language read without one word naming two things', () => {
  expect(readTimetable([], timetableWords()).problems).toHaveLength(1);
  expect(levelBells(reference.bells, 'cem').length).toBeGreaterThan(0);
  expect(readFetTimetable([], fetWords(), levelBells(reference.bells, 'cem')).sessions).toHaveLength(0);
});

test('the phone says what was read through TalkBack, and the source waits while a file is chosen', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  let give: (file: string) => void = () => undefined;
  calendarInput.readTable.mockReturnValueOnce(new Promise<string>((resolve) => (give = resolve)));
  const onRead = jest.fn();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <TimetableImport
        level="cem"
        bells={reference.bells}
        workingDays={reference.profile.workingDays}
        read={null}
        onRead={onRead}
      />,
    );
    await settle();
  });
  await press('tt-open');
  const option = tree!.root.findAllByProps({ testID: 'tt-source-template' })[0];
  expect((option.props as PressableProps).disabled).toBe(true);
  await ReactTestRenderer.act(async () => {
    give(FET.split('\n').slice(0, 3).join('\n'));
    await settle();
  });
  expect(onRead).toHaveBeenCalledWith(expect.objectContaining({ source: 'fet' }));
  expect(announce).toHaveBeenCalledWith(
    tt.done.replace('{{sessions}}', text.count.sessions_one).replace('{{left}}', '0'),
  );
  expect(shown('tt-said')).toBe(false);
});
