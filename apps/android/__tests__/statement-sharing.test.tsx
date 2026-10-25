// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sharing a progress statement (#439, Share-qr, Share-to, answer 486): after a
// share, «لمن؟» takes a role or nothing, and «سجل المشاركة» shows it, newest
// first, a row opening the sheet again while the history keeps the earlier
// role; the QR code shows large with the screen kept on, and asks «لمن؟» once
// closed; a statement too long for one code leaves as a signed file through
// the share menu; the activity log names each share and role; Settings opens
// the first class with a plan; and every text is found in each language.
// Made-up records only.

import { activityLog, checkStatement, eventOf, sharingHistory, type RecordEvent } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { statementClasses } from '../jest/statement-classes';
import { lineText } from '../src/log/log-text';
import files from '../src/native/NativeMinhajnaFiles';
import screen from '../src/native/NativeMinhajnaInterface';
import signature from '../src/native/NativeMinhajnaSignature';
import { Settings } from '../src/settings/Settings';
import { StatementShare } from '../src/sharing/StatementShare';
import { i18n, missingKeys } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const keepScreenOn = jest.spyOn(screen, 'keepScreenOn');
const makeText = jest.spyOn(files, 'makeText');
const shareFile = jest.spyOn(files, 'shareFile');
const qrMatrix = jest.spyOn(signature, 'qrMatrix');
const signed = async (statement: string) =>
  (await checkStatement(statement, (key, payload, mark) => signature.verify(key, payload, mark))).ok;

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const FIRST = '1\u06451';
const shareScreen = (courseId = 'c-m') => <StatementShare courseId={courseId} onCourse={jest.fn()} />;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const shares = (data: TestData) => sharingHistory(data.book.entries).map((one) => [one.how, one.to]);
const roles = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event: RecordEvent | null = eventOf(entry);
    return event?.kind === 'statement.sent' ? [event.sent.to] : [];
  });
async function choose(role: string) {
  await ReactTestRenderer.act(async () => {
    (root().findByProps({ testID: 'statement-to-roles' }).props as { onSelect: (value: string) => void }).onSelect(
      role,
    );
    await settle();
  });
}

test('after a print, \u00ab\u0644\u0645\u0646\u061f\u00bb keeps a role, and the history shows it', async () => {
  const data = await statementClasses();
  await mount(data, shareScreen());
  expect(texts()).toContain(text.statement.historyNone);
  await press('statement-print');
  expect(root().findByProps({ testID: 'statement-to' }).props.visible).toBe(true);
  expect(texts()).toContain(
    `\u0628\u064a\u0627\u0646 \u2068${FIRST}\u2069 \u00b7 ${text.statement.how.print} \u00b7 15/10/2026`,
  );
  await choose('director');
  await press('statement-to-save');
  expect(root().findByProps({ testID: 'statement-to' }).props.visible).toBe(false);
  expect(shares(data)).toEqual([['print', 'director']]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      `15/10/2026 \u00b7 \u2068${FIRST}\u2069 \u00b7 ${text.statement.how.print}`,
      text.statement.to.director,
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
});

test('\u00ab\u0644\u0627\u062d\u0642\u0627\u064b\u00bb keeps no role; a row sets one later', async () => {
  const data = await statementClasses();
  await mount(data, shareScreen());
  await press('statement-pdf', 'statement-to-later');
  expect(shares(data)).toEqual([['pdf', null]]);
  expect(texts()).toContain(text.statement.noRecipient);
  const [share] = sharingHistory(data.book.entries);
  for (const role of ['inspector', 'coordinator']) {
    await press(`statement-share-${share.id}`);
    await choose(role);
    await press('statement-to-save');
  }
  expect(shares(data)).toEqual([['pdf', 'coordinator']]);
  expect(roles(data)).toEqual(['inspector', 'coordinator']);
  await press(`statement-share-${share.id}`, 'statement-to-save');
  expect(roles(data)).toEqual(['inspector', 'coordinator']);
});

test('the QR code shows with the screen kept on, then asks \u00ab\u0644\u0645\u0646\u061f\u00bb', async () => {
  const data = await statementClasses();
  await mount(data, shareScreen());
  expect(has('statement-file')).toBe(false);
  await press('statement-qr-show');
  const [code] = qrMatrix.mock.calls.at(-1)!;
  expect(await signed(code)).toBe(true);
  expect(has('statement-qr-code')).toBe(true);
  const labels = root()
    .findAll((node) => node.props.testID === 'statement-qr-code')
    .map((node) => node.props.accessibilityLabel as unknown);
  expect(labels).toContain(text.statement.qrLabel);
  expect(texts()).toEqual(expect.arrayContaining([text.statement.qrLine, text.statement.qrNote]));
  expect(keepScreenOn).toHaveBeenLastCalledWith(true);
  expect(shares(data)).toEqual([['qr', null]]);
  await press('statement-qr-close');
  expect(keepScreenOn).toHaveBeenLastCalledWith(false);
  expect(has('statement-qr-code')).toBe(false);
  expect(root().findByProps({ testID: 'statement-to' }).props.visible).toBe(true);
});

test('a statement too long for one code leaves as a signed file through the share menu', async () => {
  const data = await statementClasses('\u0645'.repeat(120));
  await mount(data, shareScreen());
  expect(has('statement-qr-show')).toBe(false);
  expect(texts()).toContain(text.statement.tooLong);
  await press('statement-file');
  const [file, name, password] = makeText.mock.calls[0];
  expect(await signed(file)).toBe(true);
  expect(name).toMatch(/ 2026-10-15\.json$/);
  expect(password).toBe('');
  expect(shareFile).toHaveBeenCalledWith(await makeText.mock.results[0]?.value, text.statement.title);
  expect(shares(data)).toEqual([['file', null]]);
});

test('the activity log names each share and the role it went to', async () => {
  const data = await statementClasses();
  await mount(data, shareScreen());
  await press('statement-print');
  await choose('other');
  await press('statement-to-save');
  const t = i18n.t.bind(i18n) as Parameters<typeof lineText>[0];
  const names = { state: data.book.state, profile: data.profile, lang: 'ar' as const };
  const lines = activityLog(data.book.entries)
    .flatMap((day) => day.items)
    .filter((item) => item.line.kind === 'shared' || item.line.kind === 'sent')
    .map((item) => lineText(t, names, item.line));
  const head = `${text.statement.title} \u00b7 \u2068${FIRST}\u2069 \u00b7 ${text.statement.how.print}`;
  expect(lines).toEqual([`${head} \u00b7 ${text.statement.to.other}`, head]);
});

test('Settings opens the first class with a plan, this year first, and hides it with none', async () => {
  const onOpen = jest.fn();
  await mount(await statementClasses(), <Settings onOpen={onOpen} />);
  await press('settings-statement');
  expect(onOpen).toHaveBeenCalledWith('statement', 'c-m');
  await unmount();
  const lastYear = await statementClasses();
  const old = lastYear.book.state.courses.get('c-m')!;
  await lastYear.book.recordAll(lastYear.year.from, [{ kind: 'course.set', course: { ...old, year: '2025-2026' } }]);
  await mount(lastYear, <Settings onOpen={onOpen} />);
  await press('settings-statement');
  expect(onOpen).toHaveBeenLastCalledWith('statement', 'c-n');
  await unmount();
  const data = await statementClasses();
  await data.book.recordAll(data.year.from, [
    { kind: 'course.set', course: { ...data.book.state.courses.get('c-m')!, pack: null } },
    { kind: 'course.set', course: { ...data.book.state.courses.get('c-n')!, pack: null } },
  ]);
  await mount(data, <Settings onOpen={onOpen} />);
  expect(has('settings-statement')).toBe(false);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  await mount(await statementClasses(), shareScreen());
  await press('statement-pdf');
  await choose('teacher');
  await press('statement-to-save', 'statement-qr-show', 'statement-qr-close', 'statement-to-later');
  expect(missingKeys).toEqual([]);
});
