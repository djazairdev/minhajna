// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Entering the timetable by hand (#576, answer 594): the third source shows a
// form whose check says what is still to fill in, then that the session reads
// with no clash; a session added is listed by number, counted and laid out as a
// file's reading is, said aloud, and the form empties but for the class, the
// day and the week, while a clash is said as it comes and the session ready or
// a time that does not read once a field is left; the check says an unreadable
// time, an end before the start, and a clash naming the class and subject it
// meets with its entry, and a clashing session cannot be added, while one
// session taught to two classes together is added and listed; an entry's number
// is never used again, even after every entry is removed, which leaves nothing
// to show, and choosing a file's source clears what was entered. Two groups of
// a class share a time, a group meets the whole class, and the phone says
// through TalkBack that a session was added, and a clash, with no hidden
// region. Every class and teacher is made up.

import type { ImportedSession } from '@minhajna/core';
import { useState } from 'react';
import { AccessibilityInfo, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { bundledReference, readReference } from '../src/reference';
import text from '../src/text/ar.json';
import { TimetableImport, type TimetableRead } from '../src/timetable/TimetableImport';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const tt = text.ttImport;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let kept: TimetableRead | null = null;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  kept = null;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const checks = () =>
  tree!.root
    .findAllByProps({ testID: 'tt-hand-check' })
    .filter((node) => typeof node.type !== 'string')
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const prop = <T,>(testID: string) => tree!.root.findAllByProps({ testID })[0].props as T;

/** The page, holding what is entered as the world does. */
function Page() {
  const [timetable, setTimetable] = useState<TimetableRead | null>(null);
  return (
    <TimetableImport
      level="cem"
      bells={reference.bells}
      workingDays={reference.profile.workingDays}
      read={timetable}
      onRead={(next) => {
        kept = next;
        setTimetable(next);
      }}
    />
  );
}

async function act(step: () => void) {
  await ReactTestRenderer.act(async () => {
    step();
    await settle();
  });
}

const said = (testID: string) => [prop<TextProps>(testID).children].flat().map(String).join('');
const press = (testID: string) => act(() => prop<PressableProps>(testID).onPress?.({} as never));
const type = (field: string, value: string) =>
  act(() => prop<{ onChangeText: (value: string) => void }>(`tt-hand-${field}`).onChangeText(value));

/** Fills the form with a session on the given day, as typed. */
async function fill(fields: Record<string, string>, day: number) {
  for (const [field, value] of Object.entries(fields)) await type(field, value);
  await press(`tt-hand-day-${day}`);
}

async function open() {
  await act(() => {
    tree = ReactTestRenderer.create(<Page />);
  });
  await press('tt-source-hand');
}

const sunday = { class: '4AM2', subject: 'arabic', teacher: 'Teacher A', start: '8h00', end: '9:00', room: 'R1' };

test('a session is checked as it is typed, then added, listed, counted and laid out', async () => {
  await open();
  expect(texts()).toContain(tt.handLine);
  expect(checks()).toEqual([
    tt.handMissing.replace(
      '{{columns}}',
      ['class', 'subject', 'teacher', 'day', 'start', 'end']
        .map((one) => tt.column[one as keyof typeof tt.column])
        .join(tt.listSeparator),
    ),
  ]);
  expect(prop<{ disabled: boolean }>('tt-hand-add').disabled).toBe(true);
  await fill(sunday, 0);
  expect(checks()).toEqual([tt.handReady]);
  expect(said('tt-hand-said')).toBe('');
  await act(() => prop<{ onBlur: () => void }>('tt-hand-room').onBlur());
  expect(said('tt-hand-said')).toBe(tt.handReady);
  await press('tt-hand-add');
  expect(said('tt-hand-added')).toBe(tt.handAdded.replace('{{number}}', '1'));
  const names = tree!.root
    .findAllByProps({ testID: 'tt-hand-remove-1' })
    .map((node) => (node.props as { accessibilityLabel?: string }).accessibilityLabel);
  expect(names).toContain(tt.handRemoveEntry.replace('{{number}}', '1'));
  expect(texts()).toEqual(
    expect.arrayContaining([
      tt.entered,
      tt.entry
        .replace('{{number}}', '1')
        .replace('{{day}}', text.week.days['0'])
        .replace('{{span}}', '08:00–09:00')
        .replace('{{what}}', '4AM2 · arabic · Teacher A · R1'),
      tt.clean,
    ]),
  );
  expect(prop<{ value: string }>('tt-hand-subject').value).toBe('');
  expect(prop<{ value: string }>('tt-hand-class').value).toBe('4AM2');
  expect(prop<{ selected: string }>('tt-hand-day').selected).toBe('0');
  expect(said('tt-hand-said')).toBe('');
  expect(kept?.source).toBe('hand');
  expect(kept?.result.sessions).toHaveLength(1);
  expect(tree!.root.findAllByProps({ testID: 'tt-grid' }).length).toBeGreaterThan(0);
});

test('an unreadable time, an end before the start and a clash are said, and a clash cannot be added', async () => {
  await open();
  await fill(sunday, 0);
  await press('tt-hand-add');
  await fill({ ...sunday, class: '4AM3', subject: 'math', start: 'eight' }, 0);
  expect(checks()).toEqual([tt.problem.time.replace('{{value}}', 'eight')]);
  expect(said('tt-hand-said')).toBe('');
  await act(() => prop<{ onBlur: () => void }>('tt-hand-start').onBlur());
  expect(said('tt-hand-said')).toBe(tt.problem.time.replace('{{value}}', 'eight'));
  await type('start', '10:00');
  expect(checks()).toEqual([tt.problem.order]);
  await type('start', '8:30');
  const clashes = [
    tt.handClash.teacher.replace('{{class}}', '4AM2').replace('{{with}}', '1'),
    tt.handClash.room.replace('{{class}}', '4AM2').replace('{{with}}', '1'),
  ];
  expect(checks()).toEqual(clashes);
  expect(said('tt-hand-said')).toBe(clashes.join(' '));
  expect(prop<{ disabled: boolean }>('tt-hand-add').disabled).toBe(true);
  await fill({ ...sunday, class: '4AM3' }, 0);
  expect(checks()).toEqual([tt.handReady]);
  await press('tt-hand-add');
  expect(texts()).toEqual(
    expect.arrayContaining([tt.together, tt.togetherEntry.replace('{{row}}', '2').replace('{{with}}', '1')]),
  );
});

test('removing every entry leaves no timetable, and a file source clears what was entered', async () => {
  await open();
  await fill(sunday, 0);
  await press('tt-hand-add');
  await fill({ ...sunday, teacher: 'Teacher B', room: 'R2' }, 1);
  await press('tt-hand-add');
  expect((kept?.result.sessions ?? []).map((one: ImportedSession) => one.row)).toEqual([1, 2]);
  await press('tt-hand-remove-1');
  expect(tree!.root.findAllByProps({ testID: 'tt-hand-entry-1' })).toHaveLength(0);
  await fill({ ...sunday, teacher: 'Teacher C', room: 'R3' }, 2);
  await press('tt-hand-add');
  expect((kept?.result.sessions ?? []).map((one: ImportedSession) => one.row)).toEqual([2, 3]);
  await press('tt-hand-remove-3');
  await fill({ ...sunday, teacher: 'Teacher D', room: 'R4' }, 3);
  await press('tt-hand-add');
  expect((kept?.result.sessions ?? []).map((one: ImportedSession) => one.row)).toEqual([2, 4]);
  await press('tt-hand-remove-2');
  await press('tt-hand-remove-4');
  expect(kept?.result.sessions).toEqual([]);
  expect(tree!.root.findAllByProps({ testID: 'tt-read' })).toHaveLength(0);
  expect(texts()).not.toContain(tt.noSessions);
  await fill(sunday, 0);
  await press('tt-hand-add');
  expect((kept?.result.sessions ?? []).map((one: ImportedSession) => one.row)).toEqual([5]);
  await press('tt-source-fet');
  expect(kept).toBeNull();
});

test('two groups of a class share a time, and the phone says through TalkBack that a session was added', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await open();
  await fill({ ...sunday, group: 'G1' }, 0);
  await press('tt-hand-add');
  expect(announce).toHaveBeenCalledWith(tt.handAdded.replace('{{number}}', '1'));
  expect(tree!.root.findAllByProps({ testID: 'tt-hand-said' })).toHaveLength(0);
  expect(tree!.root.findAllByProps({ testID: 'tt-hand-added' })).toHaveLength(0);
  await fill({ ...sunday, group: 'G2', teacher: 'Teacher B', room: 'R2' }, 0);
  expect(checks()).toEqual([tt.handReady]);
  await type('group', '');
  const clash = tt.handClash.class
    .replace('{{class}}', '4AM2')
    .replace('{{subject}}', 'arabic')
    .replace('{{with}}', '1');
  expect(checks()).toEqual([clash]);
  expect(announce).toHaveBeenLastCalledWith(clash);
  announce.mockRestore();
});
