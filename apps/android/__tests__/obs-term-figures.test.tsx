// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Obs-Report's state (#627, answer 680): no term before the world's date
// reaches the first term's end, then that term read once it does, the next term
// once the date reaches its end, the choice of pack dropped, and nothing read
// again while the date moves within a term; the starter's device ending an open
// term once and reading again, each new term too, forming when still not ready,
// and another device waiting without ending it; a term with no pack shown; one
// pack's figures read at a time, the first unless another is chosen, a place
// out of range ignored; a problem said in the catalogue's words, a refused
// ending too, and read again on asking; a slower answer for an earlier choice
// or term, or after leaving, dropped; and a Send new at every render reading
// nothing more. Every world here is made up.

import type { Day, SchoolYear } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import type { Send } from '../src/demo/world-session';
import type { WorldAnswer, WorldRequest } from '../src/network/world-network';
import { useTermFigures, type TermFigures } from '../src/observatory/use-term-figures';

const WORLD = 'AB12C';
const STARTER = 'starter-token-made-up';
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
const heading = (subject: string) => ({ grade: '1AM', subject, pack: `pack-${subject}`, release: '2026.1' });
const PACKS = [heading('math'), heading('arabic')];

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let shown: TermFigures | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  shown = undefined;
});

interface Made {
  readonly ended?: number[];
  /** An answer of its own to a request, else null. */
  readonly answer?: (request: WorldRequest) => WorldAnswer | null;
  /** Holds the first pack's figures, the first time, until released. */
  readonly hold?: boolean;
}

/** A made-up observatory, the requests it was sent, and how to release a held answer. */
function observatory({ ended = [], answer = () => null, hold = false }: Made = {}) {
  const sent: string[] = [];
  const holds: (() => void)[] = [];
  const send: Send = async (request) => {
    const url = new URL(`https://demo.test${request.path}`);
    const term = Number(url.searchParams.get('term') ?? (request.body as { term: number } | undefined)?.term);
    const at = url.searchParams.get('at');
    sent.push(request.method === 'POST' ? `close ${term}` : at === null ? `packs ${term}` : `pack ${term} ${at}`);
    const reply = (status: number, body: unknown): WorldAnswer => ({ status, body, retryAfter: null });
    const own = answer(request);
    if (own !== null) return own;
    if (request.method === 'POST') {
      if (request.starter === STARTER) ended.push(term);
      return request.starter === STARTER ? reply(200, request.body) : reply(403, null);
    }
    const asked = { year: YEAR.id, term };
    if (!ended.includes(term)) return reply(409, { message: 'still open' });
    if (at === null) return reply(200, { ...asked, packs: PACKS });
    if (hold && holds.length === 0 && at === '0') await new Promise<void>((resolve) => holds.push(resolve));
    return reply(200, { ...asked, at: Number(at), figures: { ...PACKS[Number(at)], nation: null, wilayas: {} } });
  };
  return { send, sent, holds };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 20; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}

const report = (one: TermFigures) => {
  shown = one;
};

function Probe({ date, starter, send, fresh }: { date: Day; starter: string | null; send: Send; fresh?: boolean }) {
  report(useTermFigures({ world: WORLD, date, starter }, YEAR, fresh ? (request) => send(request) : send));
  return null;
}

/** A Send that holds its first request until released, and the release. */
function holdingFirst(send: Send) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  const held: Send = async (request) => {
    if (first) {
      first = false;
      await gate;
    }
    return send(request);
  };
  return { held, release: () => release() };
}

async function render(date: string, starter: string | null, send: Send) {
  await act(() => {
    tree = ReactTestRenderer.create(<Probe date={day(date)} starter={starter} send={send} />);
  });
  return (next: string) => act(() => tree!.update(<Probe date={day(next)} starter={starter} send={send} />));
}

test('reports no term before the world’s date reaches the first term’s end, then each term as it does', async () => {
  const { send, sent, holds } = observatory({ ended: [1, 2], hold: true });
  const move = await render('2026-12-16', STARTER, send);
  expect(shown).toMatchObject({ term: null, state: 'none', packs: [], figures: undefined, problem: null });
  expect(sent).toEqual([]);
  await move('2026-12-17');
  holds.forEach((release) => release());
  await act();
  expect(shown).toMatchObject({ term: { year: '2026-2027', term: 1 }, state: 'ready', packs: PACKS, at: 0 });
  expect(shown?.figures).toMatchObject({ subject: 'math', nation: null, wilayas: [], setAside: null });
  await act(() => shown!.choose(1));
  expect(shown?.figures).toMatchObject({ subject: 'arabic' });
  await move('2026-12-20');
  expect(shown).toMatchObject({ state: 'ready', at: 1, figures: { subject: 'arabic' } });
  await move('2027-03-18');
  expect(shown).toMatchObject({ term: { term: 2 }, state: 'ready', at: 0, figures: { subject: 'math' } });
  expect(sent).toEqual(['packs 1', 'pack 1 0', 'pack 1 1', 'packs 2', 'pack 2 0']);
});

test('the starter’s device ends an open term once and reads again; another device waits', async () => {
  const mine = observatory();
  await render('2026-12-17', STARTER, mine.send);
  expect(shown).toMatchObject({ state: 'ready', figures: { subject: 'math' } });
  expect(mine.sent).toEqual(['packs 1', 'close 1', 'packs 1', 'pack 1 0']);
  await act(() => tree?.unmount());
  const theirs = observatory();
  await render('2026-12-17', null, theirs.send);
  expect(shown).toMatchObject({ term: { term: 1 }, state: 'waiting', packs: [], figures: undefined, problem: null });
  expect(theirs.sent).toEqual(['packs 1']);
});

test('the starter’s device ends each new term as the date reaches it', async () => {
  const { send, sent } = observatory();
  const move = await render('2026-12-17', STARTER, send);
  await move('2027-03-18');
  expect(shown).toMatchObject({ term: { term: 2 }, state: 'ready', figures: { subject: 'math' } });
  expect(sent).toEqual(['packs 1', 'close 1', 'packs 1', 'pack 1 0', 'packs 2', 'close 2', 'packs 2', 'pack 2 0']);
});

test('a Send new at every render reads nothing more', async () => {
  const { send, sent } = observatory();
  await act(() => {
    tree = ReactTestRenderer.create(<Probe date={day('2026-12-17')} starter={STARTER} send={send} fresh />);
  });
  expect(shown).toMatchObject({ state: 'ready', figures: { subject: 'math' } });
  expect(sent).toEqual(['packs 1', 'close 1', 'packs 1', 'pack 1 0']);
});

test('a term with no pack shown is empty and asks for no figures', async () => {
  const { send, sent } = observatory({
    answer: (request) =>
      request.method === 'GET' ? { status: 200, body: { year: YEAR.id, term: 1, packs: [] }, retryAfter: null } : null,
  });
  await render('2026-12-17', STARTER, send);
  expect(shown).toMatchObject({ state: 'empty', packs: [], figures: undefined, problem: null });
  expect(sent).toEqual(['packs 1']);
});

test('a refused ending is a problem in the catalogue’s words', async () => {
  for (const status of [403, 409]) {
    const { send, sent } = observatory({
      answer: (request) => (request.method === 'POST' ? { status, body: null, retryAfter: null } : null),
    });
    await render('2026-12-17', STARTER, send);
    expect(shown).toMatchObject({ state: 'problem', packs: [], problem: 'demo.problem.other' });
    expect(sent).toEqual(['packs 1', 'close 1']);
    await act(() => tree?.unmount());
  }
});

test('a term still not ready once ended is forming, and read again on asking', async () => {
  let forming = true;
  const { send, sent } = observatory({
    answer: (request) => (forming && request.method === 'GET' ? { status: 409, body: null, retryAfter: null } : null),
  });
  await render('2027-01-10', STARTER, send);
  expect(shown).toMatchObject({ term: { term: 1 }, state: 'forming', packs: [] });
  forming = false;
  await act(() => shown!.again());
  expect(shown).toMatchObject({ state: 'ready', figures: { subject: 'math' } });
  expect(sent).toEqual(['packs 1', 'close 1', 'packs 1', 'packs 1', 'pack 1 0']);
});

test('a problem is said in the catalogue’s words, a pack’s too, and a place out of range is ignored', async () => {
  let failing = 'packs';
  const { send } = observatory({
    ended: [1],
    answer: (request) => {
      const asked = request.path.includes('&at=') ? 'pack' : 'packs';
      return asked === failing ? { status: 429, body: null, retryAfter: 30 } : null;
    },
  });
  await render('2026-12-20', null, send);
  expect(shown).toMatchObject({ state: 'problem', packs: [], problem: 'demo.problem.busy' });
  failing = 'pack';
  await act(() => shown!.again());
  expect(shown).toMatchObject({ state: 'ready', packs: PACKS, figures: undefined, problem: 'demo.problem.busy' });
  failing = 'none';
  await act(() => shown!.choose(5));
  await act(() => shown!.choose(-1));
  expect(shown?.at).toBe(0);
  await act(() => shown!.again());
  expect(shown).toMatchObject({ state: 'ready', at: 0, figures: { subject: 'math' }, problem: null });
});

test('a slower answer for an earlier term is dropped', async () => {
  const { send, sent } = observatory({ ended: [1, 2] });
  const { held, release } = holdingFirst(send);
  const move = await render('2026-12-17', null, held);
  expect(shown).toMatchObject({ term: { term: 1 }, state: 'reading' });
  await move('2027-03-18');
  expect(shown).toMatchObject({ term: { term: 2 }, state: 'ready', figures: { subject: 'math' } });
  await act(release);
  expect(shown).toMatchObject({ term: { term: 2 }, state: 'ready', figures: { subject: 'math' } });
  expect(sent).toEqual(['packs 2', 'pack 2 0', 'packs 1']);
});

test('an answer after leaving the page goes no further', async () => {
  const { send, sent } = observatory({ ended: [1] });
  const { held, release } = holdingFirst(send);
  await render('2026-12-17', null, held);
  await act(() => tree?.unmount());
  await act(release);
  expect(shown).toMatchObject({ state: 'reading' });
  expect(sent).toEqual(['packs 1']);
});

test('leaving the page before a term’s first answer ends nothing', async () => {
  const { send, sent } = observatory();
  const { held, release } = holdingFirst(send);
  await render('2026-12-17', STARTER, held);
  await act(() => tree?.unmount());
  await act(release);
  expect(sent).toEqual(['packs 1']);
});

test('a slower answer for an earlier choice of pack is dropped', async () => {
  const { send, holds } = observatory({ ended: [1], hold: true });
  await render('2026-12-17', null, send);
  expect(shown).toMatchObject({ state: 'ready', figures: undefined });
  await act(() => shown!.choose(1));
  expect(shown?.figures).toMatchObject({ subject: 'arabic' });
  await act(() => holds.forEach((release) => release()));
  expect(shown).toMatchObject({ at: 1, figures: { subject: 'arabic' } });
});
