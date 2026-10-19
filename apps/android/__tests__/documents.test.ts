// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed documents for the Arabic PDF check (#44): text escaped, the
// bundled fonts embedded, A4 portrait journal pages with times and class
// codes isolated, the roll-call book's two-page portrait spread with its
// shading, totals and signature boxes, its yearly summary on A4 landscape,
// and October of the demo year made into both PDFs. Made-up classes and
// pupils only; Jest has no web engine, so the PDFs are mocked.

import { FakeStorage } from '../jest/fake-storage';
import { makeDemoPdfs } from '../src/debug/pdf-check';
import { journalHtml, type JournalTexts } from '../src/documents/journal-html';
import { escapeHtml } from '../src/documents/print-html';
import { rollSpreadHtml, type RollSpread, type SpreadTexts } from '../src/documents/roll-spread-html';
import { rollYearHtml, type YearTexts } from '../src/documents/roll-year-html';
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

const spreadTexts: SpreadTexts = {
  lang: 'ar',
  dir: 'rtl',
  title: 'دفتر المناداة · أكتوبر 2026',
  number: 'الرقم',
  name: 'الاسم واللقب',
  absent: 'غ',
  present: 'ح-ف',
  possible: 'ح-ك',
  dates: 'تواريخ الغياب',
  late: 'التأخر',
  legend: ['- غياب صباحاً'],
  off: 'عطلة',
  none: 'لا حصة',
  teacher: 'الأستاذ',
  director: 'المدير',
  inspector: 'المفتش',
  date: 'التاريخ:',
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

const spreadRow = (number: number, name: string, marks: Record<number, string>) => ({
  number,
  name,
  marks: Array.from({ length: 31 }, (_, index) => marks[index + 1] ?? ''),
  absent: '2',
  present: '14',
  possible: '16',
  dates: '05، 22م',
  late: '06',
});

const sheet: RollSpread = {
  title: spreadTexts.title,
  scope: '4م2 · متوسطة <النجاح>',
  days: Array.from({ length: 31 }, (_, index) => (index === 4 ? 'off' : index === 5 ? 'none' : null)),
  rows: [spreadRow(1, 'مختلق ريان', { 5: '-', 22: '(ǀ)' }), spreadRow(2, '', {})],
  possibleColumn: false,
  footer: 'ح-ك 16 لكل تلميذ',
  book: 'k-2',
};

test('prints a class’s month as two A4 portrait pages, days 1 to 20 and then the rest with the totals', () => {
  const html = rollSpreadHtml(spreadTexts, [sheet]);
  expect(html).toContain('@page{size:A4 portrait;');
  const pages = html.split('<section class="page"').slice(1);
  expect(pages).toHaveLength(2);
  expect(pages.every((one) => one.startsWith(' data-book="k-2">'))).toBe(true);
  expect(pages[0].match(/<th[^>]*><bdi>\d\d<\/bdi><\/th>/g)).toHaveLength(20);
  expect(pages[1].match(/<th[^>]*><bdi>\d\d<\/bdi><\/th>/g)).toHaveLength(11);
  expect(pages[0]).toContain('<th class="off"><bdi>05</bdi></th><th class="none"><bdi>06</bdi></th>');
  expect(pages[0]).toContain('<td class="off" style="height:5mm">-</td>');
  expect(pages[1]).toContain('<td style="height:5mm">(ǀ)</td>');
  expect(pages[1]).toContain('<th>غ</th><th>ح-ف</th><th>تواريخ الغياب</th><th>التأخر</th>');
  expect(pages[1]).not.toContain('<th>ح-ك</th>');
  expect(pages[1]).toContain('>05، 22م</td><td class="wrap" style="height:5mm">06</td>');
  expect(pages[0]).toContain('- غياب صباحاً');
  expect(pages[0]).not.toContain('المفتش');
  expect(pages[1]).toContain('<td>الأستاذ</td><td>المدير<br>التاريخ:</td><td>المفتش<br>التاريخ:</td>');
  expect(pages[1]).toContain('ح-ك 16 لكل تلميذ');
  expect(html).toContain('متوسطة &lt;النجاح&gt;');
  expect(html.match(/داخلي · سري/g)).toHaveLength(4);
});

test('a spread gives «ح-ك» a column when pupils differ, and shrinks rows past 50 to keep one spread', () => {
  const many = Array.from({ length: 60 }, (_, index) => spreadRow(index + 1, `تلميذ ${index + 1}`, {}));
  const html = rollSpreadHtml(spreadTexts, [
    { ...sheet, rows: many, possibleColumn: true, days: sheet.days.slice(0, 30) },
  ]);
  const pages = html.split('<section class="page"').slice(1);
  expect(pages[1]).toContain('<th>ح-ك</th><th>غ</th><th>ح-ف</th>');
  expect(pages[1].match(/<th[^>]*><bdi>\d\d<\/bdi><\/th>/g)).toHaveLength(10);
  expect(pages[0]).toContain('style="height:3.06mm"');
  expect(pages[1]).toContain('<td style="height:3.06mm">16</td><td style="height:3.06mm">2</td>');
});

test('prints the yearly summary on one A4 landscape page a class, months to come empty, with the class’s totals', () => {
  const texts: YearTexts = {
    lang: 'ar',
    dir: 'rtl',
    title: 'الملخص السنوي',
    number: 'الرقم',
    name: 'الاسم واللقب',
    heads: ['ح-ك', 'غ', 'ح-ف', '%'],
    year: 'السنة',
    teacher: 'الأستاذ',
    director: 'المدير',
    inspector: 'المفتش',
    date: 'التاريخ:',
    confidential: 'داخلي · سري',
  };
  const html = rollYearHtml(texts, [
    {
      title: 'الملخص السنوي',
      scope: '4م1',
      months: ['سبتمبر', 'أكتوبر'],
      rows: [
        {
          number: '1',
          name: 'مختلق ريان',
          figures: ['16', '2', '14', '87.5', '', '', '', '', '16', '2', '14', '87.5'],
        },
      ],
      total: {
        number: '',
        name: 'مجموع القسم',
        figures: ['16', '2', '14', '87.5', '', '', '', '', '16', '2', '14', '87.5'],
      },
      note: 'حتى 19/10',
      book: 'k-1',
    },
  ]);
  expect(html).toContain('@page{size:A4 landscape;');
  expect(html.match(/<section class="page"/g)).toHaveLength(1);
  expect(html).toContain(
    '<th colspan="4" class="m">سبتمبر</th><th colspan="4" class="m">أكتوبر</th><th colspan="4" class="m">السنة</th>',
  );
  expect(html.match(/<th class="m">ح-ك<\/th>/g)).toHaveLength(3);
  expect(html).toContain('<tr class="total">');
  expect(html).toContain('<td class="m" style="height:5mm"></td>');
  expect(html).toContain('<td>المفتش<br>التاريخ:</td>');
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
    false,
  ]);
  expect(journal.match(/<section class="page"[^>]*>/g)).toHaveLength(19);
  expect(journal).toContain('الخميس 1 أكتوبر 2026');
  expect(roll.match(/<section class="page"/g)).toHaveLength(2);
  expect(roll.match(/<tr><td style="height:[\d.]+mm">\d+<\/td>/g)).toHaveLength(100);
  expect(roll.match(/<td class="name"[^>]*><\/td>/g)).toHaveLength(5);
  expect(made.journal.name).toBe('journal-2026-10');
}, 30000);
