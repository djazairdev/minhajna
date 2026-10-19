// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's homework page (#214, P67): each homework of a class and
// subject in the order it was set, with its two dates, its activity and
// its two counts with their shares, blank until counted; the page blank
// with its heads for a subject with none and in the blank version; a
// French subject's page left to right; a year of homework running on to
// more pages; no name ever printed; and its entry in the Documents tab.
// Made-up records only.

import { confirmSessions, parseDay, sessionsBetween } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withPupils } from '../jest/roll-class';
import { documentKind, fileName } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { HOMEWORK_RULES, homeworkPages } from '../src/documents/homework-pages';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');

const documentData = (data: TestData): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  packs: data.packs,
  bells: data.bells,
  day: parseDay('2026-10-23'),
  lang: 'ar',
  dir: 'rtl',
});

const set = (slot: number) => `c-1/2026-10-15/m${slot}/k-1-w`;
const entries = (html: string) => html.match(/<tr class="entry">/g)?.length ?? 0;
const rules = (html: string) => html.match(/<tr class="rule">/g)?.length ?? 0;
const pages = (html: string) => html.match(/<section class="page"[^>]*>/g)?.length ?? 0;

/** Two homework set on 15 October in 4م1's Arabic, the first counted; 4م1's French and 4م2's Arabic have none. */
async function withHomework(texts = ['التمرين 2 ص 21', 'أسئلة الفهم ص 17']): Promise<TestData> {
  const data = await withPupils();
  const day = parseDay('2026-10-15');
  await data.book.record(day, {
    kind: 'course.set',
    course: { id: 'c-3', classId: 'k-1', subject: 'french', year: '2026-2027', pack: null },
  });
  const context = coreContext({ ...data, state: data.book.state });
  const [first, second] = sessionsBetween(context, day, day, new Set(['c-1']));
  if (first === undefined || second === undefined) throw new Error('No sessions');
  await data.book.recordAll(
    day,
    confirmSessions(context, [
      { session: first, details: { homework: { text: texts[0] ?? '', due: parseDay('2026-10-22') } } },
      { session: second, details: { homework: { text: texts[1] ?? '', due: parseDay('2026-10-29') } } },
    ]),
  );
  await data.book.record(parseDay('2026-10-22'), {
    kind: 'homework.counted',
    count: { sessionKey: set(1), due: parseDay('2026-10-22'), notDone: 3, reliedOn: 2 },
  });
  return data;
}

test('prints each homework with its dates, its activity and its counts, blank until counted', async () => {
  const html = homeworkPages(documentData(await withHomework()), t, false);
  expect(html).toContain('دفتر النصوص · الواجبات');
  expect(html).toContain('نشاطات التقويم المستمر: تشخيصي، تكويني، تحصيلي');
  expect(html).toContain('<th rowspan="2">تاريخ إعادة الواجب</th>');
  expect(html).toContain('<th colspan="2">التخلي عن إنجاز النشاط</th>');
  expect(html).toContain(
    '<tr class="entry"><td class="when">2026/10/15</td><td class="when">2026/10/22</td><td class="what">التمرين 2 ص 21</td><td>3</td><td>7%</td><td>2</td><td>4%</td></tr>',
  );
  expect(html).toContain(
    '<td class="when">2026/10/29</td><td class="what">أسئلة الفهم ص 17</td><td></td><td></td><td></td><td></td></tr>',
  );
  expect(entries(html)).toBe(2);
  expect(html).not.toMatch(/<script|https?:/);
  for (const pupil of documentData(await withHomework()).state.pupils.values()) expect(html).not.toContain(pupil.name);
});

test('a subject with no homework, and the blank version, get the page with its heads and empty rules', async () => {
  const data = await withHomework();
  const recorded = homeworkPages(documentData(data), t, false);
  expect(pages(recorded)).toBe(3);
  expect(recorded).toContain('<table class="book homework latin" lang="fr" dir="ltr">');
  expect(recorded).toContain('<th colspan="2">Abandon de l&#39;activité</th>');
  expect(recorded).toContain('⁨4م1⁩ · Langue française · devoirs');
  expect(rules(recorded)).toBe(HOMEWORK_RULES - 3 + 2 * HOMEWORK_RULES);
  const blank = homeworkPages(documentData(data), t, true);
  expect(entries(blank)).toBe(0);
  expect(rules(blank)).toBe(3 * HOMEWORK_RULES);
});

test('a long activity counts the rules it wraps onto, and a year of homework runs on to more pages', async () => {
  const long = Array.from({ length: 104 }, () => 'تمرين').join(' ');
  const data = await withHomework([long, 'أسئلة الفهم ص 17']);
  const html = homeworkPages(documentData(data), t, false);
  expect(pages(html)).toBe(4);
  expect(entries(html)).toBe(2);
});

test('the Documents tab lists it for the year, and never for a teacher with no class this year', async () => {
  const data = await withHomework();
  const kind = documentKind('homework');
  expect(kind?.title(t)).toBe('سجل الواجبات');
  expect(kind?.pupils).toBe(false);
  expect(kind && fileName(kind, documentData(data), t, false)).toBe('سجل الواجبات 2026-2027.pdf');
  expect(kind?.empty(documentData(data))).toBe(false);
  expect(kind?.empty({ ...documentData(data), year: { ...data.year, id: '2027-2028' } })).toBe(true);
});
