// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A restore at setup (#247, answer 478): a backup read under the recovery
// key, typed in any case and with spaces, and only with a password; an export
// under its own, or none; the restored history stored whole, with the device
// layer erased on the restore day, the personal fields and the key gone; and
// each refusal told apart, nothing stored. Made-up records only.

import { ARCHIVE_FILE, archiveOf, archiveText, eventOf, parseDay } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { FakeStorage } from '../jest/fake-storage';
import { withPupils } from '../jest/roll-class';
import { bundledReference, readReference } from '../src/reference';
import { restoreFile, zipProblem, type RestoreInput } from '../src/restore/restore-run';
import { nativeDeps, openRecordBook } from '../src/storage/history';

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const DAY = parseDay('2026-10-15');
const RESTORED = parseDay('2026-11-02');
const reference = readReference(bundledReference);
const COUNTRY = reference.ok ? reference.profile.code : '';

/** The made-up class with a private note, the teacher's personal fields and a recovery key, as a backup's text. */
async function backup(change: (text: string) => string = (text) => text) {
  const data: TestData = await withPupils();
  await data.book.recordAll(DAY, [
    { kind: 'teacher.personal.set', personal: { name: 'اسم شخصي (مثال)', signatureOn: false } },
    { kind: 'session.noted', note: { sessionKey: 'made-up-session', note: 'ملاحظة خاصة (مثال)' } },
    { kind: 'recovery.set', recovery: { key: KEY } },
  ]);
  const archive = archiveOf(data.book.entries, data.book.state, {
    made: DAY,
    app: '0.5.0',
    country: data.profile.code,
    calendarRelease: data.calendarRelease,
    privateNotes: true,
    bundledPacks: data.packs,
  });
  return { data, text: change(archiveText(archive)) };
}

function run(text: string | Error, input: Partial<RestoreInput> = {}, target = FakeStorage.unlocked()) {
  const readZip = jest.fn<Promise<string>, [string, string, string, boolean]>(() =>
    text instanceof Error ? Promise.reject(text) : Promise.resolve(text),
  );
  const spec = target.asSpec();
  const result = restoreFile(
    { route: 'backup', token: '0011223344556677', secret: KEY, country: COUNTRY, day: RESTORED, ...input },
    { files: { readZip }, storage: spec, deps: nativeDeps(spec) },
  );
  return { result, readZip, target };
}

const refusal = (code: string) => Object.assign(new Error('The archive was refused'), { code });

test('restores a backup whole, with the device layer erased on the restore day', async () => {
  const { data, text } = await backup();
  const { result, readZip, target } = run(text, { secret: ` ${KEY.toLowerCase().replace(/(.{4})/g, '$1 ')}` });
  await expect(result).resolves.toEqual({ ok: true });
  expect(readZip).toHaveBeenCalledWith('0011223344556677', ARCHIVE_FILE, KEY, true);
  const book = await openRecordBook(target.asSpec());
  expect(book.entries).toHaveLength(data.book.entries.length + 1);
  expect(book.entries.at(-1)?.day).toBe(RESTORED);
  expect(book.state.pupils.size).toBe(data.book.state.pupils.size);
  expect(book.state.classes.size).toBe(data.book.state.classes.size);
  const stored = JSON.stringify(target.rows);
  expect(stored).toContain('ملاحظة خاصة (مثال)');
  expect(stored).not.toContain('اسم شخصي (مثال)');
  expect(stored).not.toContain(KEY);
  expect(book.entries.some((entry) => eventOf(entry)?.kind === 'recovery.set')).toBe(false);
});

test('opens an export under its password, or none, without asking for one', async () => {
  const { text } = await backup();
  const plain = run(text, { route: 'archive', secret: '' });
  await expect(plain.result).resolves.toEqual({ ok: true });
  expect(plain.readZip).toHaveBeenCalledWith('0011223344556677', ARCHIVE_FILE, '', false);
  const locked = run(text, { route: 'archive', secret: 'mot de passe 1' });
  await expect(locked.result).resolves.toEqual({ ok: true });
  expect(locked.readZip).toHaveBeenCalledWith('0011223344556677', ARCHIVE_FILE, 'mot de passe 1', false);
});

test('a key not shaped as one is refused before the file is read', async () => {
  const { result, readZip } = run('{}', { secret: KEY.slice(0, 20) });
  await expect(result).resolves.toEqual({ ok: false, problem: 'key-form' });
  expect(readZip).not.toHaveBeenCalled();
});

test('tells each refusal of the ZIP apart, by route', () => {
  expect(zipProblem('E_ZIP_PASSWORD', { route: 'backup', secret: KEY })).toBe('key');
  expect(zipProblem('E_ZIP_PASSWORD', { route: 'archive', secret: '' })).toBe('password-needed');
  expect(zipProblem('E_ZIP_PASSWORD', { route: 'archive', secret: 'x' })).toBe('password');
  expect(zipProblem('E_ZIP_CHANGED', { route: 'backup', secret: KEY })).toBe('changed');
  expect(zipProblem('E_ZIP_NOT_ARCHIVE', { route: 'backup', secret: KEY })).toBe('not-archive');
  expect(zipProblem('E_ZIP_TOO_LARGE', { route: 'archive', secret: '' })).toBe('too-large');
  expect(zipProblem('E_ZIP_PLAIN', { route: 'backup', secret: KEY })).toBe('plain');
  expect(zipProblem('E_FILE', { route: 'backup', secret: KEY })).toBe('unreadable');
  expect(zipProblem(undefined, { route: 'backup', secret: KEY })).toBe('unreadable');
});

test.each([
  ['a refusal of the ZIP', () => Promise.resolve(refusal('E_ZIP_PLAIN')), 'plain'],
  ['text that is not an archive', () => Promise.resolve('{"format":"other"}'), 'not-archive'],
  [
    'a later major version',
    () => backup((text) => text.replace('"major":1', '"major":2')).then(({ text }) => text),
    'version',
  ],
  [
    'an entry changed after it was saved',
    () => backup((text) => text.replace('ملاحظة خاصة (مثال)', 'ملاحظة أخرى (مثال)')).then(({ text }) => text),
    'changed',
  ],
] as const)('stores nothing from %s', async (_name, made, problem) => {
  const { result, target } = run(await made());
  await expect(result).resolves.toEqual({ ok: false, problem });
  expect(target.rows).toEqual([]);
});

test('refuses an archive from another country, and a history that is not empty', async () => {
  const { text } = await backup();
  const abroad = run(text, { country: `${COUNTRY}-other` });
  await expect(abroad.result).resolves.toEqual({ ok: false, problem: 'country' });
  expect(abroad.target.rows).toEqual([]);
  const used = FakeStorage.unlocked();
  await (await openRecordBook(used.asSpec())).recordAll(DAY, [{ kind: 'setup.finished' }]);
  const kept = JSON.stringify(used.rows);
  const busy = run(text, {}, used);
  await expect(busy.result).resolves.toEqual({ ok: false, problem: 'failed' });
  expect(JSON.stringify(used.rows)).toBe(kept);
});
