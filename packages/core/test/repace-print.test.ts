// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed re-pace draft (#229, answers 367, 371 and 372): the newest
// print after the one the class's last re-pace was approved from, its
// choices found again by key, and a primary approval refused before the
// print day or for other choices. Made-up data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { choiceKey, confirmRepace, printedTicks, repaceDocument, repaceDraft, repacePrinted } from '../src/index.ts';
import { d, primaryEvents } from './fixtures.ts';
import { contextOf, late, printed } from './repace-fixtures.ts';

const day = d('2026-10-15');

describe('the printed re-pace draft', () => {
  it('records only the choices printed, from the day printed', async () => {
    const book = await late(primaryEvents(), day);
    const draft = repaceDraft(contextOf(book), 'c-lang', day, []);
    assert.ok(draft);
    const leave = draft.choices.findIndex((choice) => choiceKey(choice) === 'leave-out:w2');
    assert.ok(leave >= 0);
    assert.equal(repacePrinted(book.state, 'c-lang'), null);
    await printed(book, d('2026-10-12'), 'c-lang');
    await printed(book, d('2026-10-14'), 'c-lang', ['leave-out:w2']);
    const print = repacePrinted(book.state, 'c-lang');
    assert.deepEqual(print, { id: 'pr-2026-10-14', day: d('2026-10-14'), choices: ['leave-out:w2'] });
    assert.deepEqual(print && printedTicks(draft, print), [leave]);
    assert.equal(printedTicks(draft, { id: 'pr-x', day, choices: ['merge:x+y'] }), null);

    const context = contextOf(book);
    const ids = { repace: 'rp-1', decisions: ['dc-1'] };
    const input = { courseId: 'c-lang', ticked: [leave], ids };
    assert.throws(() => confirmRepace(context, { ...input, approved: d('2026-10-13') }, day), /before the print/);
    const none = { ...input, ticked: [], ids: { repace: 'rp-1', decisions: [] }, approved: day };
    assert.throws(() => confirmRepace(context, none, day), /printed choices/);
    await book.recordAll(day, confirmRepace(context, { ...input, approved: d('2026-10-14') }, day));
    assert.equal(book.state.repaces.get('rp-1')?.approved, d('2026-10-14'));
    assert.equal(book.state.repaces.get('rp-1')?.print, 'pr-2026-10-14');
  });

  it('forgets the print approved and those before it, the same day too', async () => {
    const book = await late(primaryEvents(), day);
    await printed(book, d('2026-10-12'), 'c-lang');
    await printed(book, day, 'c-lang');
    await book.recordAll(
      day,
      confirmRepace(
        contextOf(book),
        { courseId: 'c-lang', ticked: [], ids: { repace: 'rp-1', decisions: [] }, approved: day },
        day,
      ),
    );
    assert.equal(book.state.repaces.get('rp-1')?.print, `pr-${day}`);
    assert.equal(repacePrinted(book.state, 'c-lang'), null);
    await book.record(day, {
      kind: 'print.recorded',
      print: { id: 'pr-next', documents: [{ id: repaceDocument('c-lang'), from: day, to: day }] },
    });
    assert.equal(repacePrinted(book.state, 'c-lang')?.id, 'pr-next');
    assert.equal(repacePrinted(book.state, 'c-other'), null);
  });
});
