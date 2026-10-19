// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed documents for the Arabic PDF check (#44): text escaped, the
// bundled fonts embedded, A4 portrait journal pages with times and class
// codes isolated, the landscape roll-call month with letters for marks and
// its totals, and October of the demo year made into both PDFs. Made-up
// classes and pupils only; Jest has no web engine, so the PDFs are mocked.

import { FakeStorage } from '../jest/fake-storage';
import { makeDemoPdfs } from '../src/debug/pdf-check';
import { journalHtml, type JournalTexts } from '../src/documents/journal-html';
import { escapeHtml } from '../src/documents/print-html';
import { rollMonthHtml, type RollMonthTexts } from '../src/documents/roll-month-html';
import pdf from '../src/native/NativeMinhajnaPdf';
import { nativeDeps } from '../src/storage/history';
import { i18n } from '../src/text/i18n';

const journalTexts: JournalTexts = {
  lang: 'ar',
  dir: 'rtl',
  book: 'الدفتر اليومي',
  school: 'متوسطة <النجاح>',
  year: 'السنة الدراسية \u20682026-2027\u2069',
  time: 'من – إلى',
  className: 'القسم',
  content: 'المقطع والميدان والمورد، وسير الحصة',
  teacher: 'توقيع الأستاذ',
  director: 'تأشيرة المدير',
  empty: 'لا حصة في هذا اليوم.',
  colon: ': ',
};

const rollTexts: RollMonthTexts = {
  lang: 'ar',
  dir: 'rtl',
  title: 'سجل المناداة · أكتوبر 2026',
  number: 'الرقم',
  name: 'الاسم واللقب',
  latinName: 'بالحروف اللاتينية',
  absent: 'الغياب',
  late: 'التأخر',
  key: 'غ: غياب غير مبرر',
  marks: { unjustified: 'غ', justified: 'م', late: 'ت' },
  confidential: 'داخلي · سري',
};

test('escapes text from the teacher and the class list', () => {
  expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('prints a journal page a day, in A4 portrait, with the fonts embedded and times isolated', () => {
  const html = journalHtml(journalTexts, [
    {
      title: 'الأحد 4 أكتوبر 2026',
      entries: [
        {
          time: '08:00 – 09:00',
          className: '4م2',
          lines: [{ label: 'المورد', text: 'العدد <والمعدود>' }],
          awaiting: false,
        },
        { time: '10:00 – 11:00', className: '4م1', lines: [{ text: 'سير الحصة: تنتظر التأكيد' }], awaiting: true },
      ],
    },
    { title: 'الإثنين 5 أكتوبر 2026', entries: [] },
  ]);
  expect(html).toMatch(/^<!doctype html><html lang="ar" dir="rtl">/);
  expect(html).toContain('@page{size:A4 portrait;');
  expect(html).toContain("src:url('noto_naskh_arabic_regular.ttf')");
  expect(html).toContain("src:url('aref_ruqaa_bold.ttf')");
  expect(html.match(/<section class="page"[^>]*>/g)).toHaveLength(2);
  expect(html).toContain('<bdi>08:00 – 09:00</bdi>');
  expect(html).toContain('<bdi>4م2</bdi>');
  expect(html).toContain('المورد: العدد &lt;والمعدود&gt;');
  expect(html).toContain('متوسطة &lt;النجاح&gt;');
  expect(html).toContain('class="row entry awaiting"');
  expect(html).toContain('لا حصة في هذا اليوم.');
  expect(html).not.toMatch(/<script|https?:/);
  expect(html).toContain(`content="script-src 'none'; object-src 'none'"`);
});

const rows = [
  { number: 1, name: 'مختلق ريان', latinName: 'Rayane Mokhtalaq', marks: ['unjustified', 'late'] as const },
  { number: 2, name: 'مختلق آية', latinName: 'Aya Mokhtalaq', marks: [null, 'justified'] as const },
];

test('prints the month’s roll calls in A4 landscape, with letters for marks and the totals', () => {
  const html = rollMonthHtml(rollTexts, [
    { title: rollTexts.title, scope: '4م2 · متوسطة النجاح', columns: ['04/10', '05/10'], rows },
  ]);
  expect(html).toContain('@page{size:A4 landscape;');
  expect(html).toContain('<thead><tr><th>الرقم</th>');
  expect(html.match(/<col[ >]/g)).toHaveLength(7);
  expect(html).toContain(
    '<tr><td>1</td><td class="name">مختلق ريان</td><td class="latin latin-name">Rayane Mokhtalaq</td><td>غ</td><td>ت</td><td>1</td><td>1</td></tr>',
  );
  expect(html).toContain('<td></td><td>م</td><td>1</td><td>0</td></tr>');
  expect(html.match(/داخلي · سري/g)).toHaveLength(2);
  expect(html).toContain('@page{size:A4 landscape;margin:12mm');
  expect(html).toMatch(/<table class="frame"><thead><tr><td class="mark">[^<]+<\/td><\/tr><\/thead><tbody>/);
  expect(html).toMatch(/<\/tbody><tfoot><tr><td class="mark">[^<]+<\/td><\/tr><\/tfoot><\/table><\/section>/);
});

test('starts each class on its page, and a blank sheet keeps the names with no marks or totals', () => {
  const html = rollMonthHtml(rollTexts, [
    { title: rollTexts.title, scope: '4م1', columns: ['04/10'], rows: [rows[0]] },
    {
      title: rollTexts.title,
      scope: '4م2',
      columns: ['04/10', '05/10'],
      rows: [{ ...rows[1], marks: [null, null] }],
      blank: true,
    },
  ]);
  expect(html.match(/<section class="page"[^>]*>/g)).toHaveLength(2);
  expect(html).toContain(
    '<td class="name">مختلق آية</td><td class="latin latin-name">Aya Mokhtalaq</td><td></td><td></td><td></td><td></td></tr>',
  );
});

test('makes October of the demo year into the journal and the roll-call PDFs', async () => {
  const make = jest.spyOn(pdf, 'makePdf');
  make.mockClear();
  const made = await makeDemoPdfs(i18n.t, nativeDeps(new FakeStorage().asSpec()));
  expect(make).toHaveBeenCalledTimes(2);
  const [journal, journalName, journalLandscape] = make.mock.calls[0];
  const [roll, rollName, rollLandscape] = make.mock.calls[1];
  expect([journalName, journalLandscape, rollName, rollLandscape]).toEqual([
    'journal-2026-10',
    false,
    'roll-2026-10',
    true,
  ]);
  expect(journal.match(/<section class="page"[^>]*>/g)).toHaveLength(19);
  expect(journal).toContain('الخميس 1 أكتوبر 2026');
  expect(roll.match(/<tr><td>\d+<\/td>/g)).toHaveLength(45);
  expect(made.journal.name).toBe('journal-2026-10');
}, 30000);
