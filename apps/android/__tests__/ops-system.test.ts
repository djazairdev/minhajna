// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators' console reads of the demo server (#618, answer 655): the
// server version published with this app equal to the server package's own; the
// server's description taken in each shape the server gives, 503 only when the
// database is failing, a world that is gone said as erased, and refused when
// shaped otherwise; the same keys and placeholders in every language's words,
// plural forms aside; its map drawn only from that description, the backups
// only while the database archives, the line to outside services closed, every
// box and line written out with its rows, and mirrored left to right; and the
// fingerprint in groups of four.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WorldAnswer } from '../src/network/world-network';
import { opsBoxes, opsMap } from '../src/operators/ops-map';
import { fingerprintText, readSystem, SERVER_RELEASE, systemView, type SystemView } from '../src/operators/ops-system';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

const FINGERPRINT = 'ab'.repeat(32);
const PARTS = ['gateway', 'relay', 'totals', 'standins', 'observatory'] as const;
const base = { version: '0.1.0', fingerprint: FINGERPRINT, parts: PARTS };
const archived: SystemView = { ...base, storage: 'postgresql', database: 'ok', archive: 'on' };
const tested = { ...archived, archiving: 'ok', restore: { day: '2026-12-01', result: 'passed' } };
const words = ar.demo.ops;

/** The catalogue's words by dotted key, as i18next reads them. */
const t = ((key: string) =>
  key
    .replace(/^demo\.ops\./u, '')
    .split('.')
    .reduce<unknown>((at, part) => (at as Record<string, unknown>)[part], words)) as never;

const NO_WORLD = { statusCode: 404, message: 'no world has this id and pass' };
const answer = (status: number, body: unknown) => () =>
  Promise.resolve<WorldAnswer>({ status, body, retryAfter: null });

test('the server version published with this app is the server package’s own', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../server/package.json'), 'utf8')) as { version: string };
  expect(SERVER_RELEASE).toBe(pkg.version);
});

test('takes the server’s description in each shape it gives, and refuses any other', async () => {
  const shapes = [
    { ...base, storage: 'memory' },
    archived,
    tested,
    { ...tested, archiving: 'failing', restore: { day: '2026-12-01', result: 'failed' } },
    { ...tested, archiving: 'waiting', restore: null },
    { ...base, storage: 'postgresql', database: 'ok', archive: 'off' },
    { ...base, fingerprint: null, storage: 'postgresql', database: 'failing' },
  ];
  for (const shape of shapes) expect(systemView(shape)).toEqual(shape);
  for (const odd of [
    null,
    [],
    { ...base, storage: 'disk' },
    { ...base, storage: 'memory', database: 'ok' },
    { ...base, storage: 'postgresql', database: 'ok' },
    { ...base, storage: 'postgresql', database: 'failing', archive: 'on' },
    { ...archived, version: 'latest' },
    { ...archived, fingerprint: 'AB'.repeat(32) },
    { ...archived, parts: ['gateway', 'mirror'] },
    { ...archived, parts: ['relay', 'relay'] },
    { ...archived, world: 'AAAAA' },
    { ...archived, archiving: 'ok' },
    { ...archived, restore: null },
    { ...tested, archiving: 'late' },
    { ...tested, restore: undefined },
    { ...tested, restore: [] },
    { ...tested, restore: 'passed' },
    { ...tested, restore: { day: '2026-12-01' } },
    { ...tested, restore: { day: '2026-13-01', result: 'passed' } },
    { ...tested, restore: { day: '2026-12-01', result: 'unknown' } },
    { ...tested, restore: { day: '2026-12-01', result: 'passed', step: 'fetch' } },
    { ...tested, archive: 'off' },
    { ...tested, world: 'AAAAA' },
    { ...base, storage: 'postgresql', database: 'failing', archiving: 'ok', restore: null },
  ])
    expect(systemView(odd)).toBeNull();
  await expect(readSystem('AAAAA', answer(200, archived))).resolves.toEqual(archived);
  const failing = { ...base, storage: 'postgresql', database: 'failing' };
  await expect(readSystem('AAAAA', answer(503, failing))).resolves.toEqual(failing);
  await expect(readSystem('AAAAA', answer(200, failing))).resolves.toEqual(failing);
  await expect(readSystem('AAAAA', answer(503, archived))).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  await expect(readSystem('AAAAA', answer(200, { ...archived, storage: 'disk' }))).rejects.toMatchObject({
    code: 'E_WORLD_SERVER',
  });
  await expect(readSystem('AAAAA', answer(429, null))).rejects.toMatchObject({ code: 'E_WORLD_BUSY' });
  await expect(readSystem('AAAAA', answer(404, NO_WORLD))).rejects.toMatchObject({ code: 'E_NO_SUCH_WORLD' });
  await expect(readSystem('AAAAA', answer(404, { message: 'Cannot GET' }))).rejects.toMatchObject({
    code: 'E_WORLD_SERVER',
  });
});

test('asks through the world for its own path', async () => {
  const send = jest.fn(answer(200, archived));
  await readSystem('AAAAA', send);
  expect(send).toHaveBeenCalledWith({ method: 'GET', path: '/worlds/AAAAA/admin/system' });
});

test('draws only what the server says, the backups while the database archives', () => {
  const inner = ['devices', 'gateway', 'relay', 'totals', 'standins', 'observatory', 'storage', 'screens'];
  expect(opsBoxes(archived)).toEqual([...inner, 'backups', 'outside']);
  expect(opsBoxes({ ...archived, archive: 'off' })).toEqual([...inner, 'outside']);
  expect(opsBoxes({ ...base, storage: 'postgresql', database: 'failing' })).toEqual([...inner, 'outside']);
  expect(opsBoxes({ ...base, parts: ['gateway', 'relay'], storage: 'memory' })).toEqual([
    'devices',
    'gateway',
    'relay',
    'storage',
    'outside',
  ]);
});

test('writes every box and line out with its rows, the line to outside closed, mirrored left to right', () => {
  const map = opsMap(t, archived, true);
  expect(map.spec.label).toBe(words.map);
  expect(map.spec.nodes.map((one) => one.id)).toEqual(map.boxes.map((one) => one.id));
  expect(map.spec.links.map((one) => [one.from, one.to])).toEqual([
    ['devices', 'gateway'],
    ['gateway', 'devices'],
    ['gateway', 'relay'],
    ['gateway', 'totals'],
    ['totals', 'screens'],
    ['gateway', 'standins'],
    ['gateway', 'observatory'],
    ['observatory', 'devices'],
    ['relay', 'storage'],
    ['totals', 'storage'],
    ['standins', 'storage'],
    ['observatory', 'storage'],
    ['storage', 'backups'],
    ['gateway', 'outside'],
  ]);
  expect(map.spec.links.filter((one) => one.idle === true).map((one) => one.label)).toEqual([words.line.closed]);
  for (const item of [...map.boxes, ...map.lines]) {
    expect(typeof item.label).toBe('string');
    for (const row of item.rows) expect(typeof row.value).toBe('string');
  }
  for (const box of map.boxes) expect([typeof box.sub, typeof box.note]).toEqual(['string', 'string']);
  expect(map.boxes.find((one) => one.id === 'observatory')!.note).toBe(words.note.observatory);
  const relay = map.boxes.find((one) => one.id === 'relay')!;
  expect(relay).toEqual({
    id: 'relay',
    label: words.box.relay,
    sub: words.sub.relay,
    rows: [
      { key: 'holds', label: words.row.holds, value: words.facts.relay.holds },
      { key: 'sees', label: words.row.sees, value: words.facts.relay.sees },
      { key: 'never', label: words.row.never, value: words.facts.relay.never },
    ],
    note: words.note.relay,
  });
  expect(map.boxes.find((one) => one.id === 'storage')!.sub).toBe(words.sub.storage.postgresql);
  expect(map.lines.find((one) => one.id === 'line.copies')!.rows).toEqual([
    { key: 'carries', label: words.row.carries, value: words.facts.line.copies.carries },
    { key: 'sees', label: words.row.sees, value: words.facts.line.copies.sees },
  ]);
  const memory = opsMap(t, { ...base, storage: 'memory' }, true);
  expect(memory.boxes.find((one) => one.id === 'storage')!.note).toBe(words.note.storage.memory);
  expect(memory.lines.map((one) => one.id)).not.toContain('line.copies');
  const older = opsMap(t, { ...archived, parts: PARTS.filter((part) => part !== 'observatory') }, true);
  expect(older.boxes.map((one) => one.id)).not.toContain('observatory');
  expect(older.lines.map((one) => one.id)).not.toContain('line.sendings');
  const ltr = opsMap(t, archived, false);
  const at = (spec: typeof map.spec, id: string) => spec.nodes.find((one) => one.id === id)!.x;
  expect([at(map.spec, 'totals'), at(ltr.spec, 'totals')]).toEqual([13, 525]);
  expect(at(ltr.spec, 'relay')).toBe(at(map.spec, 'relay'));
});

test('the console’s words have the same keys and placeholders in every language, plural forms aside', () => {
  const plural = /_(zero|one|two|few|many|other)$/u;
  const places = (value: unknown): unknown =>
    typeof value === 'string'
      ? (value.match(/\{\{\w+\}\}/gu) ?? []).sort()
      : Object.entries(value as object)
          .filter(([key]) => !plural.test(key))
          .map(([key, one]) => [key, places(one)]);
  for (const one of [en, fr]) expect(places(one.demo.ops)).toEqual(places(ar.demo.ops));
});

test('writes a fingerprint in groups of four', () => {
  expect(fingerprintText('0123456789abcdef')).toBe('0123 4567 89ab cdef');
  expect(fingerprintText(FINGERPRINT).split(' ')).toHaveLength(16);
});
