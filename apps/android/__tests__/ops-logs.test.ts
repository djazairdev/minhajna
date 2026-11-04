// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators' log pages read of the demo server (#619, answer 656): the
// admin log's lines in each shape the server gives, an action the app does not
// know, or a known one with a detail it does not read, kept as one it does not
// know, and a line without its day, action or detail object refused; the
// security log's days with every kind counted, the kinds it does not know
// counted together, and refused otherwise; each asked through the world for its
// own path, a refused or odd answer thrown as the world's problem, a world that
// is gone as erased; and the log pages' counts in each language's own plural
// forms, each with its count where the language writes it.

import type { WorldAnswer } from '../src/network/world-network';
import { adminLine, readAdminLog, readSecurity, securityDay } from '../src/operators/ops-logs';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

const NO_WORLD = { statusCode: 404, message: 'no world has this id and pass' };
const UNKNOWN = { statusCode: 404, message: 'Cannot GET /worlds/AAAAA/admin/log' };
const answer = (status: number, body: unknown) => () =>
  Promise.resolve<WorldAnswer>({ status, body, retryAfter: null });
const ID = '0123456789abcdef'.repeat(2);
const started = { day: '2026-12-01', action: 'server.started', detail: { version: '0.1.0', fingerprint: 'none' } };
const counts = {
  'rate-limited': 3,
  'pass-refused': 0,
  'starter-refused': 1,
  'certificate-refused': 0,
  'delivery-refused': 2,
};

test('takes the admin log’s lines in each shape, an odd one as an unknown action, and refuses others', () => {
  expect(adminLine(started)).toEqual({ day: '2026-12-01', action: 'server.started', version: '0.1.0', migrations: [] });
  const applied = { ...started, detail: { ...started.detail, migrations: ['0005_admin'] } };
  expect(adminLine(applied)).toMatchObject({ migrations: ['0005_admin'] });
  expect(adminLine({ day: '2026-12-02', action: 'worlds.erased', detail: { count: 2 } })).toEqual({
    day: '2026-12-02',
    action: 'worlds.erased',
    count: 2,
  });
  expect(adminLine({ day: '2026-12-02', action: 'problem.fixed', detail: { problem: ID } })).toEqual({
    day: '2026-12-02',
    action: 'problem.fixed',
    problem: ID,
  });
  const restore = (detail: object) => adminLine({ day: '2026-12-03', action: 'restore.tested', detail });
  expect(restore({ result: 'passed' })).toEqual({ day: '2026-12-03', action: 'restore.tested', outcome: 'passed' });
  for (const step of ['room', 'fetch', 'recover', 'check'])
    expect(restore({ result: 'failed', step })).toEqual({ day: '2026-12-03', action: 'restore.tested', outcome: step });
  for (const odd of [
    { result: 'passed', step: 'fetch' },
    { result: 'failed' },
    { result: 'failed', step: 'disk' },
    { result: 'failed', step: 'passed' },
  ])
    expect(restore(odd)).toEqual({ day: '2026-12-03', action: 'other' });
  expect(adminLine({ day: '2026-12-03', action: 'restore.tested', detail: {} })).toEqual({
    day: '2026-12-03',
    action: 'other',
  });
  for (const odd of [
    { ...started, detail: {} },
    { ...started, detail: { version: '0.1.0\u0007' } },
    { ...started, detail: { version: '0.1.0', migrations: 'all' } },
    { ...started, detail: { version: '0.1.0', migrations: [''] } },
    { day: '2026-12-02', action: 'worlds.erased', detail: { count: -1 } },
    { day: '2026-12-02', action: 'worlds.erased', detail: { count: 1.5 } },
    { day: '2026-12-02', action: 'problem.fixed', detail: {} },
    { day: '2026-12-02', action: 'problem.fixed', detail: { problem: 'ABCDEF' } },
  ])
    expect(adminLine(odd)).toEqual({ day: odd.day, action: 'other' });
  for (const odd of [
    null,
    [],
    { ...started, day: '2026-13-01' },
    { ...started, detail: null },
    { day: '2026-12-02', action: 7, detail: {} },
    { day: '2026-12-02', detail: {} },
  ])
    expect(adminLine(odd)).toBeNull();
});

test('takes a security day with every kind counted, the unknown kinds together, and refuses others', () => {
  expect(securityDay({ day: '2026-12-01', counts })).toEqual({ day: '2026-12-01', counts, others: 0 });
  expect(securityDay({ day: '2026-12-01', counts: { ...counts, extra: 9, newer: 1 } })).toEqual({
    day: '2026-12-01',
    counts,
    others: 10,
  });
  const { 'pass-refused': missing, ...fewer } = counts;
  expect(missing).toBe(0);
  for (const odd of [
    null,
    { day: '2026-12-01', counts: fewer },
    { day: '2026-12-01', counts: { ...counts, extra: -1 } },
    { day: '2026-12-01' },
    { day: 'today', counts },
    { day: '2026-12-01', counts: { ...counts, 'pass-refused': undefined } },
    { day: '2026-12-01', counts: { ...counts, 'rate-limited': -1 } },
    { day: '2026-12-01', counts: { ...counts, 'rate-limited': '3' } },
  ])
    expect(securityDay(odd)).toBeNull();
});

test('reads each log through the world for its own path, and throws a refused or odd answer', async () => {
  const send = jest.fn(answer(200, { lines: [started] }));
  await expect(readAdminLog('AAAAA', send)).resolves.toHaveLength(1);
  expect(send).toHaveBeenCalledWith({ method: 'GET', path: '/worlds/AAAAA/admin/log' });
  await expect(readAdminLog('AAAAA', answer(200, { lines: [started, { day: 'x' }] }))).rejects.toMatchObject({
    code: 'E_WORLD_SERVER',
  });
  await expect(readAdminLog('AAAAA', answer(200, {}))).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  await expect(readAdminLog('AAAAA', answer(429, null))).rejects.toMatchObject({ code: 'E_WORLD_BUSY' });
  await expect(readAdminLog('AAAAA', answer(404, NO_WORLD))).rejects.toMatchObject({ code: 'E_NO_SUCH_WORLD' });
  await expect(readSecurity('AAAAA', answer(404, NO_WORLD))).rejects.toMatchObject({ code: 'E_NO_SUCH_WORLD' });
  await expect(readAdminLog('AAAAA', answer(404, UNKNOWN))).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  const days = { keptDays: 7, days: [{ day: '2026-12-01', counts }] };
  const security = jest.fn(answer(200, days));
  await expect(readSecurity('AAAAA', security)).resolves.toEqual({
    keptDays: 7,
    days: [{ day: '2026-12-01', counts, others: 0 }],
  });
  expect(security).toHaveBeenCalledWith({ method: 'GET', path: '/worlds/AAAAA/admin/security' });
  for (const odd of [{ days: [] }, { keptDays: -1, days: [] }, { keptDays: 7, days: [{ day: '2026-12-01' }] }])
    await expect(readSecurity('AAAAA', answer(200, odd))).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  await expect(readSecurity('AAAAA', answer(503, days))).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
});

test('the log pages’ counts are written in each language’s own plural forms', () => {
  const forms = (value: object, base: string) =>
    Object.keys(value)
      .filter((key) => key.startsWith(`${base}_`))
      .map((key) => key.slice(base.length + 1));
  for (const [words, base] of [
    ['admin', 'erased'],
    ['security', 'kept'],
  ] as const) {
    expect(forms(ar.demo.ops[words], base)).toEqual(['zero', 'one', 'two', 'few', 'many', 'other']);
    expect(forms(fr.demo.ops[words], base)).toEqual(['one', 'many', 'other']);
    expect(forms(en.demo.ops[words], base)).toEqual(['one', 'other']);
    const counted = (value: object, names: readonly string[]) =>
      names.map((name) => (value as Record<string, string>)[`${base}_${name}`].includes('{{count}}'));
    expect(counted(ar.demo.ops[words], ['few', 'many', 'other'])).toEqual([true, true, true]);
    expect(counted(fr.demo.ops[words], ['one', 'many', 'other'])).toEqual([true, true, true]);
    expect(counted(en.demo.ops[words], ['one', 'other'])).toEqual([true, true]);
  }
});
