// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { confirmSessions, parseDay, setCalendarEntry, sessionsBetween } from '@minhajna/core';
import { groupsData } from '../jest/calendar-groups-data';
import { bookViewPages } from '../src/book/book-pages';
import { rowDays, rowTags } from '../src/classes/plan-labels';
import { textsBookPages } from '../src/documents/texts-book-pages';
import { bookRows } from '../src/documents/texts-book-rows';
import type { DocumentData } from '../src/documents/document-data';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

test('the app and printed texts book keep each physical session, date and attending group', async () => {
  const data = await groupsData();
  const day = parseDay('2026-10-15');
  const last = parseDay('2026-10-18');
  const schoolClass = data.book.state.classes.get('k-1')!;
  await data.book.record(day, {
    kind: 'class.set',
    schoolClass: {
      ...schoolClass,
      groups: [
        ...schoolClass.groups,
        { id: 'half-1', kind: 'half', name: 'الفوج الأول' },
        { id: 'half-2', kind: 'half', name: 'الفوج الثاني' },
      ],
    },
  });
  const version = data.book.state.timetables[0].version;
  await data.book.record(day, {
    kind: 'timetable.set',
    version: { ...version, entries: [...version.entries, { ...version.entries[0], id: 'example-sunday', weekday: 0 }] },
  });
  for (const [index, pupil] of [...data.book.state.pupils.values()].entries())
    await data.book.record(day, {
      kind: 'pupil.set',
      pupil: { ...pupil, groups: [index < 3 ? 'half-1' : 'half-2'] },
    });
  const context = () => coreContext({ ...data, state: data.book.state });
  await data.book.record(
    day,
    setCalendarEntry(context(), {
      id: 'example-rotation',
      layer: 'school',
      schoolId: 's-1',
      from: day,
      to: last,
      effect: 'rotating-groups',
      rotation: { classId: schoolClass.id, groups: ['half-1', 'half-2'] },
      name: { ar: 'تناوب تجريبي' },
      confidence: 'announced',
      source: 'إعلان تجريبي',
    }),
  );
  const sessions = sessionsBetween(context(), day, last, new Set(['c-1']));
  await data.book.recordAll(
    last,
    confirmSessions(
      context(),
      sessions.map((session) => ({ session })),
    ),
  );
  const document: DocumentData = { ...data, state: data.book.state, day: last, lang: 'ar', dir: 'rtl' };
  const course = data.book.state.courses.get('c-1')!;
  const t = i18n.getFixedT('ar');
  const rows = bookRows(document, context(), course, day, last, t, 'rtl');
  expect(rows).toHaveLength(3);
  expect(new Set(rows.map((one) => one.date)).size).toBe(2);
  expect(rows.some((one) => one.lines.some((line) => line.text === '4م1 · الفوج الأول'))).toBe(true);
  expect(rows.some((one) => one.lines.some((line) => line.text === '4م1 · الفوج الثاني'))).toBe(true);
  const html = textsBookPages(document, t, false);
  expect(html.match(/<tr class="entry">/g)).toHaveLength(3);
  expect(html).toContain('4م1 · الفوج الأول');
  expect(html).toContain('4م1 · الفوج الثاني');
  const view = bookViewPages(document, context(), course, t, 'rtl', last);
  expect(
    view
      .flatMap((page) => page.rows)
      .filter((one) => one.day >= day)
      .map((one) => one.lines),
  ).toEqual(rows.map((one) => one.lines));
});

test('plan rows name the one taught group and show the common completion date', () => {
  const t = i18n.getFixedT('ar');
  const row = {
    item: { id: 'example-item', kind: 'lesson' as const, title: 'درس تجريبي' },
    status: 'started' as const,
    onlyGroup: 'الفوج الأول',
    taught: { from: parseDay('2026-10-15'), to: parseDay('2026-10-15') },
    next: parseDay('2026-10-18'),
    stages: 1,
    covered: 0,
    position: false,
    expected: false,
  };
  expect(rowTags(t, row).map((one) => one.label)).toContain(t('calendarView.groups.only', { group: 'الفوج الأول' }));
  expect(rowDays({ ...row, status: 'done', completed: parseDay('2026-10-18') })).toEqual({
    text: '18/10',
    ahead: false,
  });
});
