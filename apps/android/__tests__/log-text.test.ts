// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The activity log's words (#235, answers 425 to 427): a period as its file is
// named, or a term by its name (#239), a document by its title or «وثيقة», a
// re-pace draft, a class that has gone as a dash, a pupil no longer on the list
// without a number, signed files with their plan's subject and year, an
// erasure's kinds each named once, a withdrawn session and one recorded again,
// and a change that cannot be checked by its kind, with each language's own
// comma; a mark corrected after the term, a test by its title (#243); and a
// pupil's erasure in one line with nothing of them (#248). Made-up records
// only.

import { parseDay, type LogLine, type MarkTarget, type SessionRef } from '@minhajna/core';
import { openTestData } from '../jest/app-data';
import { withTest } from '../jest/marks-class';
import { withDay } from '../jest/today-day';
import { categoryLabel, kindLabel, lineText, logDay, periodLabel, type LogNames } from '../src/log/log-text';
import { i18n, missingKeys } from '../src/text/i18n';

afterEach(async () => {
  await i18n.changeLanguage('ar');
});

async function names(): Promise<LogNames> {
  const data = await withDay();
  return { state: data.book.state, profile: data.profile, lang: 'ar' };
}

const t = i18n.t.bind(i18n);
const session: SessionRef = {
  key: 'c-1/2026-10-15/m1/k-1-w',
  courseId: 'c-1',
  groupId: 'k-1-w',
  day: parseDay('2026-10-15'),
  slot: { half: 'morning', index: 1 },
};
const output = (document: string, period: string): LogLine => ({
  kind: 'output',
  output: { id: 'o', document, period, how: 'print', blank: false },
});

test('a period reads as a day, a month in the profile’s names, or a school year', async () => {
  const shown = await names();
  expect(logDay(parseDay('2026-10-04'))).toBe('04/10/2026');
  expect(periodLabel(shown, '2026-10-04')).toBe('04/10/2026');
  expect(periodLabel(shown, '2027-01')).toBe('جانفي 2027');
  expect(periodLabel(shown, '2026-2027')).toBe('2026-2027');
});

test('documents by their title, a re-pace draft by its own, anything else as «وثيقة»', async () => {
  const shown = await names();
  expect(lineText(t, shown, output('journal', '2026-10-15'))).toBe('الدفتر اليومي · 15/10/2026 · طباعة');
  expect(lineText(t, shown, output('sept-check', '2026-10-15'))).toBe('فحص سبتمبر · 15/10/2026 · طباعة');
  expect(lineText(t, shown, output('made-up', '2026-10'))).toBe('وثيقة · أكتوبر 2026 · طباعة');
  expect(lineText(t, shown, output('marks-justify', 'term-1'))).toBe('تبرير التقويم المستمر · الفصل الأول · طباعة');
  expect(lineText(t, shown, output('mark-sheet', 'term-1'))).toBe('كشف النقاط والتقديرات · الفصل الأول · طباعة');
  expect(lineText(t, shown, output('marks-justify', '2026-10'))).toBe('تبرير التقويم المستمر · أكتوبر 2026 · طباعة');
  expect(lineText(t, shown, output('grade-book', 'term-2'))).toBe('كشف النقاط · الفصل الثاني · طباعة');
  const exported = (how: 'archive' | 'csv'): LogLine => ({
    kind: 'output',
    output: { id: 'o', document: 'export-all', period: '2026-10-24', how, blank: false },
  });
  expect(lineText(t, shown, exported('archive'))).toBe('تصدير كل البيانات · 24/10/2026 · أرشيف «منهاجنا»');
  expect(lineText(t, shown, exported('csv'))).toBe('تصدير كل البيانات · 24/10/2026 · CSV');
  const transfer: LogLine = {
    kind: 'output',
    output: { id: 'o', document: 'transfer', period: '2026-10-24', how: 'archive', blank: false },
  };
  expect(lineText(t, shown, transfer)).toBe('نقل مباشر · 24/10/2026 · أرشيف «منهاجنا»');
  expect(lineText(t, shown, { kind: 'printed', documents: ['repace:c-1', 'texts'] })).toBe(
    'طباعة الأسبوع: إعادة توزيع بقية الفصل، دفتر النصوص',
  );
});

test('a class that has gone shows as a dash, and a pupil off the list has no number', async () => {
  const data = await openTestData();
  const shown: LogNames = { state: data.book.state, profile: data.profile, lang: 'ar' };
  expect(lineText(t, shown, { kind: 'session-withdrawn', session })).toBe(
    'دفتر النصوص · — · الخميس 15/10 · سحب تأكيد الحصة',
  );
  const roll: LogLine = {
    kind: 'roll-call-corrected',
    classId: 'k-gone',
    groupId: 'k-gone-w',
    day: session.day,
    half: 'morning',
    changes: [{ pupilId: 'p-gone', from: 'unjustified', to: 'justified' }],
  };
  expect(lineText(t, shown, roll)).toBe(
    'المناداة · — · الخميس 15/10 · تلميذ لم يعد في القائمة: من غياب غير مبرر إلى غياب مبرر',
  );
});

test('signed files, a session recorded again, and a change that cannot be checked', async () => {
  const shown = await names();
  expect(lineText(t, shown, { kind: 'calendar-update', release: '2026.2' })).toBe(
    'تحديث موقّع للرزنامة، الإصدار 2026.2',
  );
  expect(lineText(t, shown, { kind: 'pack-added', pack: 'dz.cem.4am.arabic.example', release: '2026.2' })).toBe(
    'مخطط موقّع: اللغة العربية · السنة الرابعة متوسط، الإصدار 2026.2',
  );
  expect(lineText(t, shown, { kind: 'pack-added', pack: 'made-up', release: '2026.2' })).toBe(
    'مخطط موقّع: made-up، الإصدار 2026.2',
  );
  expect(lineText(t, shown, { kind: 'erased', kinds: ['session.recorded', 'session.withdrawn', 'pupil.set'] })).toBe(
    'حذف حصة من دفتر النصوص، تلميذ. يبقى أنه حُذف، دون محتواه',
  );
  expect(lineText(t, shown, { kind: 'pupil-erased' })).toBe('حُذفت بيانات تلميذ · دون محتواها');
  expect(lineText(t, shown, { kind: 'layer-added', title: 'طبقة (مثال)' })).toBe('طبقة على المخطط: طبقة (مثال)');
  expect(lineText(t, shown, { kind: 'session-corrected', session, fields: [] })).toBe(
    'دفتر النصوص · \u20684م1\u2069 · الخميس 15/10 · سُجّلت من جديد بعد سحب تأكيدها',
  );
  expect(lineText(t, shown, { kind: 'unverified', entryKind: 'roll-call.taken' })).toBe('تغيير: مناداة');
  expect(kindLabel(t, 'class.set')).toBe('سجل آخر');
  expect(categoryLabel(t, null)).toBe('لا يُتحقق منه');
});

test.each(['fr', 'en'] as const)('every line has its words in %s', async (language) => {
  missingKeys.length = 0;
  await i18n.changeLanguage(language);
  const shown = { ...(await names()), lang: language };
  for (const line of [
    output('texts', '2026-10'),
    { kind: 'erased', kinds: ['session.noted', 'lesson-note.set'] } as LogLine,
    { kind: 'session-corrected', session, fields: ['outcome', 'list-item'], reason: 'entry-error' } as LogLine,
  ]) {
    expect(lineText(t, shown, line)).not.toMatch(/log\.|[؀-ۿ]{3}/);
  }
  expect(periodLabel(shown, '2027-01')).toBe(language === 'fr' ? 'janvier 2027' : 'January 2027');
  const erased: LogLine = { kind: 'erased', kinds: ['roll-call.taken', 'pupil.set'] };
  expect(lineText(t, shown, erased)).toBe(
    language === 'fr'
      ? 'Suppression : un appel, un élève. Il reste qu’elle a eu lieu, sans son contenu'
      : 'Deleted: a roll call, a pupil. The fact stays, without its content',
  );
  expect(lineText(t, shown, { kind: 'pupil-erased' })).toBe(
    language === 'fr'
      ? 'Données d’un élève effacées · sans leur contenu'
      : 'A pupil’s data erased · without its content',
  );
  expect(missingKeys).toEqual([]);
});

test('a mark corrected after the term reads with its class, term, part, pupil, values and reason', async () => {
  const data = await withTest();
  const shown: LogNames = { state: data.book.state, profile: data.profile, lang: 'ar' };
  const line = (pupilId: string, reason?: 'sum-error', target: MarkTarget = { kind: 'exam' }): LogLine => ({
    kind: 'mark-corrected',
    courseId: 'c-1',
    term: 1,
    target,
    pupilId,
    from: 7.75,
    to: 'absent',
    ...(reason !== undefined && { reason }),
  });
  expect(lineText(t, shown, line('p-1', 'sum-error'))).toBe(
    'تصحيح نقطة بعد الفصل · \u20684م1\u2069 · الفصل الأول · الاختبار · التلميذ 1: من 7.75 إلى غائب · ' +
      'السبب: خطأ في جمع نقاط الورقة',
  );
  expect(lineText(t, shown, line('p-gone'))).toBe(
    'تصحيح نقطة بعد الفصل · \u20684م1\u2069 · الفصل الأول · الاختبار · تلميذ لم يعد في القائمة: من 7.75 إلى غائب',
  );
  const test = (testId: string) => line('p-1', undefined, { kind: 'test', testId });
  expect(lineText(t, shown, test('t-1'))).toContain(' · الفصل الأول · \u2068الفرض الأول\u2069 · التلميذ 1: ');
  expect(lineText(t, shown, test('t-gone'))).toContain(' · الفصل الأول · الفرض · التلميذ 1: ');
  for (const language of ['fr', 'en'] as const) {
    await i18n.changeLanguage(language);
    missingKeys.length = 0;
    lineText(t, { ...shown, lang: language }, line('p-1', 'sum-error'));
    expect(missingKeys).toEqual([]);
  }
});
