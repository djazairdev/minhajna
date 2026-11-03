// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspectors' access on the director's PC (#593, #594, answers 621 and
// 622), on the made-up term of grant-term.ts: a request shows its inspector,
// subject, classes and range, its review named for it, and reviewing it shows
// each signed week with its class and teacher and the class with none, and
// closes; the button waits for a fingerprint, a wrong one is said in the page's
// words, and the right one grants, is announced and moves the request to the
// grants made, shown as D-Substitute shows them, with the classes it opens and
// its weeks to their last working day, no access recorded yet, and nothing left
// to finish; once the inspector opens a class, its last access shows; a request
// with no signed week asks nothing, one past its end lapses, and a grant past
// its end shows ended; a grant that has not reached the inspector's phone is
// finished from the card, its button named for it; a problem reading, said only
// off the PC, is gone once the page is read again, and each grant problem has
// the page's words; and once read, the school is listed in its directorate's
// space, saying no request or grant. Every school, class, teacher and device is
// made up.

import { addDays, directorateSpace, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, Platform } from 'react-native';
import { control, disabled, press, said, show, texts, type, unmount } from '../jest/grant-page';
import { grantTerm, LABEL, STAFFED, WEEKS } from '../jest/grant-term';
import { listedAs, schools, SCHOOL } from '../jest/grant-world';
import { MINE, SECOND, signedTerm, TEACHER } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { failed, type Send } from '../src/demo/world-session';
import { accessProblem } from '../src/director/grant-access';
import { approveGrant } from '../src/director/grant-make';
import type { GrantWorld } from '../src/director/grant-session';
import { GrantAccess } from '../src/director/GrantAccess';
import { holdSchool } from '../src/director/issue-session';
import { openGrantClass } from '../src/inspector/grant-read';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';
import { deliveryReading } from '../src/week/school-mine-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.access;
const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce((done, [key, value]) => done.replace(`{{${key}}}`, value), text);
const day = (one: Day) => `day ${one}`;
const row = fill(ar.demo.access.row, {
  label: isolate(LABEL),
  subject: isolate('subject math'),
  classes: ['1م2', '1م3'].map(isolate).join(' · '),
});

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const card = (world: GrantWorld, send: Send = server.send, round = 0) =>
  show(
    <LocaleDirContext.Provider value="rtl">
      <GrantAccess
        world={world}
        school={STAFFED}
        subjectName={(code) => `subject ${code}`}
        workingDays={[0, 1, 2, 3, 4]}
        kit={kit}
        send={send}
        dayText={day}
        round={round}
      />
    </LocaleDirContext.Provider>,
  );

test('in a request’s review a wrong fingerprint is said, and the right one grants it', async () => {
  const { director, fingerprint, ask } = await grantTerm();
  const request = await ask();
  await card(director);
  expect(texts()).toContain(row);
  expect(texts()).toContain(
    fill(words.range, { from: day(request.weeks.from), to: day(request.weeks.to), until: day(request.until) }),
  );
  const named = (testID: string) => (control(testID).props as { name?: string }).name;
  expect(named(`grant-review-${request.id}`)).toBe(fill(words.reviewName, { label: LABEL }));
  await press(`grant-review-${request.id}`);
  await press(`grant-close-${request.id}`);
  expect(texts()).not.toContain(words.opens);
  await press(`grant-review-${request.id}`);
  for (const week of WEEKS)
    expect(texts()).toContain(fill(words.week, { class: isolate('1م2'), teacher: isolate(TEACHER), week: day(week) }));
  expect(texts()).toContain(fill(words.missing, { classes: isolate('1م3') }));
  expect(disabled(`grant-make-${request.id}`)).toBe(true);
  await type(`grant-print-${request.id}`, '0000-0000-0000-0000');
  await press(`grant-make-${request.id}`);
  expect(texts()).toContain(words.wrongPrint);
  await type(`grant-print-${request.id}`, fingerprint);
  await press(`grant-make-${request.id}`);
  expect(said('grant-access-said')).toBe(words.approved);
  expect(texts()).not.toContain(words.wrongPrint);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.made,
      isolate(LABEL),
      fill(words.accessLine, { subject: isolate('subject math'), from: day(WEEKS[0]), to: day(addDays(WEEKS[1], 4)) }),
      isolate('1م2'),
      words.by,
      fill(words.until, { until: day(request.until) }),
      words.noUse,
    ]),
  );
  expect(texts()).not.toContain(['1م2', '1م3'].map(isolate).join(' · '));
  expect(texts()).not.toContain(words.requests);
  expect(texts()).not.toContain(words.notRelayed);
});

test('a grant made shows its last access once the inspector opens a class', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  await openGrantClass(inspector, grant, grant.weeks[0].course, deliveryReading(MINE, [], []), kit, server.send);
  await card(director);
  expect(texts()).toContain(fill(words.lastUse, { day: day(inspector.date) }));
  expect(texts()).not.toContain(words.noUse);
});

test('no signed week asks nothing, a request past its end lapses, and a grant past its end shows ended', async () => {
  const { director, fingerprint, ask } = await grantTerm();
  const none = await ask({ classes: ['1م3'] });
  const granted = await ask();
  await approveGrant(director, STAFFED, granted.id, fingerprint, kit, server.send);
  await card(director);
  await press(`grant-review-${none.id}`);
  expect(texts()).toContain(words.noWeeks);
  expect(texts()).not.toContain(words.fingerprint);
  await card({ ...director, date: addDays(none.until, 1) });
  expect(texts()).toEqual(
    expect.arrayContaining([
      fill(words.lapsed, { until: day(none.until) }),
      fill(words.ended, { until: day(granted.until) }),
    ]),
  );
});

test('a grant that has not reached the inspector’s phone is finished from the card', async () => {
  const { id, director, fingerprint, ask } = await grantTerm();
  const request = await ask();
  const theirs = await directorateSpace(id, SCHOOL.directorateId, kit.mac);
  const send: Send = async (asked) =>
    asked.method === 'POST' && asked.path.includes(theirs)
      ? { status: 503, body: null, retryAfter: null }
      : server.send(asked);
  await expect(approveGrant(director, STAFFED, request.id, fingerprint, kit, send)).rejects.toMatchObject({
    code: 'E_WORLD_SERVER',
  });
  await card(director);
  expect(texts()).toContain(words.notRelayed);
  expect((control(`grant-finish-${request.id}`).props as { name?: string }).name).toBe(
    fill(words.finishName, { label: LABEL }),
  );
  await press(`grant-finish-${request.id}`);
  expect(said('grant-access-said')).toBe(words.finished);
  expect(texts()).not.toContain(words.notRelayed);
});

test('a problem reading is gone once the page is read again', async () => {
  const { director, ask } = await grantTerm();
  await ask();
  let down = true;
  const send: Send = async (asked) => (down ? { status: 503, body: null, retryAfter: null } : server.send(asked));
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await card(director, send);
  expect(texts()).toContain(ar.demo.problem.other);
  expect(announce).not.toHaveBeenCalled();
  down = false;
  await card(director, send, 1);
  expect(texts()).not.toContain(ar.demo.problem.other);
  expect(texts()).toContain(row);
});

test('once read, the school is listed in its directorate’s space', async () => {
  const { id, here } = await signedTerm();
  const desk = await holdSchool(here, kit, server.send);
  await expect(schools(id)).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  await card({ ...here, date: SECOND });
  expect(await listedAs(id, SCHOOL, desk.held.school, server.send)).toBe(desk.held.school);
  expect(texts()).toContain(ar.demo.substitute.noGrant);
});

test('on the phone a problem is announced, and each grant problem has the page’s words', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const { director } = await grantTerm();
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await card(director, () => Promise.resolve({ status: 503, body: null, retryAfter: null }));
  expect(announce).toHaveBeenCalledWith(ar.demo.problem.other);
  const codes = ['E_GRANT_GONE', 'E_GRANT_LAPSED', 'E_GRANT_FINGERPRINT', 'E_GRANT_NO_WEEKS'];
  expect(codes.map((code) => accessProblem(failed('made up', code)))).toEqual([
    'demo.access.gone',
    'demo.access.lapsedRefused',
    'demo.access.wrongPrint',
    'demo.access.noWeeks',
  ]);
});
