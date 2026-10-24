// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay, type TeacherCover } from '@minhajna/core';
import { withDay } from '../jest/today-day';
import { coverJournalDays, coverPrimaryDays, type SchoolCoverDocumentData } from '../src/school/cover-journal';
import { journalHtml } from '../src/documents/journal-html';
import { journalPages } from '../src/documents/journal-pages';
import { primaryJournalHtml, PRIMARY_WIDTHS } from '../src/documents/primary-journal-html';
import { primaryJournalPages } from '../src/documents/primary-journal-pages';
import { textsBookPages } from '../src/documents/texts-book-pages';
import { i18n } from '../src/text/i18n';

const day = parseDay('2026-10-15');
const row: TeacherCover = {
  session: {
    id: 'cover',
    schoolId: 's-1',
    classId: 'other-class',
    className: 'قسم تجريبي <cover>',
    level: 'cem',
    day,
    slot: { half: 'morning', index: 4 },
  },
  direction: 'given',
  choice: 'supervision',
  assigned: true,
  completed: true,
};
const made = async (cover: readonly TeacherCover[] = [row]): Promise<SchoolCoverDocumentData> => {
  const data = await withDay();
  return { ...data, state: data.book.state, day, lang: 'ar', dir: 'rtl', cover };
};
const labels = (data: SchoolCoverDocumentData) => ({
  lang: data.lang,
  dir: data.dir,
  book: 'Journal',
  school: 'Établissement de démonstration',
  year: '2026-2027',
  teacher: 'Teacher',
  director: 'Director',
  empty: '',
  colon: ': ',
});

afterEach(async () => {
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'school-journal helpers select confirmed cover and keep the pilot documents unchanged (%s)',
  async (lang) => {
    await i18n.changeLanguage(lang);
    const data = { ...(await made()), lang, dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const) };
    const ordinary = { ...data, cover: undefined };
    const t = i18n.t.bind(i18n);
    const html = journalHtml(
      { ...labels(data), time: 'Slot', className: 'Class', content: 'Content' },
      coverJournalDays(data, t, false),
    );
    expect(html).toContain('قسم تجريبي &lt;cover&gt;');
    expect(html).not.toContain('<cover>');
    expect(textsBookPages(data, t, false)).toBe(textsBookPages(ordinary, t, false));
    for (const layout of ['combined', 'per-class']) {
      expect(journalPages(data, t, false, layout)).toBe(journalPages(ordinary, t, false, layout));
    }
    expect(coverJournalDays(data, t, true)).toEqual([]);
    expect(coverJournalDays({ ...data, cover: undefined }, t, false)).toEqual([]);
    for (const rejected of [
      { ...row, direction: 'received' as const },
      { ...row, assigned: false },
      { ...row, completed: false },
      { ...row, session: { ...row.session, day: parseDay('2026-10-14') } },
      { ...row, session: { ...row.session, schoolId: 'other-school' } },
    ]) {
      expect(coverJournalDays({ ...data, cover: [rejected] }, t, false)).toEqual([]);
    }
  },
);

test('primary helper uses its own bands without activating primary cover in the pilot or inventing times', async () => {
  const data = await made([{ ...row, session: { ...row.session, level: 'primary' } }]);
  const ordinary = { ...data, cover: undefined };
  const t = i18n.t.bind(i18n);
  expect(coverJournalDays(data, t, false)).toEqual([]);
  const pages = coverPrimaryDays(data, t, false);
  expect(pages).toHaveLength(1);
  expect(pages[0].bands[0].entries[0].when).toContain('4');
  expect(pages[0].bands[0].entries[0].when).not.toContain(':');
  const html = primaryJournalHtml(
    { ...labels(data), heads: ['Slot', 'Class', 'Activity', 'Content', 'Indicator', 'Domain'], widths: PRIMARY_WIDTHS },
    pages,
    false,
  );
  expect(html).toContain('قسم تجريبي &lt;cover&gt;');
  expect(html).not.toContain('<cover>');
  expect(coverPrimaryDays(data, t, true)).toEqual([]);
  expect(primaryJournalPages(data, t, false)).toBe(primaryJournalPages(ordinary, t, false));
  expect(textsBookPages(data, t, false)).not.toContain('قسم تجريبي');
});
