// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Obs-Report's way to the IGP and its closures (#627, answer 680): the draft
// sent on the term's last day, by the world's date, the publish control
// disabled with its date through the 30th day after it and gone after, with
// the words for each; the uses the figures may never serve; each wilaya shown
// with the school days closures took and its classes, none hidden listed, and
// none shown said so; working the days out, from the calendar alone: a national
// closure or the wilaya's on working days of the term, half for a half day, no
// other wilaya's, one school's, weekend, holiday or day outside the year, none
// of a level or grades not the pack's; the reference data's order, never by a
// figure; and the page, at each term's end, saying that term's dates and the
// wilayas shown alone. All made up.

import type { CalendarEntry, CountryProfile, Day, SchoolCalendar, SchoolYear } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ClosuresCard } from '../src/observatory/ObsClosures';
import { ObsReportSteps } from '../src/observatory/ObsReportSteps';
import { ObsReport, type ObsReportProps } from '../src/observatory/ObsReport';
import {
  closureDays,
  closureRows,
  commentsEnd,
  commentsOver,
  publicCalendar,
} from '../src/observatory/report-closures';
import type { Figure } from '../src/observatory/figures-read';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.obsReport;
const day = (text: string) => text as Day;
const YEAR = {
  id: '2026-2027',
  from: day('2026-09-01'),
  to: day('2027-07-04'),
  terms: [
    { number: 1, from: day('2026-09-21'), to: day('2026-12-17') },
    { number: 2, from: day('2027-01-04'), to: day('2027-03-18') },
  ],
  source: 'made up',
} as SchoolYear;
const TERM = YEAR.terms[0];
const profile = {
  workingDays: [0, 1, 2, 3, 4],
  subjects: [],
  zones: [
    { code: '31', name: { ar: 'وهران', en: 'Oran', fr: 'Oran' } },
    { code: '16', name: { ar: 'الجزائر', en: 'Algiers', fr: 'Alger' } },
  ],
  levels: [
    { code: 'cem', grades: [{ code: '4am', name: { ar: 'الرابعة متوسط', en: '4AM', fr: '4AM' } }] },
    { code: 'primary', grades: [{ code: '5ap' }] },
  ],
} as unknown as CountryProfile;
const closure = (id: string, from: string, to: string, more: Partial<CalendarEntry> = {}) =>
  ({ id, layer: 'zone', zone: '16', effect: 'closure', from: day(from), to: day(to), ...more }) as CalendarEntry;
const calendarOf = (entries: readonly CalendarEntry[]): SchoolCalendar => ({
  country: 'dz',
  release: '2026.1',
  year: YEAR,
  entries,
});
const figure = (classes: number) => ({ classes }) as Figure;

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const render = async (node: React.ReactElement) => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value="rtl">{node}</LocaleDirContext.Provider>);
  });
};
const textOf = (id: string) =>
  tree!.root
    .findAllByProps({ testID: id })[0]
    .findAllByType(Text)
    .map((one) => [(one.props as TextProps).children].flat().map(String).join(''))
    .join('\n');
const has = (id: string) => tree!.root.findAllByProps({ testID: id }).length > 0;
const steps = (date: string) =>
  render(<ObsReportSteps termEnd={TERM.to} date={day(date)} dayText={(one) => `day ${one}`} />);

test('counts the IGP’s 30 days from the term’s last day, by the world’s date', () => {
  expect(commentsEnd(TERM.to)).toBe('2027-01-16');
  expect(commentsOver(TERM.to, day('2026-12-17'))).toBe(false);
  expect(commentsOver(TERM.to, day('2027-01-16'))).toBe(false);
  expect(commentsOver(TERM.to, day('2027-01-17'))).toBe(true);
});

test('keeps publishing disabled with its date through the 30th day', async () => {
  await steps('2027-01-16');
  expect(textOf('obs-step-example')).toBe(words.example);
  expect(textOf('obs-step-sent')).toBe(words.sent.replace('{{day}}', isolate('day 2026-12-17')));
  expect(textOf('obs-step-comment')).toBe(words.commentOpen.replace('{{day}}', isolate('day 2027-01-16')));
  expect(textOf('obs-step-publish')).toBe(words.publishLater);
  const publish = tree!.root.findAllByProps({ testID: 'obs-publish' })[0];
  expect(publish.props).toMatchObject({
    disabled: true,
    label: words.publishAfter.replace('{{day}}', isolate('day 2027-01-16')),
  });
});

test('says published by the method after the 30 days, with no control left', async () => {
  await steps('2027-01-17');
  expect(textOf('obs-step-comment')).toBe(words.commentEnded.replace('{{day}}', isolate('day 2027-01-16')));
  expect(textOf('obs-step-publish')).toBe(words.published);
  expect(has('obs-publish')).toBe(false);
});

test('states the uses the figures may never serve, and the commitment asked', async () => {
  await steps('2026-12-20');
  expect(textOf('obs-never-scope')).toBe(words.uses.scope);
  expect(textOf('obs-never-rank')).toBe(words.uses.rank);
  expect(textOf('obs-never-staff')).toBe(words.uses.staff);
  expect(textOf('obs-steps')).toContain(words.writing);
});

test('counts a wilaya’s closure on the term’s working days, half for a half day', () => {
  const count = (entries: readonly CalendarEntry[], wilaya = '16', grade = '4am') =>
    closureDays(publicCalendar(calendarOf(entries), profile), profile, TERM, wilaya, grade);
  expect(count([])).toBe(0);
  expect(count([closure('week', '2026-10-04', '2026-10-10')])).toBe(5);
  expect(count([closure('week', '2026-10-04', '2026-10-10')], '31')).toBe(0);
  expect(count([closure('half', '2026-10-05', '2026-10-05', { half: 'morning' })])).toBe(0.5);
  expect(
    count([
      closure('am', '2026-10-05', '2026-10-05', { half: 'morning' }),
      closure('pm', '2026-10-05', '2026-10-05', { half: 'afternoon' }),
    ]),
  ).toBe(1);
  expect(count([closure('outside', '2027-01-05', '2027-01-06')])).toBe(0);
  expect(count([closure('edge', '2026-12-17', '2026-12-20')])).toBe(1);
  expect(count([closure('levels', '2026-10-05', '2026-10-05', { levels: ['primary'] })])).toBe(0);
  expect(count([closure('levels', '2026-10-05', '2026-10-05', { levels: ['primary'] })], '16', '5ap')).toBe(1);
  expect(count([closure('grades', '2026-10-05', '2026-10-05', { grades: ['4am'] })])).toBe(1);
  expect(count([closure('grades', '2026-10-05', '2026-10-05', { grades: ['3am'] })])).toBe(0);
  const national = closure('national', '2026-10-05', '2026-10-05', { layer: 'national', zone: undefined });
  expect(count([national], '31')).toBe(1);
  const school = closure('school', '2026-10-05', '2026-10-05', { layer: 'school', zone: undefined, schoolId: '' });
  expect(count([school])).toBe(0);
  const short = { ...TERM, from: day('2026-08-30'), to: day('2026-09-02') };
  const view = publicCalendar(calendarOf([closure('before', '2026-08-30', '2026-09-02')]), profile);
  expect(closureDays(view, profile, short, '16', '4am')).toBe(2);
  const holiday = closure('holiday', '2026-10-05', '2026-10-05', {
    layer: 'national',
    zone: undefined,
    effect: 'no-school',
  });
  expect(count([holiday, closure('week', '2026-10-05', '2026-10-05')])).toBe(0);
});

test('lists the wilayas shown in the reference data’s order, never by a figure', () => {
  const rows = closureRows(
    [
      ['40', figure(50)],
      ['16', figure(12)],
      ['31', figure(30)],
    ],
    calendarOf([closure('week', '2026-10-05', '2026-10-06')]),
    profile,
    TERM,
    '4am',
  );
  expect(rows).toEqual([
    { code: '31', days: 0, classes: 30 },
    { code: '16', days: 2, classes: 12 },
    { code: '40', days: 0, classes: 50 },
  ]);
});

test('shows each wilaya’s days and classes, by its code and name, and only those', async () => {
  await render(
    <ClosuresCard
      rows={[
        { code: '16', days: 1.5, classes: 12 },
        { code: '40', days: 0, classes: 50 },
      ]}
      profile={profile}
    />,
  );
  expect(textOf('obs-closure-16')).toBe(`${isolate('16 الجزائر')}\n1,5\n12`);
  expect(textOf('obs-closure-40')).toBe(`${isolate('40')}\n0\n50`);
  expect(has('obs-closure-31')).toBe(false);
  expect(textOf('obs-closures')).toContain(words.closuresFrom);
});

test('says when no wilaya is shown', async () => {
  await render(<ClosuresCard rows={[]} profile={profile} />);
  expect(textOf('obs-closures')).toContain(words.noWilayas);
});

test('says each term’s dates from the page, and lists only the wilayas the server shows', async () => {
  const shown = { classes: 30, teachers: 12, schools: 4, reached: { low: 0, median: 0, high: 0 }, items: {} };
  const heading = { grade: '4am', subject: 'arabic', pack: 'dz.cem.4am.arabic.example', release: '2026.1' };
  const send: ObsReportProps['send'] = (request) => {
    const url = new URL(`https://demo.test${request.path}`);
    const asked = { year: YEAR.id, term: Number(url.searchParams.get('term')) };
    const figures = { ...heading, nation: shown, wilayas: { '16': shown }, setAside: null };
    const body = url.searchParams.has('at') ? { ...asked, at: 0, figures } : { ...asked, packs: [heading] };
    return Promise.resolve({ status: 200, body, retryAfter: null });
  };
  const closed = calendarOf([
    closure('week', '2026-10-05', '2026-10-06'),
    closure('hidden', '2026-10-07', '2026-10-07', { zone: '31' }),
  ]);
  const page = (date: string) => (
    <LocaleDirContext.Provider value="rtl">
      <ObsReport
        world={{ world: 'AB12C', date: day(date), starter: null }}
        year={YEAR}
        reference={{ profile, packs: [], calendar: closed }}
        dayText={(one) => `day ${one}`}
        send={send}
      />
    </LocaleDirContext.Provider>
  );
  const settled = async (step: () => void) => {
    for (let turn = 0; turn < 12; turn += 1)
      await ReactTestRenderer.act(async () => {
        if (turn === 0) step();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
  };
  await settled(() => {
    tree = ReactTestRenderer.create(page('2026-12-20'));
  });
  expect(textOf('obs-step-sent')).toContain('day 2026-12-17');
  expect(textOf('obs-closure-16')).toBe(`${isolate('16 الجزائر')}\n2\n30`);
  expect(has('obs-closure-31')).toBe(false);
  await settled(() => tree!.update(page('2027-03-20')));
  expect(textOf('obs-step-sent')).toContain('day 2027-03-18');
  expect(textOf('obs-step-comment')).toContain('day 2027-04-17');
  expect(textOf('obs-closure-16')).toBe(`${isolate('16 الجزائر')}\n0\n30`);
});
