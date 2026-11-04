// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the observatory reads of an ended term (#627, answer 680): the term's
// packs in the server's order, and 409 as not ready; one pack's figures with
// the nation's and each wilaya's, items and wilayas kept as pairs in order, an
// item or the nation hidden as null, a name such as __proto__ kept as a plain
// name, and the sendings set aside when said;
// ending a term with the starter token and only its year and term; each asked
// on the world's own path, a malformed answer, one for another term or place,
// an unknown world, and any other answer thrown as the world's problems. Every
// world and figure here is made up.

import type { Send } from '../src/demo/world-session';
import type { WorldAnswer, WorldRequest } from '../src/network/world-network';
import { closeTerm, packFigures, termPacks } from '../src/observatory/figures-read';

const WORLD = 'AB12C';
const TERM = { year: '2026-2027', term: 1 } as const;
const heading = { grade: '1AM', subject: 'math', pack: 'pack-1am-math', release: '2026.1' };
const item = { classes: 12, sessions: 2.5, merged: [0, 5], skipped: [5, 15], split: [0, 15], retaught: [95, 100] };
const figure = (classes: number) => ({
  classes,
  teachers: 11,
  schools: 4,
  reached: { median: 512.5, low: 400, high: 700 },
  items: { 'u1-l2': item, 'u1-l1': null },
});
const pack = { ...heading, nation: figure(30), wilayas: { '09': figure(16), '05': figure(14) }, setAside: 2 };

/** A Send that answers each request in turn, and the requests it was sent. */
function answering(...answers: [number, unknown][]) {
  const sent: WorldRequest[] = [];
  const send: Send = (request) => {
    sent.push(request);
    const [status, body] = answers[sent.length - 1] ?? [500, null];
    return Promise.resolve<WorldAnswer>({ status, body, retryAfter: status === 429 ? 30 : null });
  };
  return { send, sent };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'none',
    (error: { code?: string }) => error.code,
  );

test('reads the term’s packs in order, and 409 as not ready', async () => {
  const other = { ...heading, subject: 'arabic' };
  const { send, sent } = answering([200, { ...TERM, packs: [heading, other] }], [409, { message: 'still open' }]);
  await expect(termPacks(WORLD, TERM, send)).resolves.toEqual([heading, other]);
  await expect(termPacks(WORLD, TERM, send)).resolves.toBe('unready');
  expect(sent).toEqual([
    { method: 'GET', path: `/worlds/${WORLD}/insights/figures?year=2026-2027&term=1` },
    { method: 'GET', path: `/worlds/${WORLD}/insights/figures?year=2026-2027&term=1` },
  ]);
});

test('refuses a packs answer of another shape or term, an unknown world and any other answer', async () => {
  const odd: [number, unknown][] = [
    [200, { ...TERM, packs: [{ ...heading, release: '' }] }],
    [200, { ...TERM, packs: [{ ...heading, grade: 7 }] }],
    [200, { ...TERM, packs: { 0: heading } }],
    [200, { ...TERM, term: 2, packs: [] }],
    [200, { year: '2025-2026', term: 1, packs: [] }],
    [200, null],
  ];
  for (const one of odd) expect(await code(termPacks(WORLD, TERM, answering(one).send))).toBe('E_WORLD_SERVER');
  expect(await code(termPacks(WORLD, TERM, answering([404, null]).send))).toBe('E_NO_SUCH_WORLD');
  expect(await code(termPacks(WORLD, TERM, answering([400, null]).send))).toBe('E_WORLD_SERVER');
  expect(await code(termPacks(WORLD, TERM, answering([429, null]).send))).toBe('E_WORLD_BUSY');
});

test('reads a pack’s items and wilayas as pairs in order, a hidden nation, and no count set aside', async () => {
  const { send, sent } = answering([200, { ...TERM, at: 1, figures: pack }]);
  const got = await packFigures(WORLD, TERM, 1, send);
  expect(sent).toEqual([{ method: 'GET', path: `/worlds/${WORLD}/insights/figures?year=2026-2027&term=1&at=1` }]);
  expect(got).toMatchObject({ ...heading, setAside: 2 });
  expect(got.nation).toEqual({
    ...figure(30),
    items: [
      ['u1-l2', item],
      ['u1-l1', null],
    ],
  });
  expect(got.wilayas.map(([wilaya, one]) => [wilaya, one.classes])).toEqual([
    ['09', 16],
    ['05', 14],
  ]);
  const hidden = { ...pack, nation: null, wilayas: {}, setAside: undefined };
  const quiet = await packFigures(WORLD, TERM, 0, answering([200, { ...TERM, at: 0, figures: hidden }]).send);
  expect(quiet).toMatchObject({ nation: null, wilayas: [], setAside: null });
  const held = { ...item, sessions: null };
  const noSessions = { ...pack, nation: { ...figure(30), items: { a: held } } };
  const one = await packFigures(WORLD, TERM, 0, answering([200, { ...TERM, at: 0, figures: noSessions }]).send);
  expect(one.nation?.items).toEqual([['a', held]]);
  const names = {
    ...pack,
    nation: { ...figure(30), items: JSON.parse('{"__proto__":null,"constructor":null}') as object },
  };
  const named = await packFigures(WORLD, TERM, 0, answering([200, { ...TERM, at: 0, figures: names }]).send);
  expect(named.nation?.items).toEqual([
    ['__proto__', null],
    ['constructor', null],
  ]);
});

test('refuses a pack answer of another shape, term or place', async () => {
  const answer = (figures: unknown, at = 0) => answering([200, { ...TERM, at, figures }]).send;
  const nation = (change: object) => ({ ...pack, nation: { ...figure(30), ...change } });
  const items = (change: object) => nation({ items: { a: { ...item, ...change } } });
  const odd = [
    answer(pack, 1),
    answer({ ...pack, subject: '' }),
    answer({ ...pack, subject: 'a'.repeat(257) }),
    answer({ ...pack, wilayas: { ['a'.repeat(257)]: figure(16) } }),
    answer(nation({ classes: 11 })),
    answer({ ...pack, wilayas: { '05': null } }),
    answer({ ...pack, setAside: -1 }),
    answer(nation({ teachers: 1.5 })),
    answer(nation({ reached: { median: 300, low: 400, high: 700 } })),
    answer(nation({ reached: { median: 1200, low: 400, high: 1300 } })),
    answer(nation({ items: [] })),
    answer(items({ merged: [5, 5] })),
    answer(items({ skipped: [0, 120] })),
    answer(items({ split: [0] })),
    answer(items({ sessions: -1 })),
    answer(items({ retaught: undefined })),
    answering([200, { year: TERM.year, term: 3, at: 0, figures: pack }]).send,
    answering([200, { year: '2025-2026', term: 1, at: 0, figures: pack }]).send,
  ];
  for (const send of odd) expect(await code(packFigures(WORLD, TERM, 0, send))).toBe('E_WORLD_SERVER');
  expect(await code(packFigures(WORLD, TERM, 0, answering([409, null]).send))).toBe('E_WORLD_SERVER');
  expect(await code(packFigures(WORLD, TERM, 0, answering([404, null]).send))).toBe('E_NO_SUCH_WORLD');
  await expect(packFigures(WORLD, TERM, -1, answering().send)).rejects.toThrow(RangeError);
});

test('ends a term with the starter token and only its year and term, and refuses another answer', async () => {
  const { send, sent } = answering([200, TERM]);
  await expect(closeTerm(WORLD, 'starter-token-made-up', TERM, send)).resolves.toBeUndefined();
  expect(sent).toEqual([
    { method: 'POST', path: `/worlds/${WORLD}/insights/closed`, body: TERM, starter: 'starter-token-made-up' },
  ]);
  for (const [status, body] of [
    [403, null],
    [409, null],
    [200, { ...TERM, term: 2 }],
  ] as [number, unknown][])
    expect(await code(closeTerm(WORLD, 'starter-token-made-up', TERM, answering([status, body]).send))).toBe(
      'E_WORLD_SERVER',
    );
  expect(await code(closeTerm(WORLD, 'starter-token-made-up', TERM, answering([404, null]).send))).toBe(
    'E_NO_SUCH_WORLD',
  );
});
