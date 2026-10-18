// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The CEM and lycée daily journal (#216, Journal, R-3.8-13, R-3.8-38): a
// session's lines, with its unit, its field when it is not a lesson, the
// resource or «تابع» with the stages left, how it went and the remarks; one
// awaiting confirmation in what confirming it would record; the day's page
// with the times as the book writes them; one journal for all classes or a
// page per class; and the output choosing the day and the layout. Made-up
// records only.

import { courseSetup, parseDay, stageNames, todayView, type SessionRecord } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { documentKind, fileName } from '../src/documents/catalogue';
import { DocumentOutput } from '../src/documents/DocumentOutput';
import type { DocumentData } from '../src/documents/document-data';
import { journalLines, proposedRecord, type JournalNames } from '../src/documents/journal-lines';
import { journalPages } from '../src/documents/journal-pages';
import pdf from '../src/native/NativeMinhajnaPdf';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const printHtml = jest.spyOn(pdf, 'printHtml');
const t = i18n.getFixedT('ar');
const lines = text.documents.journalLines;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

const names: JournalNames = { type: (code) => (code === 'td' ? 'أعمال موجهة' : code), day: () => 'الأحد 18 أكتوبر' };

const documentData = (data: TestData, day = '2026-10-15'): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  packs: data.packs,
  bells: data.bells,
  day: parseDay(day),
  lang: 'ar',
  dir: 'rtl',
});

const record = (fields: Partial<SessionRecord>): SessionRecord => ({
  session: {
    key: 'k',
    courseId: 'c-1',
    groupId: 'k-1-w',
    day: parseDay('2026-10-15'),
    slot: { half: 'morning', index: 1 },
  },
  outcome: 'done',
  sessionType: 'lesson',
  coverage: [],
  ...fields,
});

/** The lines as read, without the marks that isolate the pack's and the teacher's words. */
const said = (made: { label?: string; text: string }[]) =>
  made.map((line) =>
    (line.label === undefined ? line.text : `${line.label}: ${line.text}`).replace(/[\u2068\u2069]/g, ''),
  );

test('an item carried on reads «تابع» with the stages left, under its unit, and the remarks follow', async () => {
  const data = await withDay();
  const pack = courseSetup(coreContext(documentData(data)), 'c-1').pack!;
  const item = pack.items.find((one) => one.id === 'u1-3')!;
  const stages = stageNames(pack, item);
  const made = journalLines(
    t,
    names,
    pack,
    record({
      coverage: [{ op: 'taught', item: 'u1-3', from: 1, to: stages.length }],
      test: 't-1',
      homework: { text: 'Exercice 3 p. 12', due: parseDay('2026-10-18') },
      factual: 'حضر المفتش',
    }),
    false,
  );
  expect(said(made)).toEqual([
    `${lines.sequence}: المقطع 1 (مثال)`,
    `${lines.resource}: تابع: فهم المكتوب 1 (مثال)`,
    ...stages.slice(1).map((name) => `- ${name}`),
    `${lines.how}: ${lines.outcomes.done}`,
    `${lines.remarks}: ${text.entry.bookTest}، Exercice 3 p. 12، يُسلَّم الأحد 18 أكتوبر، حضر المفتش`,
  ]);
});

test('guided work names its field; a skipped item, an earlier lesson and content off the plan read as such', async () => {
  const data = await withDay();
  const pack = courseSetup(coreContext(documentData(data)), 'c-1').pack!;
  const made = journalLines(
    t,
    names,
    pack,
    record({
      outcome: 'skipped',
      sessionType: 'td',
      coverage: [
        { op: 'skipped', item: 'u1-2' },
        { op: 'retaught', item: 'u1-1' },
      ],
      unplanned: 'تمارين إضافية',
    }),
    false,
  );
  expect(said(made)).toEqual([
    `${lines.sequence}: المقطع 1 (مثال)`,
    `${lines.domain}: أعمال موجهة`,
    `${lines.resource}: تُرك: فهم المنطوق 1 (مثال)`,
    `${lines.resource}: إعادة: الوضعية المشكلة الانطلاقية 1 (مثال)`,
    `${lines.resource}: تمارين إضافية`,
    `${lines.how}: ${lines.outcomes.skipped}`,
  ]);
  expect(said(journalLines(t, names, pack, record({ outcome: 'not-held', factual: 'x' }), false))).toEqual([
    `${lines.how}: ${lines.outcomes['not-held']}`,
  ]);
});

test('a session awaiting confirmation shows what confirming it would record, and that it awaits it', async () => {
  const data = await withDay();
  const context = coreContext(documentData(data));
  const [first] = todayView(context, parseDay('2026-10-15')).sessions;
  const pack = courseSetup(context, 'c-1').pack!;
  const made = journalLines(t, names, pack, proposedRecord(first.session, first.proposal), true);
  expect(first.proposal?.item.id).toBe('d1');
  expect(said(made)).toEqual([`${lines.resource}: تقويم تشخيصي (مثال)`, `${lines.how}: ${lines.awaiting}`]);
  expect(proposedRecord(first.session, null).coverage).toEqual([]);
});

test('one journal puts the day on one page; one per class gives each class taught that day its page', async () => {
  const data = await withDay();
  const combined = journalPages(documentData(data), t, false, 'combined');
  expect(combined.match(/<div class="head">/g)).toHaveLength(1);
  expect(combined).toContain('الخميس 15 أكتوبر 2026');
  expect(combined).toContain(`${lines.how}: ${lines.awaiting}`);
  const perClass = journalPages(documentData(data), t, false, 'per-class');
  expect(perClass.match(/<div class="head">/g)).toHaveLength(2);
  expect(perClass).toContain('القسم: \u20684م1\u2069');
  expect(perClass).toContain('القسم: \u20684م2\u2069');
  const sunday = journalPages(documentData(data, '2026-10-18'), t, false, 'per-class');
  expect(sunday.match(/<div class="head">/g)).toHaveLength(1);
  expect(sunday).toContain(text.documents.empty);
  const blank = journalPages(documentData(data, '2026-10-18'), t, true, 'per-class');
  expect(blank.match(/<div class="head">/g)).toHaveLength(2);
  expect(blank).not.toContain('أكتوبر 2026');
  expect(blank).not.toContain(text.documents.empty);
});

test('the times print as the book writes them by hand', async () => {
  const data = await withDay();
  const html = journalPages(documentData(data), t, false);
  expect(html).toMatch(/\d\dسا/);
});

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID).props as PressableProps).onPress?.({} as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test('the output steps through the days and prints one page per class when chosen', async () => {
  const data = await withDay();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <DocumentOutput kind={documentKind('journal')!} />)}
      </LocaleDirContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  await press('output-day-after');
  await press('output-print');
  expect(printHtml.mock.calls[0][0]).toContain('الجمعة 16 أكتوبر 2026');
  await press('output-day-before');
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: 'output-layout' }).props as { onSelect: (value: string) => void }).onSelect(
      'per-class',
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await press('output-print');
  const [html] = printHtml.mock.calls[1];
  expect(html).toContain('الخميس 15 أكتوبر 2026');
  expect(html).toContain('القسم: \u20684م1\u2069');
  expect(html).toContain('القسم: \u20684م2\u2069');
});

test('a French journal puts a space before its colons; a class name keeps its order; the layout names its file', async () => {
  const data = await withDay();
  const fr = i18n.getFixedT('fr');
  const html = journalPages({ ...documentData(data), lang: 'fr', dir: 'ltr' }, fr, false, 'per-class');
  expect(html).toContain('Déroulement : en attente de confirmation');
  expect(html).toContain('Classe : \u20684م1\u2069');
  const journal = documentKind('journal')!;
  expect(fileName(journal, documentData(data), t, false, 'combined')).toBe(`${text.documents.journal} 2026-10-15.pdf`);
  expect(fileName(journal, documentData(data), t, true, 'per-class')).toBe(
    `${text.documents.journal} 2026-10-15 - ${text.documents.output.layouts['per-class']} - ${text.documents.output.blank}.pdf`,
  );
});

test('a journal opened before the school year starts on its first day, and says the day as it changes', async () => {
  const data = await withDay();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <DocumentOutput kind={documentKind('journal')!} />, '2026-08-20')}
      </LocaleDirContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const before = tree!.root.findByProps({ testID: 'output-day-before' }).props as { disabled: boolean };
  expect(before.disabled).toBe(true);
  await press('output-print');
  expect(printHtml.mock.calls[0][0]).toContain(`${data.year.from.slice(8).replace(/^0/, '')} سبتمبر 2026`);
  expect(tree!.root.findAll((node) => node.props.accessibilityLiveRegion === 'polite').length).toBeGreaterThan(0);
});
