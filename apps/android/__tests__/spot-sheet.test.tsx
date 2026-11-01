// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The spot-check sheet on I-Grant (#594, answer 622), on the made-up term of
// grant-term.ts: its tab says how the days are drawn and that opening it opens
// every class; opened, it shows each drawn day with 1م2's held session, its
// slot, a field for the exercise books and the notes, and the classes' tab then
// shows 1م2 open; the notes typed are saved on the phone, said saved, and come
// back on the page opened again; notes on sessions no longer held are shown and
// kept on saving, the saving announced, the saved line going once the notes
// change, and a saving that fails is said as an alert, a second press waiting;
// an ended grant's sheet shows what the phone kept, read only, each note by its
// class's number, or that it does not open; kept days with no held session left
// each say so; and its words read in every language. Every school, class,
// teacher and device is made up.

import { addDays, keptSpotSheet, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, TextInput, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { grantTerm, STAFFED, WEEKS } from '../jest/grant-term';
import { SCHOOL } from '../jest/grant-world';
import { MINE } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { approveGrant } from '../src/director/grant-make';
import { InspectorGrants, type InspectorGrantsProps } from '../src/inspector/InspectorGrants';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { spanText } from '../src/timetable/grid-text';
import { isolate } from '../src/week/grid-labels';
import { deliveryReading } from '../src/week/school-mine-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.inspectorGrant;
const day = (one: Day) => `day ${one}`;
const reading = deliveryReading(MINE, [], []);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
});

const settle = async () => {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const found = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID);
const press = async (testID: string) => {
  const [button] = found(testID).filter((node) => typeof node.props.onPress === 'function');
  await ReactTestRenderer.act(() => {
    (button.props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const type = async (testID: string, text: string) => {
  const [input] = tree!.root.findAllByType(TextInput).filter((node) => node.props.testID === testID);
  await ReactTestRenderer.act(() => {
    (input.props as { onChangeText: (value: string) => void }).onChangeText(text);
  });
};
const valueOf = (testID: string) =>
  tree!.root.findAllByType(TextInput).find((node) => node.props.testID === testID)?.props.value as unknown;

async function render(world: InspectorGrantsProps['world']) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <InspectorGrants
          world={world}
          directorate={SCHOOL.directorateId}
          schools={[]}
          reading={reading}
          workingDays={MINE.profile.workingDays}
          kit={kit}
          send={server.send}
          dayText={day}
        />
      </LocaleDirContext.Provider>,
    );
  });
  await settle();
}

const tab = async (grant: string, value: 'classes' | 'sheet') => {
  const [control] = found(`inspector-grant-${grant}-tabs`).filter((node) => typeof node.props.onSelect === 'function');
  await ReactTestRenderer.act(() => {
    (control.props as { onSelect: (value: string) => void }).onSelect(value);
  });
  await settle();
};

test('the sheet opens its days and rows, and the notes saved come back', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const id = `inspector-grant-${grant.id}-sheet`;
  await render(inspector);
  await tab(grant.id, 'sheet');
  expect(texts()).toEqual(expect.arrayContaining([words.sheetIntro, words.sheetOpenLine, words.sheetFoot]));
  await press(`${id}-open`);
  const drawn = [WEEKS[0], WEEKS[1], addDays(WEEKS[1], 1)];
  expect(drawn.map((one) => found(`${id}-day-${one}`).length > 0)).toEqual([true, true, true]);
  const row = words.sheetRow
    .replace('{{class}}', isolate('1م2'))
    .replace('{{subject}}', isolate('رياضيات'))
    .replace('{{slot}}', isolate(spanText(480, 540)));
  expect(texts().filter((one) => one === row)).toHaveLength(3);
  expect(texts()).toEqual(expect.arrayContaining([words.sheetTitle, words.sheetSigned, ...drawn.map(day)]));
  const book = `${id}-row-0`;
  await type(book, 'Made-up match');
  await type(`${id}-notes`, 'Made-up visit notes');
  await press(`${id}-save`);
  expect(found(`${id}-saved`).length).toBeGreaterThan(0);
  const said = found(`${id}-said`).filter((node) => typeof node.type !== 'string');
  expect(said.map((node) => (node.props as TextProps).children)).toEqual([words.sheetSaved]);
  await tab(grant.id, 'classes');
  expect(texts()).toContain(words.heldLabel);
  await render(inspector);
  await tab(grant.id, 'sheet');
  await press(`${id}-open`);
  expect([valueOf(book), valueOf(`${id}-notes`)]).toEqual(['Made-up match', 'Made-up visit notes']);
});

test('notes on sessions no longer held stay and are kept on saving; saving again is said, or why not', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const id = `inspector-grant-${grant.id}-sheet`;
  const course = grant.weeks[0].course;
  const gone = { row: `${WEEKS[0]}\n${course}\n600\n`, note: 'Made-up note on a dropped session' };
  const days = [WEEKS[0], WEEKS[1], addDays(WEEKS[1], 1)];
  await inspector.book.record(inspector.date, {
    kind: 'inspector.sheet',
    sheet: { grant: grant.id, days, notes: '', books: [gone] },
  });
  await render(inspector);
  await tab(grant.id, 'sheet');
  await press(`${id}-open`);
  expect(found(`${id}-gone`).length).toBeGreaterThan(0);
  expect(texts().some((one) => one.includes(gone.note))).toBe(true);
  await type(`${id}-notes`, 'Made-up visit notes');
  await press(`${id}-save`);
  expect(keptSpotSheet(inspector.book.entries, grant.id)?.books).toEqual([gone]);
  expect(found(`${id}-saved`).length).toBeGreaterThan(0);
  await type(`${id}-notes`, 'Made-up visit notes, edited');
  expect(found(`${id}-saved`)).toEqual([]);
  const record = jest.spyOn(inspector.book, 'record').mockRejectedValue(new Error('made-up store failure'));
  await ReactTestRenderer.act(() => {
    const [save] = found(`${id}-save`).filter((node) => typeof node.props.onPress === 'function');
    (save.props as PressableProps).onPress?.({} as never);
    (save.props as PressableProps).onPress?.({} as never);
  });
  await settle();
  expect(record).toHaveBeenCalledTimes(1);
  expect(
    tree!.root.findAll((node) => node.props.accessibilityRole === 'alert' && typeof node.type !== 'string'),
  ).toHaveLength(1);
  expect(valueOf(`${id}-notes`)).toBe('Made-up visit notes, edited');
  record.mockRestore();
});

test('kept days with no held session left each say so, and the sheet does not say none was drawn', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const id = `inspector-grant-${grant.id}-sheet`;
  const days = [addDays(WEEKS[0], 1), addDays(WEEKS[0], 2), addDays(WEEKS[1], 2)];
  await inspector.book.record(inspector.date, {
    kind: 'inspector.sheet',
    sheet: { grant: grant.id, days, notes: '', books: [] },
  });
  await render(inspector);
  await tab(grant.id, 'sheet');
  await press(`${id}-open`);
  expect(days.map((one) => found(`${id}-day-${one}`).length > 0)).toEqual([true, true, true]);
  expect(texts().filter((one) => one === words.sheetDayNone)).toHaveLength(3);
  expect(texts()).not.toContain(words.sheetNoDays);
});

test('an ended grant’s sheet shows what the phone kept, read only, or that it does not open', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const after = { ...inspector, date: addDays(grant.until, 1) };
  await render(after);
  await tab(grant.id, 'sheet');
  expect(texts()).toContain(words.sheetEnded);
  expect(found(`inspector-grant-${grant.id}-sheet-open`)).toEqual([]);
  await inspector.book.record(inspector.date, {
    kind: 'inspector.sheet',
    sheet: {
      grant: grant.id,
      days: [WEEKS[0]],
      notes: 'Made-up visit notes',
      books: [{ row: `${WEEKS[0]}\n${grant.weeks[0].course}\n480\n`, note: 'Made-up match' }],
    },
  });
  await render(after);
  await tab(grant.id, 'sheet');
  const note = words.sheetKept
    .replace('{{row}}', [isolate(words.class.replace('{{number}}', '1')), day(WEEKS[0]), isolate('08:00')].join(' · '))
    .replace('{{note}}', 'Made-up match');
  expect(texts()).toEqual(
    expect.arrayContaining([words.sheetEndedKept, day(WEEKS[0]), note, words.sheetNotes, 'Made-up visit notes']),
  );
  expect(tree!.root.findAllByType(TextInput)).toEqual([]);
});

test('the sheet’s words read in every language', () => {
  const sheet = (all: typeof ar) =>
    Object.entries(all.demo.inspectorGrant)
      .filter(([key]) => key.startsWith('sheet') || key.startsWith('tab'))
      .map(([key, one]) => [key, (one.match(/\{\{\w+\}\}/gu) ?? []).sort()]);
  for (const all of [fr, en]) expect(sheet(all as typeof ar)).toEqual(sheet(ar));
});
