// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «بيان التقدّم» (#438, Share, answer 485): every field of the statement in
// words, the subject's other classes with a plan as chips, nothing signed or
// logged before a print or a save, then a page signed with the teacher's key at
// that moment, as of that moment's day, carrying its fingerprint, the legal
// line, the signed text's QR code and its link, unmarked, and logged with the
// day; a PDF named by the class, subject and day; a cancelled save and a failed
// signature neither said as saved nor logged; and every text found in each
// language. Made-up records only: 1م1 and 1م2 on the example mathematics pack,
// 1م3 with none.

import {
  confirmSessions,
  eventOf,
  linkedStatement,
  parseDay,
  progressStatement,
  statementLink,
  statementPayload,
  todayView,
  type RecordEvent,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { context, mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { withTd } from '../jest/td-class';
import pdf from '../src/native/NativeMinhajnaPdf';
import { AppDataProvider } from '../src/storage/AppData';
import { nativeDeps } from '../src/storage/history';
import signature from '../src/native/NativeMinhajnaSignature';
import { gradeName } from '../src/setup/names';
import { StatementShare } from '../src/sharing/StatementShare';
import { groupedFingerprint, qrSvg, statementHtml } from '../src/sharing/statement-page';
import { teacherKeyFingerprint } from '../src/sharing/teacher-key';
import { statementLines } from '../src/sharing/statement-lines';
import { i18n, missingKeys } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const DAY = parseDay('2026-10-15');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const savePdf = jest.spyOn(pdf, 'savePdf');
const sign = jest.spyOn(signature, 'sign');
const qrMatrix = jest.spyOn(signature, 'qrMatrix');

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const klass = (id: string, name: string): RecordEvent => ({
  kind: 'class.set',
  schoolClass: {
    id,
    schoolId: 's-1',
    level: 'cem',
    grade: '1am',
    name,
    groups: [{ id: `${id}-w`, kind: 'whole', name }],
  },
});
const course = (id: string, classId: string, pack: boolean): RecordEvent => ({
  kind: 'course.set',
  course: {
    id,
    classId,
    subject: 'math',
    year: '2026-2027',
    pack: pack ? { id: 'dz.cem.1am.math.example', release: '2026.1' } : null,
  },
});

/** 1\u06451 with its Thursday lesson confirmed, 1\u06452 on the same pack, and 1\u06453 with no plan. */
async function classes(): Promise<TestData> {
  const data = await withTd(false, true);
  await data.book.recordAll(DAY, [
    klass('k-n', '1\u06452'),
    course('c-n', 'k-n', true),
    klass('k-o', '1\u06453'),
    course('c-o', 'k-o', false),
  ]);
  const lesson = todayView(context(data), DAY).sessions.find((one) => one.session.courseId === 'c-m');
  await data.book.recordAll(DAY, confirmSessions(context(data), [{ session: lesson!.session }]));
  return data;
}

const outputs = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event: RecordEvent | null = eventOf(entry);
    return event?.kind === 'output.recorded' ? [[event.output.document, event.output.period, event.output.how]] : [];
  });
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const field = (id: string) =>
  root().findAll((node) => node.props.testID === `statement-${id}` && node.props.accessibilityLabel !== undefined)[0]
    ?.props.accessibilityLabel as string;

/** A catalogue text with its placeholders filled in. */
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key]));
const MATH = '\u0627\u0644\u0631\u064a\u0627\u0636\u064a\u0627\u062a';
const FIRST = '1\u06451';

test('every field shows, with chips for the classes with a plan, and nothing is signed yet', async () => {
  const data = await classes();
  const onCourse = jest.fn();
  await mount(data, <StatementShare courseId="c-m" onCourse={onCourse} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      `\u2068${FIRST}\u2069 \u00b7 ${MATH} \u00b7 ${gradeName(data.profile, '1am')} \u00b7 \u20682026-2027\u2069`,
      text.statement.reasons,
      text.statement.signed,
    ]),
  );
  expect(field('unit')).toBe(`${text.statement.unit}. ${text.statement.noUnit}`);
  expect(field('resource')).toBe(`${text.statement.resource}. ${text.statement.noResource}`);
  expect(field('delay')).toBe(`${text.statement.delay}. ${text.statement.noDelay}`);
  expect(field('notHeld')).toBe(`${text.statement.notHeld}. ${fill(text.statement.losses, { calendar: 0, other: 0 })}`);
  expect(field('pack')).toContain('\u2068dz.cem.1am.math.example \u00b7 2026.1\u2069');
  const chips = root().findByProps({ testID: 'statement-classes' }).props as {
    choices: { value: string }[];
    onSelect: (value: string) => void;
  };
  expect(chips.choices.map((one) => one.value)).toEqual(['c-m', 'c-n']);
  chips.onSelect('c-n');
  expect(onCourse).toHaveBeenCalledWith('c-n');
  expect(sign).not.toHaveBeenCalled();
  expect(outputs(data)).toEqual([]);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('a print is signed then, with the fingerprint, the legal line, the code and the link, unmarked', async () => {
  const data = await classes();
  await mount(data, <StatementShare courseId="c-m" onCourse={jest.fn()} />);
  const statement = progressStatement(context(data), 'c-m', DAY)!;
  await press('statement-print');
  expect(sign).toHaveBeenCalledTimes(1);
  expect(sign).toHaveBeenCalledWith(statementPayload(statement));
  const signed = qrMatrix.mock.calls[0][0];
  const envelope = JSON.parse(signed) as { payload: string; spki: string; signature: string };
  expect(envelope.payload).toBe(statementPayload(statement));
  await expect(signature.verify(envelope.spki, envelope.payload, envelope.signature)).resolves.toBe(true);
  const [html, title, landscape] = printHtml.mock.calls[0];
  expect([title, landscape]).toEqual([text.statement.title, false]);
  expect(html).toContain(
    `<bdi class="key" dir="ltr">${groupedFingerprint(await teacherKeyFingerprint(envelope.spki))}</bdi>`,
  );
  expect(html).toContain(text.statement.page.signed);
  expect(html).toContain(text.statement.page.code);
  expect(html).toContain('<svg class="qr"');
  expect(html).toContain(`<a href="${statementLink(signed)}">`);
  expect(linkedStatement(statementLink(signed))).toBe(signed);
  expect(html).not.toContain(text.documents.confidential);
  expect(outputs(data)).toEqual([['statement', '2026-10-15', 'print']]);
  expect(has('statement-said')).toBe(false);
});

test('a PDF is named by the class, subject and day; a cancelled save is neither said nor logged', async () => {
  const data = await classes();
  await mount(data, <StatementShare courseId="c-m" onCourse={jest.fn()} />);
  savePdf.mockResolvedValueOnce(false);
  await press('statement-pdf');
  expect(outputs(data)).toEqual([]);
  expect(has('statement-said')).toBe(false);
  await press('statement-pdf');
  expect(makePdf).toHaveBeenCalledWith(expect.stringContaining('<svg class="qr"'), 'statement', false);
  expect(savePdf).toHaveBeenLastCalledWith('statement', `${text.statement.title} ${FIRST} ${MATH} 2026-10-15.pdf`);
  expect(sign).toHaveBeenCalledTimes(2);
  expect(outputs(data)).toEqual([['statement', '2026-10-15', 'pdf']]);
  expect(texts()).toContain(text.documents.output.saved);
});

test('the statement leaves as of the day of the tap, though the screen opened the day before', async () => {
  const data = await classes();
  let day = '2026-10-15';
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <AppDataProvider {...data} random={nativeDeps(data.storage.asSpec()).random} today={() => parseDay(day)}>
          <StatementShare courseId="c-m" onCourse={jest.fn()} />
        </AppDataProvider>
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
  day = '2026-10-16';
  await ReactTestRenderer.act(async () => {
    const [pdfButton] = tree!.root.findAll(
      (node) => node.props.testID === 'statement-pdf' && typeof (node.props as PressableProps).onPress === 'function',
    );
    (pdfButton?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
  expect(sign).toHaveBeenCalledWith(statementPayload(progressStatement(context(data), 'c-m', parseDay(day))!));
  expect(savePdf).toHaveBeenLastCalledWith('statement', expect.stringMatching(/ 2026-10-16\.pdf$/));
  expect(outputs(data)).toEqual([['statement', '2026-10-16', 'pdf']]);
  await ReactTestRenderer.act(() => tree?.unmount());
});

test('a statement that cannot be signed makes nothing and says so', async () => {
  const data = await classes();
  await mount(data, <StatementShare courseId="c-m" onCourse={jest.fn()} />);
  sign.mockRejectedValueOnce(new Error('Keystore unavailable'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await press('statement-print');
  expect(printHtml).not.toHaveBeenCalled();
  expect(outputs(data)).toEqual([]);
  expect(texts()).toContain(text.statement.failed);
  warn.mockRestore();
});

test('a class with no plan has no statement', async () => {
  await mount(await classes(), <StatementShare courseId="c-o" onCourse={jest.fn()} />);
  expect(texts()).toContain(text.statement.none);
  expect(has('statement-print')).toBe(false);
});

test('fields in words: weeks behind, buffers, TD, a finished resource and an own list', async () => {
  const data = await classes();
  const statement = {
    ...progressStatement(context(data), 'c-m', DAY)!,
    pack: { id: 'dz.cem.1am.math.own', release: 'own' },
    lastUnit: { id: 'u1', title: 'Unit A (example)' },
    lastResource: { id: 'u1-3', title: 'Lesson A.3 (example)', status: 'done' as const },
    delay: { sessions: 5, weeks: 2, bufferUsed: 2, bufferLeft: 1 },
    notHeld: { calendar: 3, other: 4 },
    td: { calendar: 1, other: 2 },
  };
  const t = i18n.t.bind(i18n) as Parameters<typeof statementLines>[0];
  const buffer = fill(text.statement.buffer, { used: text.count.sessions_two, left: text.count.sessions_one });
  expect(statementLines(t, data.profile, statement).map((one) => [one.id, one.lines])).toEqual([
    ['unit', ['\u2068Unit A (example)\u2069']],
    ['resource', ['\u2068Lesson A.3 (example)\u2069', text.statement.done]],
    ['delay', [`${text.count.weeks_two} \u00b7 ${fill(text.count.sessions_few, { count: 5 })}`, buffer]],
    [
      'notHeld',
      [fill(text.statement.losses, { calendar: 3, other: 4 }), fill(text.statement.td, { calendar: 1, other: 2 })],
    ],
    ['pack', [expect.any(String), text.statement.ownList]],
  ]);
});

test('the code is drawn one black run at a time, and a statement too long for one code says so', () => {
  expect(qrSvg({ size: 3, rows: ['110', '000', '011'] })).toContain('d="M0 0h2v1h-2zM1 2h2v1h-2z"');
  expect(groupedFingerprint('0123456789abcdef')).toBe('0123 4567 89ab cdef');
  const t = i18n.t.bind(i18n) as Parameters<typeof statementHtml>[0];
  const sheet = {
    day: '15/10/2026',
    className: FIRST,
    lines: [],
    text: '{}',
    fingerprint: '0123456789abcdef',
    qr: null,
  };
  const html = statementHtml(t, sheet, 'ar', 'rtl');
  expect(html).toContain(text.statement.page.tooLong);
  expect(html).not.toContain('<svg');
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  await mount(await classes(), <StatementShare courseId="c-m" onCourse={jest.fn()} />);
  await press('statement-print', 'statement-pdf');
  expect(missingKeys).toEqual([]);
});
