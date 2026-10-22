// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A week pack's proposals stay in the class's plan week (#230, answer 375):
// a slot with an activity takes that activity's next item of the week, or
// the week's first when none of its type is left, never the next week's,
// each half-group in its own week; and a proposal says its plan week and,
// for an activity of the weekly model, which of the week's sessions of it
// it is. Made-up data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parsePlanPack, Progress, propose, type PlanPack, type SessionRecord } from '../src/index.ts';
import { d } from './fixtures.ts';
import { languagePackSource } from './reference-fixtures.ts';

const slot = { half: 'morning', index: 1 } as const;

const activities = [
  { code: 'reading', name: { en: 'Reading' }, sessions: 2 },
  { code: 'writing', name: { en: 'Writing' }, sessions: 2 },
];

function packWith(model?: typeof activities): PlanPack {
  const read = parsePlanPack({ ...languagePackSource, ...(model && { activities: model }) });
  assert.ok(read.ok);
  return read.value;
}

/** A progress with `ids` taught to their end for the whole class, or for `group`. */
function taught(...ids: string[]): Progress {
  return taughtTo('h-all', ...ids);
}

function taughtTo(groupId: string, ...ids: string[]): Progress {
  const progress = new Progress('h-all', ['h-1', 'h-2']);
  ids.forEach((item, index) => {
    const record: SessionRecord = {
      session: { key: `k-${index}`, courseId: 'c-lang', groupId, day: d('2026-09-20'), slot },
      outcome: 'done',
      sessionType: 'lesson',
      coverage: [{ op: 'taught', item, from: 0, to: 1 }],
    };
    progress.apply(record);
  });
  return progress;
}

const input = (activity?: string) => ({
  queue: 'main' as const,
  groupId: 'h-all',
  sessionMinutes: 45,
  ...(activity !== undefined && { activity }),
});

describe('plan weeks in a week pack', () => {
  it('keeps a slot in the class’s plan week, finishing it before the next', () => {
    const pack = packWith(activities);
    assert.equal(propose(pack, taught(), input('reading'))?.item.id, 'r1');
    assert.equal(propose(pack, taught('r1', 'r2'), input('reading'))?.item.id, 'w1');
    assert.equal(propose(pack, taught('r1', 'r2', 'w1', 'w2'), input('reading'))?.item.id, 's1');
    assert.equal(propose(pack, taught('r1', 'w1', 's1', 'r2', 'w2'), input('reading'))?.item.id, 'r3');
    assert.equal(propose(pack, taught('s1'), input())?.item.id, 'r1');
    assert.equal(propose(pack, taught('r1', 'w1'), input('drawing'))?.item.id, 's1');
  });

  it('keeps each half-group in its own plan week', () => {
    const pack = packWith(activities);
    const progress = taughtTo('h-1', 'r1', 'w1', 's1', 'r2', 'w2');
    assert.equal(propose(pack, progress, { ...input('reading'), groupId: 'h-1' })?.item.id, 'r3');
    assert.deepEqual(propose(pack, progress, { ...input('reading'), groupId: 'h-1' })?.planWeek?.week, 2);
    assert.equal(propose(pack, progress, { ...input('reading'), groupId: 'h-2' })?.item.id, 'r1');
  });

  it('says the plan week, and which of the week’s sessions of the activity this is', () => {
    const pack = packWith(activities);
    assert.deepEqual(propose(pack, taught(), input('reading'))?.planWeek, {
      week: 1,
      activity: { code: 'reading', session: 1, of: 2 },
    });
    assert.deepEqual(propose(pack, taught('r1'), input('reading'))?.planWeek, {
      week: 1,
      activity: { code: 'reading', session: 2, of: 2 },
    });
    assert.deepEqual(propose(pack, taught('r1', 'w1', 'r2', 'w2'), input())?.planWeek, { week: 1 });
    assert.deepEqual(propose(packWith(), taught(), input('reading'))?.planWeek, { week: 1 });
  });
});
