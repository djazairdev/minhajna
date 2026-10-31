// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teachers' proposals on the director's timetable page (#578, answer 606),
// with the reading and deciding stood in for: looking says none waits, or no
// version yet, or counts them; the first is shown with the session now, the
// slot proposed, the teacher's note and the checks, and accepting sends the
// first day, next Sunday by default, and the note, then says what was decided,
// how many were sent the version and whose part failed, and that a read
// timetable has the old slot, aloud in the hidden live region on a PC, even
// when reading again fails; proposals are told apart by their slot, and picking
// another clears the note; one whose session left the standing version, or
// whose move clashes, drops the room or splits a joint session, can only be
// declined; a problem is said in the catalogue's words, and the proposals are
// read again, keeping the proposal shown and its note; an acceptance still to
// record says so, with its version, has its own button, and offers no decline,
// unless no kept key vouches for the move; and the card's words read in every
// language. Every school and teacher is made up.

import type { Day, ImportedSession, TimetablePublished } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import type { TextFieldProps } from '../src/components/TextField';
import { failed } from '../src/demo/world-session';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import * as proposalSession from '../src/timetable/proposal-session';
import { partFrom } from '../src/timetable/send-session';
import { TimetableProposals } from '../src/timetable/TimetableProposals';
import { isolate } from '../src/week/grid-labels';

const words = ar.ttProposal;
const date = '2026-11-05' as Day;
const world = { world: 'made-up', book: {} as never, date };
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const props = <P,>(testID: string) => tree!.root.findAllByProps({ testID })[0].props as P;

async function act(step: () => void) {
  for (let turn = 0; turn < 10; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string) => act(() => props<PressableProps>(testID).onPress?.({} as never));

async function render() {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <TimetableProposals
          world={world}
          school={{ name: 'متوسطة مختلقة', teachers: [] }}
          bells={[]}
          kit={{} as never}
          dayText={(day) => `day ${day}`}
        />
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
}

const now: ImportedSession = {
  row: 1,
  class: '4م3',
  group: '',
  subject: 'عربية',
  teacher: 'بن يحيى سعاد',
  room: 'ق7',
  day: 0,
  start: 840,
  end: 900,
  week: 'both',
};
const moved = { ...now, start: 660, end: 720, row: 0 };
const waiting = (id: string, more: Partial<proposalSession.WaitingProposal> = {}): proposalSession.WaitingProposal => ({
  id,
  teacher: 'بن يحيى سعاد',
  issue: {} as never,
  proposal: { session: 'a'.repeat(32), day: 0, start: 660, end: 720, room: 'ق7', note: 'صباحاً كله' } as never,
  original: null,
  held: [],
  at: 0,
  now,
  moved,
  clashes: [],
  hours: true,
  joint: false,
  published: false,
  recordable: null,
  ...more,
});
const standing = { version: 2, from: date } as TimetablePublished;
const found = (list: proposalSession.WaitingProposal[], kept: TimetablePublished | null = standing) => ({
  standing: kept,
  version: 3,
  waiting: list,
});

test('looking says no version yet, or none waits', async () => {
  const reading = jest.spyOn(proposalSession, 'readProposals').mockResolvedValueOnce(found([], null));
  await render();
  await press('tt-proposals-look');
  expect(texts()).toContain(words.noVersion);
  reading.mockResolvedValueOnce(found([]));
  await press('tt-proposals-look');
  expect(texts()).toContain(words.none);
  expect(shown('tt-proposal')).toBe(false);
});

test('the director sees a proposal with its checks, accepts it with a note, and hears what was decided', async () => {
  const reading = jest.spyOn(proposalSession, 'readProposals').mockResolvedValueOnce(found([waiting('one')]));
  const sent = { sent: ['بن يحيى سعاد', 'Made-up Other'], failed: ['Made-up Missing'] } as never;
  const deciding = jest.spyOn(proposalSession, 'decideProposal').mockResolvedValueOnce({ version: 3, sent });
  await render();
  await press('tt-proposals-look');
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.waiting.replace('{{proposals}}', '1'),
      words.now.replace('{{version}}', '2'),
      words.note.replace('{{teacher}}', isolate('بن يحيى سعاد')).replace('{{note}}', isolate('صباحاً كله')),
      words.teacherFree.replace('{{teacher}}', isolate('بن يحيى سعاد')),
      words.weekBoth,
    ]),
  );
  expect(tree!.root.findAll((node) => node.type === Text && node.props.testID === 'tt-proposal-check')).toHaveLength(5);
  expect(shown('tt-proposal-moved')).toBe(true);
  expect(shown('tt-proposal-pick')).toBe(false);
  await act(() => props<TextFieldProps>('tt-proposal-reply').onChangeText('ملاحظة مختلقة'));
  reading.mockRejectedValueOnce(failed('Made-up offline', 'E_OFFLINE'));
  await press('tt-proposal-accept');
  const from = partFrom(date);
  expect(deciding.mock.calls[0].slice(2, 4)).toEqual(['one', { accepted: true, note: 'ملاحظة مختلقة', from }]);
  const accepted = words.accepted.replace('{{version}}', '3').replace('{{teacher}}', isolate('بن يحيى سعاد'));
  expect(texts()).toEqual(
    expect.arrayContaining([
      accepted,
      ar.ttSend.sent.replace('{{teachers}}', '2'),
      `${ar.ttSend.failed} ${isolate('Made-up Missing')}`,
      words.readAgain,
    ]),
  );
  expect(texts()).not.toContain(ar.demo.problem.offline);
  expect([props<TextProps>('tt-proposals-said').children as string]).toEqual([accepted]);
});

test('a stale or clashing proposal can only be declined, and a problem is said', async () => {
  const list = [
    waiting('one', { clashes: ['room'], joint: true, moved: { ...moved, room: '' } }),
    waiting('two', { at: -1, now: null, moved: null }),
  ];
  jest.spyOn(proposalSession, 'readProposals').mockResolvedValue(found(list));
  const deciding = jest
    .spyOn(proposalSession, 'decideProposal')
    .mockRejectedValueOnce(failed('Made-up settled', 'E_TIMETABLE_DECIDED'))
    .mockResolvedValueOnce({ version: null, sent: null });
  await render();
  await press('tt-proposals-look');
  expect(texts()).toEqual(
    expect.arrayContaining([words.cannot, words.roomDropped.replace('{{room}}', isolate('ق7')), words.joint]),
  );
  const chips = props<{ choices: { label: string }[] }>('tt-proposal-pick').choices.map((one) => one.label);
  expect(new Set(chips).size).toBe(2);
  await act(() => props<TextFieldProps>('tt-proposal-reply').onChangeText('ملاحظة مختلقة'));
  expect(shown('tt-proposal-accept')).toBe(false);
  await act(() => props<{ onSelect: (value: string) => void }>('tt-proposal-pick').onSelect('two'));
  expect(texts()).toContain(words.gone);
  expect(shown('tt-proposal-check')).toBe(false);
  expect(props<TextFieldProps>('tt-proposal-reply').value).toBe('');
  await act(() => props<TextFieldProps>('tt-proposal-reply').onChangeText('سبب مختلق'));
  await press('tt-proposal-decline');
  expect(texts()).toContain(words.decided);
  expect(props<TextFieldProps>('tt-proposal-reply').value).toBe('سبب مختلق');
  await press('tt-proposal-decline');
  expect(deciding.mock.calls.map((call) => [call[2], call[3].accepted, call[3].note])).toEqual([
    ['two', false, 'سبب مختلق'],
    ['two', false, 'سبب مختلق'],
  ]);
  expect(texts()).toContain(words.declined.replace('{{teacher}}', isolate('بن يحيى سعاد')));
});

test('an acceptance still to record says so, and is recorded with its own button', async () => {
  const list = [waiting('three', { at: -1, now: null, moved: null, published: true, recordable: 2 })];
  jest.spyOn(proposalSession, 'readProposals').mockResolvedValue(found(list));
  const deciding = jest.spyOn(proposalSession, 'decideProposal').mockResolvedValueOnce({ version: 2, sent: null });
  await render();
  await press('tt-proposals-look');
  expect(texts()).toContain(words.recordLine.replace('{{version}}', '2'));
  expect(shown('tt-proposal-day')).toBe(false);
  expect(props<{ label: string }>('tt-proposal-accept').label).toBe(words.record);
  expect(shown('tt-proposal-decline')).toBe(false);
  await press('tt-proposal-accept');
  expect(deciding.mock.calls[0][3].accepted).toBe(true);
  expect(texts()).toContain(words.accepted.replace('{{version}}', '2').replace('{{teacher}}', isolate('بن يحيى سعاد')));
});

test('a published move no kept key vouches for may still be declined', async () => {
  const list = [waiting('four', { at: -1, now: null, moved: null, published: true })];
  jest.spyOn(proposalSession, 'readProposals').mockResolvedValue(found(list));
  await render();
  await press('tt-proposals-look');
  expect(texts()).toContain(words.publishedLine);
  expect([shown('tt-proposal-accept'), shown('tt-proposal-decline')]).toEqual([true, true]);
});

test('the card’s words read in every language', () => {
  for (const one of [en, fr]) {
    expect(Object.keys(one.ttProposal).sort()).toEqual(Object.keys(ar.ttProposal).sort());
    for (const [key, value] of Object.entries(ar.ttProposal)) {
      const places = (text: string) => (text.match(/\{\{\w+\}\}/gu) ?? []).sort();
      expect([key, places(one.ttProposal[key as keyof typeof one.ttProposal])]).toEqual([key, places(value)]);
    }
  }
});
