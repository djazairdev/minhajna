// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Obs-Report (#627, answer 680), the observatory's page, opened without a
// school as a teachers' world has none: nothing before a term's end by the
// world's date; waiting, forming and empty said in one live region, with a way
// to read again from any term; a problem as an alert, the packs kept; the packs
// by grade, subject and release, their ID added only where two read alike, one
// pack's figures at a time; the counts, the wilayas shown counted, none hidden
// named, the sample's note, and the classes set aside only when any were; the
// medians in the pack's order beside the plan, a median above it said in words,
// a hidden one held back and no plan where the pack is not held; the items most
// often changed by band, never a percentage, with the others in that band; and
// how far classes got, in percent of the plan. Other observatory pages stay
// empty. Every world and figure here is made up.

import type { Day, PlanPack, SchoolYear } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import type { Send } from '../src/demo/world-session';
import type { WorldAnswer, WorldRequest } from '../src/network/world-network';
import { ObsReport } from '../src/observatory/ObsReport';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.obsReport;
const day = (text: string) => text as Day;
const YEAR: SchoolYear = {
  id: '2026-2027',
  from: day('2026-09-01'),
  to: day('2027-07-04'),
  terms: [
    { number: 1, from: day('2026-09-21'), to: day('2026-12-17') },
    { number: 2, from: day('2027-01-04'), to: day('2027-03-18') },
    { number: 3, from: day('2027-04-05'), to: day('2027-06-03') },
  ],
  source: 'made up',
};
const PACK_ID = 'dz.cem.4am.arabic.example';
const math = { grade: '4am', subject: 'math', pack: 'dz.cem.4am.math.example', release: '2026.1' };
const arabic = { grade: '4am', subject: 'arabic', pack: PACK_ID, release: '2026.1' };
const item = (classes: number, sessions: number | null, merged: [number, number]) => ({
  classes,
  sessions,
  merged,
  skipped: [0, 5],
  split: [15, 30],
  retaught: [95, 100],
});
const figure = {
  classes: 214,
  teachers: 97,
  schools: 61,
  reached: { low: 437.5, median: 594, high: 687.5 },
  items: { second: item(203, 6, [0, 5]), first: item(214, 4, [50, 70]), gone: null, odd: item(198, 9, [5, 15]) },
};
const WILAYA = 'wilaya-made-up';
const figures = { ...arabic, nation: figure, wilayas: { [WILAYA]: figure, other: figure }, setAside: 0 };
const planned: PlanPack = {
  id: PACK_ID,
  release: '2026.1',
  anchor: { kind: 'weeks' },
  items: [
    { id: 'first', title: 'First lesson', kind: 'lesson', budget: 5 },
    { id: 'gone', title: 'Gone lesson', kind: 'lesson', budget: 2 },
    { id: 'second', title: 'Second lesson', kind: 'lesson', budget: 5 },
  ],
} as unknown as PlanPack;
const reference = {
  packs: [planned],
  calendar: { year: YEAR, entries: [] },
  profile: {
    workingDays: [0, 1, 2, 3, 4],
    levels: [{ grades: [{ code: '4am', name: { ar: 'الرابعة متوسط', en: '4AM', fr: '4AM' } }] }],
    subjects: [
      { code: 'arabic', name: { ar: 'اللغة العربية', en: 'Arabic', fr: 'Arabe' } },
      { code: 'math', name: { ar: 'الرياضيات', en: 'Math', fr: 'Maths' } },
    ],
  },
} as unknown as WorkspacePagesProps['reference'];

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 12; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}

/** A Send over the term's packs and figures, with an answer of its own to any request, and the paths it was sent. */
function server(packs: unknown[], own: (request: WorldRequest) => WorldAnswer | null = () => null, setAside = 0) {
  const sent: string[] = [];
  const send: Send = (request) => {
    sent.push(request.path);
    const mine = own(request);
    if (mine !== null) return Promise.resolve(mine);
    const asked = { year: YEAR.id, term: 1 };
    const at = new URL(`https://demo.test${request.path}`).searchParams.get('at');
    const body =
      at === null
        ? { ...asked, packs }
        : {
            ...asked,
            at: Number(at),
            figures: Number(at) === 0 ? { ...figures, setAside } : { ...math, nation: null, wilayas: {} },
          };
    return Promise.resolve({ status: 200, body, retryAfter: null });
  };
  return { send, sent };
}

async function open(send: Send, date = '2026-12-20', starter: string | null = null) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <ObsReport
          world={{ world: 'AB12C', date: day(date), starter }}
          year={YEAR}
          reference={reference}
          dayText={(one) => `day ${one}`}
          send={send}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

const textIn = (node: ReactTestRenderer.ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((one) => [(one.props as TextProps).children].flat().map(String).join(''))
    .join('\n');
const byId = (id: string) => tree!.root.findAllByProps({ testID: id })[0];
const has = (id: string) => tree!.root.findAllByProps({ testID: id }).length > 0;
const page = () => textIn(tree!.root);
const status = () => textIn(byId('obs-report-status'));
const press = (id: string) => act(() => (byId(id).props as PressableProps).onPress?.({} as never));

test('says no term before the world’s date reaches the first term’s end, and asks nothing', async () => {
  const { send, sent } = server([]);
  await open(send, '2026-12-16');
  expect(status()).toBe(words.none);
  expect(sent).toEqual([]);
  expect(has('obs-report-again')).toBe(false);
});

test('says a device waits on the starting device, and reads again on asking', async () => {
  let open409 = true;
  const { send, sent } = server([arabic], (request) =>
    open409 && !request.path.includes('&at=') ? { status: 409, body: null, retryAfter: null } : null,
  );
  await open(send);
  expect(status()).toBe(words.waiting);
  expect(has('obs-report-pack-0')).toBe(false);
  expect(sent).toHaveLength(1);
  open409 = false;
  await press('obs-report-again');
  expect(has('obs-report-figures')).toBe(true);
});

test('says a term’s figures are being formed on the starting device', async () => {
  const { send } = server([], (request) =>
    request.method === 'GET'
      ? { status: 409, body: null, retryAfter: null }
      : { status: 200, body: { year: YEAR.id, term: 1 }, retryAfter: null },
  );
  await open(send, '2026-12-20', 'starter-made-up');
  expect(status()).toBe(words.forming);
  expect(has('obs-report-again')).toBe(true);
});

test('says when no pack reached the floor, with nothing to choose', async () => {
  await open(server([]).send);
  expect(status()).toBe(words.empty);
  expect(has('obs-report-pack-0')).toBe(false);
});

test('says a problem as an alert, and reads again on asking', async () => {
  let failing = true;
  const { send } = server([arabic], () => (failing ? { status: 429, body: null, retryAfter: 30 } : null));
  await open(send);
  expect(textIn(byId('obs-report-problem'))).toContain(ar.demo.problem.busy);
  failing = false;
  await press('obs-report-again');
  expect(has('obs-report-problem')).toBe(false);
  expect(has('obs-report-figures')).toBe(true);
});

test('keeps the packs and a way to read again when a pack fails, and opens on the term’s last day', async () => {
  let failing = true;
  const { send } = server([arabic, math], (request) =>
    failing && request.path.includes('&at=') ? { status: 429, body: null, retryAfter: 30 } : null,
  );
  await open(send, '2026-12-17');
  expect(has('obs-report-pack-0')).toBe(true);
  expect(textIn(byId('obs-report-problem'))).toContain(ar.demo.problem.busy);
  failing = false;
  await press('obs-report-again');
  expect(has('obs-report-figures')).toBe(true);
});

test('lists the packs, adding an ID only where two read alike, and shows one at a time', async () => {
  const { send, sent } = server([arabic, math]);
  await open(send);
  expect(textIn(byId('obs-report-pack-0'))).toBe(`الرابعة متوسط · اللغة العربية · ${isolate('2026.1')}`);
  expect(has('obs-report-figures')).toBe(true);
  await press('obs-report-pack-1');
  expect(sent.at(-1)).toContain('&at=1');
  expect(has('obs-report-figures')).toBe(false);
  expect(status()).toBe(words.noNation);
  await act(() => tree?.unmount());
  await open(server([arabic, { ...arabic, pack: 'dz.cem.4am.arabic.other' }]).send);
  expect(textIn(byId('obs-report-pack-0'))).toContain(PACK_ID);
});

test('gives the counts, the sample’s note, and classes set aside only when any were', async () => {
  await open(server([arabic]).send);
  expect(textIn(byId('obs-report-counts'))).toBe(
    words.counts
      .replace('{{classes}}', '214')
      .replace('{{teachers}}', '97')
      .replace('{{schools}}', '61')
      .replace('{{wilayas}}', '2'),
  );
  expect(page()).toContain(words.chosen);
  expect(page()).toContain(words.hidden);
  expect(has(`obs-closure-${WILAYA}`)).toBe(true);
  expect(has('obs-report-aside')).toBe(false);
  await act(() => tree?.unmount());
  await open(server([arabic], () => null, 3).send);
  expect(textIn(byId('obs-report-aside'))).toBe(words.setAside.replace('{{classes}}', '3'));
});

test('gives each item’s median in the pack’s order beside the plan', async () => {
  await open(server([arabic]).send);
  const rows = tree!.root.findAll(
    (one) => typeof one.type === 'string' && String(one.props.testID).startsWith('obs-median-'),
  );
  expect(rows.map((one) => String(one.props.testID))).toEqual([
    'obs-median-first',
    'obs-median-gone',
    'obs-median-second',
    'obs-median-odd',
  ]);
  expect(textIn(byId('obs-median-first'))).toBe(`${isolate('First lesson')}\n5\n4`);
  expect(textIn(byId('obs-median-gone'))).toBe(`${isolate('Gone lesson')}\n2\n${ar.chart.heldBack}`);
  expect(textIn(byId('obs-median-second'))).toBe(
    `${isolate('Second lesson')}\n5\n${words.above.replace('{{median}}', '6')}`,
  );
  expect(textIn(byId('obs-median-odd'))).toBe(`${isolate('odd')}\n${words.noPlan}\n9`);
  expect(textIn(byId('obs-medians'))).toContain(words.itemClasses.replace('{{low}}', '198').replace('{{high}}', '214'));
});

test('gives the items most often changed by band, never a percentage of a class', async () => {
  await open(server([arabic]).send);
  expect(textIn(byId('obs-most-merged'))).toBe(
    [
      words.most.merged,
      isolate('First lesson'),
      words.band.between.replace('{{low}}', '50').replace('{{high}}', '70'),
    ].join('\n'),
  );
  const skipped = textIn(byId('obs-most-skipped'));
  expect(skipped).toContain(isolate('First lesson'));
  expect(skipped).toContain(words.band.under.replace('{{high}}', '5'));
  expect(skipped).toContain(words.sameBand.replace('{{others}}', '2'));
  expect(textIn(byId('obs-most-merged'))).not.toContain(words.sameBand.split('{{')[0]);
  expect(textIn(byId('obs-most-retaught'))).toContain(words.band.over.replace('{{low}}', '95'));
});

test('gives how far classes got in percent of the plan, with its classes', async () => {
  await open(server([arabic]).send);
  const said = textIn(byId('obs-reached'));
  expect(said).toContain(words.reachedMedian.replace('{{median}}', '59,4'));
  expect(said).toContain(words.reachedMiddle.replace('{{low}}', '43,8').replace('{{high}}', '68,8'));
  expect(said).toContain(words.figureClasses.replace('{{classes}}', '214'));
});

test('opens from the observatory’s workspace without a school, and its other pages stay empty', () => {
  const props = { open: {}, school: null, reference, year: YEAR } as unknown as WorkspacePagesProps;
  expect(workspacePage('observatory', 'insights', props)?.type).toBe(ObsReport);
  expect(workspacePage('observatory', 'payload', props)).toBeNull();
  expect(workspacePage('director', 'dashboard', props)).toBeNull();
});
