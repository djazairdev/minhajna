// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Schools in the directory over HTTP (answers 807 to 809): a school's book
// under its own code, the joining codes it issues, and what a teacher receives
// for one. Every school, code and name here is made up.

import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { readTeacherDelivery } from '../src/directory/core/directory-book.js';
import { BOOK, DirectoryServer, DRAFT, LIST_CODE, SCHOOL, SCHOOL_CODE, withoutSecond } from './directory-kit.js';

describe('schools in the directory over HTTP', () => {
  const server = new DirectoryServer();
  const { ask, published, saved } = server;

  beforeEach(() => server.open());

  after(() => server.close());

  it('knows only the schools in the published list', async () => {
    assert.equal((await ask('GET', `schools/${SCHOOL}/claimed`)).status, 404);
    await published();
    assert.equal((await ask('GET', 'schools/sch-99/claimed')).status, 404);
    assert.equal((await ask('GET', 'schools/not$a$code/claimed')).status, 404);
    assert.equal((await ask('POST', 'schools/sch-99/code', { code: SCHOOL_CODE })).status, 404);
    assert.equal((await ask('GET', 'schools/sch-99/book', undefined, SCHOOL_CODE)).status, 404);
    assert.deepEqual((await ask('GET', `schools/${SCHOOL}/claimed`)).body, { claimed: true });
    assert.deepEqual((await ask('GET', 'schools/sch-02/claimed')).body, { claimed: false });
    const smaller = { levels: DRAFT.levels, schools: DRAFT.schools.slice(1) };
    await ask('PUT', 'reference/draft', { expected: 1, draft: smaller }, LIST_CODE);
    await ask('POST', 'reference/publish', { expected: 2 }, LIST_CODE);
    assert.equal((await ask('GET', `schools/${SCHOOL}/book`, undefined, SCHOOL_CODE)).status, 404);
  });

  it('guards a school’s book with the school’s own code', async () => {
    await published();
    assert.equal((await ask('POST', `schools/${SCHOOL}/code`, { code: 'another-code' })).status, 403);
    assert.equal((await ask('GET', `schools/${SCHOOL}/book`)).status, 403);
    assert.equal((await ask('GET', `schools/${SCHOOL}/book`, undefined, LIST_CODE)).status, 403);
    assert.equal((await ask('GET', 'schools/sch-02/book', undefined, SCHOOL_CODE)).status, 403);
    assert.equal((await ask('PUT', `schools/${SCHOOL}/book`, { expected: 0, book: BOOK }, 'wrong-code')).status, 403);
    assert.equal((await ask('POST', `schools/${SCHOOL}/teachers/t-1/code`, undefined, 'wrong-code')).status, 403);
    assert.deepEqual((await ask('GET', `schools/${SCHOOL}/book`, undefined, SCHOOL_CODE)).body, {
      revision: 0,
      book: { format: 1, teachers: [], classes: [], week: [] },
    });
  });

  it('issues each teacher’s joining code, keeps it, and ignores one the client sends', async () => {
    await published();
    const path = `schools/${SCHOOL}/book`;
    const bad = await ask('PUT', path, { expected: 0, book: { format: 1 } }, SCHOOL_CODE);
    assert.deepEqual([bad.status, bad.body['message']], [400, 'a school book needs teachers, classes and a week']);
    const twice = { ...BOOK, teachers: [BOOK.teachers[0], BOOK.teachers[0]] };
    assert.equal((await ask('PUT', path, { expected: 0, book: twice }, SCHOOL_CODE)).body['statusCode'], 400);
    const late = { ...BOOK, week: [{ ...BOOK.week[0]!, slot: { half: 'morning', index: 6 } }] };
    const refused = await ask('PUT', path, { expected: 0, book: late }, SCHOOL_CODE);
    assert.deepEqual([refused.status, refused.body['message']], [400, "session s-1 is past the day's last slot"]);
    const first = await ask('PUT', path, { expected: 0, book: BOOK }, SCHOOL_CODE);
    assert.equal(first.body['revision'], 1);
    const teachers = (first.body['book'] as typeof BOOK).teachers;
    for (const { code } of teachers) assert.match(code!, /^(?:[0-9A-HJKMNP-TV-Z]{4}-){3}[0-9A-HJKMNP-TV-Z]{4}$/);
    assert.equal((await ask('PUT', path, { expected: 0, book: BOOK }, SCHOOL_CODE)).status, 409);
    const sent = {
      ...BOOK,
      teachers: BOOK.teachers.map((one, at) => ({ ...one, code: at === 0 ? 'SENT BY CLIENT' : 'SENT-BY-CLIENT' })),
    };
    const second = await ask('PUT', path, { expected: 1, book: sent }, SCHOOL_CODE);
    assert.deepEqual(second.body['book'], { ...BOOK, teachers });
    assert.deepEqual((await ask('GET', path, undefined, SCHOOL_CODE)).body, second.body);
    assert.equal((await ask('POST', 'join', { code: 'SENT-BY-CLIENT' })).status, 404);
  });

  it('gives a teacher only their own classes and sessions, however the code is typed', async () => {
    const [first, second] = await saved();
    const joined = await ask('POST', 'join', { code: first!.toLowerCase().replaceAll('-', ' ') });
    assert.equal(joined.status, 200);
    assert.deepEqual(joined.body, {
      format: 1,
      school: DRAFT.schools[0],
      teacher: { id: 't-1', name: BOOK.teachers[0]!.name, option: 'math' },
      classes: [{ id: 'c-1', grade: '1am', name: BOOK.classes[0]!.name, pupils: BOOK.classes[0]!.pupils }],
      sessions: [BOOK.week[0]],
    });
    assert.deepEqual(readTeacherDelivery(joined.body), joined.body);
    for (const code of [first!, second!]) assert.equal(JSON.stringify(joined.body).includes(code), false);
    const other = await ask('POST', 'join', { code: second!.replaceAll('-', '') });
    assert.deepEqual(
      (other.body['sessions'] as { id: string }[]).map(({ id }) => id),
      ['s-2', 's-3'],
    );
    assert.equal((await ask('POST', 'join', { code: first })).status, 200);
  });

  it('answers any code that opens nothing the same, and a body with no code 400', async () => {
    await saved();
    const unknown = await ask('POST', 'join', { code: '0000-0000-0000-0000' });
    const shapeless = await ask('POST', 'join', { code: 'not a code at all' });
    assert.deepEqual([unknown.status, unknown.body], [shapeless.status, shapeless.body]);
    assert.equal(unknown.status, 404);
    assert.equal((await ask('POST', 'join', {})).status, 400);
  });

  it('renews a code, the old one stopping, and answers 404 for a teacher the book lacks', async () => {
    const [first] = await saved();
    const path = `schools/${SCHOOL}/teachers/t-1/code`;
    const renewed = await ask('POST', path, undefined, SCHOOL_CODE);
    assert.equal(renewed.status, 200);
    const code = renewed.body['code'] as string;
    assert.notEqual(code, first);
    assert.equal((await ask('POST', 'join', { code: first })).status, 404);
    assert.equal((await ask('POST', 'join', { code })).status, 200);
    assert.equal((await ask('POST', `schools/${SCHOOL}/teachers/t-9/code`, undefined, SCHOOL_CODE)).status, 404);
    const kept = (await ask('GET', `schools/${SCHOOL}/book`, undefined, SCHOOL_CODE)).body;
    assert.equal(kept['revision'], 1);
    assert.equal((kept['book'] as typeof BOOK).teachers[0]!.code, code);
  });

  it('ends the code of a teacher taken off the book', async () => {
    const [, second] = await saved();
    await ask('PUT', `schools/${SCHOOL}/book`, { expected: 1, book: withoutSecond(BOOK) }, SCHOOL_CODE);
    assert.equal((await ask('POST', 'join', { code: second })).status, 404);
  });

  it('still delivers for a school dropped from the list, naming no school', async () => {
    const [first] = await saved();
    const smaller = { levels: DRAFT.levels, schools: DRAFT.schools.slice(1) };
    await ask('PUT', 'reference/draft', { expected: 1, draft: smaller }, LIST_CODE);
    await ask('POST', 'reference/publish', { expected: 2 }, LIST_CODE);
    const joined = await ask('POST', 'join', { code: first });
    assert.equal(joined.status, 200);
    assert.equal(joined.body['school'], null);
  });
});
