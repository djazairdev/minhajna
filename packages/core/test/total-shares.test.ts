// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school's share of the totals above the school (#555): what a signed
// week gives the totals, read strictly; and the share a school-key device
// prepares from the weeks its teachers signed under the world's CA: only
// the keys the school lists for a course, a new phone's included, each
// week's latest correction, the term's weeks up to the day, each week's
// sums under its own subject and each class under its latest, with its
// latest word on each item, teachers from the assignments, no row for a
// class, and an ID that every device of the school, and only the school's
// key, makes for that day. Every world, school, teacher, class and week is
// made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addHolder,
  certificateRequest,
  issueCertificate,
  newId,
  openKeyring,
  parseDay,
  prepareShare,
  readWeekTotals,
  rekeyKeyring,
  signWeek,
  startKeyring,
  WEEK_FORMAT,
  WEEK_TEXT_BYTES,
  type Certificate,
  type KeySigner,
  type ShareInput,
  type WeekTotals,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { device, opened as openedOf, random, SCHOOL } from './school-devices.ts';

const WORLD = 'K7QF4';
const [from, day] = [parseDay('2026-09-20'), parseDay('2026-12-10')];
const [first, second] = ['2026-10-04', '2026-10-11'];
const NONE = { teachers: 0, vacantPosts: 0, hoursWithoutTeacher: 0 };
const KEY = 'ab'.repeat(32);

const totals = (changes: Partial<WeekTotals> = {}): WeekTotals => ({
  subject: 'math',
  items: [],
  reached: 0,
  runsLong: false,
  covered: 0,
  closed: 0,
  ...changes,
});

function weekText(course: string, week: string, version: number, figures: unknown = totals()): string {
  const sessions = [{ day: week, lesson: 'درس مختلق' }];
  return JSON.stringify({ format: WEEK_FORMAT, course, week, version, totals: figures, sessions });
}

type Teacher = { signer: KeySigner; certificate: Certificate };

async function teacher(ca: KeySigner, world = WORLD): Promise<Teacher> {
  const signer = keySigner();
  const request = await certificateRequest(world, newId(random), signer);
  const certificate = await issueCertificate(request, parseDay('2026-09-20'), newId(random), ca);
  return { signer, certificate };
}

const signed = (by: Teacher, text: string) => signWeek(text, by.certificate, by.signer);

async function school() {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  return { director, opened };
}

function inputOf(opened: ShareInput['school'], ca: KeySigner, changes: Partial<ShareInput> = {}): ShareInput {
  const staffing = {};
  const directorate = '16-east';
  return {
    school: opened,
    day,
    from,
    directorate,
    weeks: [],
    signers: {},
    ca: { world: WORLD, key: ca.publicKey, checker: ca },
    staffing,
    ...changes,
  };
}

describe('the totals a signed week gives', () => {
  const course = newId(random);
  const read = (figures: unknown, text = weekText(course, first, 0, figures)) => readWeekTotals(text);

  it('reads the totals and nothing else of the week', () => {
    const items = [
      { item: 'u1.l1', sessions: 2, outcome: 'taught' },
      { item: 'u1.l2', sessions: 0, outcome: 'merged' },
      { item: 'u1.l3', sessions: 0, outcome: 'skipped' },
    ];
    const week = totals({ items, reached: 125 } as Partial<WeekTotals>);
    assert.deepEqual(read(week), { course, week: first, version: 0, totals: week });
  });

  it('refuses a week whose totals are not shaped as they must be', () => {
    const one = (item: string, sessions: number, outcome: string) => ({ item, sessions, outcome });
    for (const figures of [
      totals({ items: [one('b', 1, 'taught'), one('a', 1, 'taught')] as never }),
      totals({ items: [one('a', 1, 'taught'), one('a', 1, 'retaught')] as never }),
      totals({ items: [one('a', 1, 'skipped')] as never }),
      totals({ items: [one('a', 0, 'taught')] as never }),
      totals({ items: [one('a', 1, 'not-held')] as never }),
      totals({ reached: 1001 }),
      totals({ covered: -1 }),
      totals({ closed: 61 }),
      totals({ subject: 'رياضيات' }),
      { ...totals(), teacher: newId(random) },
      null,
    ]) {
      assert.equal(read(figures), null, JSON.stringify(figures));
    }
    assert.equal(read(totals(), '{"format":'), null);
    assert.equal(read(totals(), weekText(course, first, 0).replace(WEEK_FORMAT, 'minhajna/week/2')), null);
    assert.equal(read(totals(), weekText('a course', first, 0)), null);
    assert.equal(read(totals(), weekText(course, '2026-02-30', 0)), null);
    assert.equal(read(totals(), weekText(course, first, -1)), null);
    const heavy = JSON.stringify({ ...JSON.parse(weekText(course, first, 0)), notes: 'x'.repeat(WEEK_TEXT_BYTES) });
    assert.equal(read(totals(), heavy), null);
  });
});

describe('a school’s share of the totals', () => {
  it('adds up each course’s own latest weeks in the term, by subject, with no row for one', async () => {
    const { director, opened } = await school();
    const ca = keySigner();
    const [a, b, c, stranger] = [await teacher(ca), await teacher(ca), await teacher(ca), await teacher(ca)];
    const renewed = keySigner();
    const request = await certificateRequest(WORLD, newId(random), renewed);
    const phone = { signer: renewed, certificate: await issueCertificate(request, from, newId(random), ca) };
    const theirs = keySigner();
    const claimed = await certificateRequest(WORLD, a.certificate.subject, theirs);
    const impostor = { signer: theirs, certificate: await issueCertificate(claimed, from, newId(random), ca) };
    const [one, two, three] = [newId(random), newId(random), newId(random)];
    const item = (name: string, sessions: number, outcome = 'taught') => ({ item: name, sessions, outcome });
    const week = (course: string, on: string, version: number, changes: Partial<WeekTotals>) =>
      weekText(course, on, version, totals(changes));
    const weeks = [
      await signed(a, week(one, first, 0, { items: [item('u1.l1', 2)] as never, reached: 90, covered: 5 })),
      await signed(a, week(one, first, 1, { items: [item('u1.l1', 3), item('u1.l2', 0, 'merged')] as never })),
      await signed(
        a,
        week(one, second, 0, { items: [item('u1.l2', 1, 'retaught')] as never, reached: 250, runsLong: true }),
      ),
      await signed(stranger, week(one, second, 99, { covered: 50, reached: 1000 })),
      await signed(stranger, week(one, '2025-01-05', 0, { subject: 'music', covered: 50 })),
      await signed(stranger, week(one, second, 100, { subject: 'music', reached: 999 })),
      await signed(impostor, week(one, second, 101, { subject: 'music', reached: 999 })),
      await signed(phone, week(two, second, 0, { reached: 300, closed: 1 })),
      await signed(a, JSON.stringify({ ...JSON.parse(week(one, second, 7, {})), notes: 'x'.repeat(WEEK_TEXT_BYTES) })),
      await signed(
        b,
        week(two, first, 0, {
          items: [item('u1.l1', 2), item('u1.l3', 0, 'skipped')] as never,
          reached: 150,
          closed: 2,
          covered: 1,
        }),
      ),
      await signed(c, week(three, first, 0, { subject: 'history', closed: 3 })),
      await signed(c, week(three, second, 0, { subject: 'arabic', reached: 400 })),
      await signed(c, week(three, '2026-09-13', 0, { subject: 'arabic', covered: 9 })),
      await signed(c, week(three, '2026-12-13', 0, { subject: 'arabic', covered: 9 })),
      await signed(c, JSON.stringify({ format: 'something else', course: three, week: second, version: 0 })),
      { ...(await signed(c, week(newId(random), second, 0, { covered: 9 }))), text: weekText(three, second, 1) },
      await signed(await teacher(keySigner()), week(newId(random), second, 0, { covered: 9 })),
      'not a week',
    ];
    const staffing = {
      math: { teachers: 2, vacantPosts: 1, hoursWithoutTeacher: 4 },
      music: { teachers: 0, vacantPosts: 2, hoursWithoutTeacher: 8 },
    };
    const subject = (one: Teacher) => one.signer.publicKey;
    const signers = { [one]: [subject(a)], [two]: [subject(b), subject(phone)], [three]: [subject(c)] };
    const share = await prepareShare(inputOf(opened, ca, { weeks, staffing, signers }), director.crypto);
    assert.match(share.id, /^[0-9a-f]{64}$/u);
    const empty = { classes: 0, cover: 0, closed: 0, reached: 0, runLong: 0, items: {} };
    assert.deepEqual(share, {
      format: 'minhajna/total-share/1',
      id: share.id,
      day,
      directorate: '16-east',
      subjects: {
        arabic: { ...NONE, ...empty, classes: 1, reached: 400 },
        history: { ...NONE, ...empty, closed: 3 },
        math: {
          ...staffing.math,
          classes: 2,
          cover: 1,
          closed: 3,
          reached: 550,
          runLong: 1,
          items: {
            'u1.l1': { sessions: 5, merged: 0, skipped: 0, retaught: 0 },
            'u1.l2': { sessions: 1, merged: 0, skipped: 0, retaught: 1 },
            'u1.l3': { sessions: 0, merged: 0, skipped: 1, retaught: 0 },
          },
        },
        music: { ...staffing.music, ...empty },
      },
    });
    for (const named of [a.certificate.subject, one, three]) assert.equal(JSON.stringify(share).includes(named), false);
    const reversed = await prepareShare(
      inputOf(opened, ca, { weeks: [...weeks].reverse(), staffing, signers }),
      director.crypto,
    );
    assert.deepEqual(reversed, share);
  });

  it('settles two corrections of one version alike, and counts weeks across the term’s edges', async () => {
    const { director, opened } = await school();
    const ca = keySigner();
    const a = await teacher(ca);
    const [one, two] = [newId(random), newId(random)];
    const twins = [
      await signed(a, weekText(one, first, 1, totals({ reached: 100 }))),
      await signed(a, weekText(one, first, 1, totals({ reached: 200 }))),
    ];
    const edges = [
      await signed(a, weekText(two, '2026-09-14', 0, totals({ closed: 1 }))),
      await signed(a, weekText(two, '2026-12-06', 0, totals({ closed: 2, reached: 700 }))),
    ];
    const signers = { [one]: [a.signer.publicKey], [two]: [a.signer.publicKey] };
    const share = (weeks: unknown[]) => prepareShare(inputOf(opened, ca, { weeks, signers }), director.crypto);
    const kept = twins[0]!.signature < twins[1]!.signature ? 100 : 200;
    for (const order of [twins, [...twins].reverse()]) {
      assert.equal((await share([...order, ...edges])).subjects['math']!.reached, kept + 700);
    }
    assert.equal((await share(edges)).subjects['math']!.closed, 3);
  });

  it('names the share for its school and day only, on every device of the school and after a rekey', async () => {
    const { director, opened } = await school();
    const ca = keySigner();
    const share = (changes?: Partial<ShareInput>) => prepareShare(inputOf(opened, ca, changes), director.crypto);
    const { id } = await share();
    const rekeyed = await rekeyKeyring(opened, director.holder.id, director.crypto, random);
    assert.equal((await share({ school: rekeyed })).id, id);
    const deputy = await device();
    const added = await addHolder(rekeyed, deputy.holder, director.holder.id, director.crypto);
    const theirs = openedOf(await openKeyring(added.ring, deputy.holder.id, deputy.crypto));
    assert.equal((await prepareShare(inputOf(theirs, ca), deputy.crypto)).id, id);
    assert.notEqual((await share({ day: parseDay('2026-12-11') })).id, id);
    const other = await school();
    assert.notEqual((await prepareShare(inputOf(other.opened, ca), other.director.crypto)).id, id);
    assert.deepEqual((await share()).subjects, {});

    await assert.rejects(share({ directorate: 'مديرية' }), /directorate/);
    await assert.rejects(share({ from: parseDay('2026-12-11') }), /term/);
    await assert.rejects(share({ day: '2026-13-01' as never }), /term/);
    for (const signers of [
      { 'a course': [] },
      { [newId(random)]: [newId(random)] },
      { [newId(random)]: [[KEY]] },
      null,
    ]) {
      await assert.rejects(share({ signers: signers as never }), /Signers/, JSON.stringify(signers));
    }
    await assert.rejects(share({ staffing: null as never }), /Staffing/);
    for (const staffing of [
      { math: { ...NONE, vacantPosts: -1 } },
      { math: { vacantPosts: 1, hoursWithoutTeacher: 0 } },
      { math: null },
      { 'a subject': NONE },
    ]) {
      await assert.rejects(share({ staffing: staffing as never }), /Staffing/, JSON.stringify(staffing));
    }
  });
});
