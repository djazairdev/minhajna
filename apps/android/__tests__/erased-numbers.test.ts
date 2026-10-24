// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A pupil whose data was erased keeps their place on the class list (#248,
// answer 473): no other pupil's number changes, on the list or in the
// activity log's corrections, a pupil who joins later takes the next number,
// and the log says the erasure in one line. Made-up records only.

import { activityLog, parseDay, type RecordEvent, type RollCall } from '@minhajna/core';
import { withPupils, unitKey } from '../jest/roll-class';
import { itemText, type LogNames } from '../src/log/log-text';
import { listNumbers } from '../src/roll/roll-rules';
import { i18n } from '../src/text/i18n';

const t = i18n.t.bind(i18n);
const DAY = parseDay('2026-10-15');
const ERASED_ON = parseDay('2026-10-16');

const rollCall = (late: string[]): RollCall => ({
  unit: unitKey(1),
  classId: 'k-1',
  groupId: 'k-1-w',
  day: DAY,
  half: 'morning',
  absent: [{ pupilId: 'p-2', justified: true }],
  late,
});

test('the others keep their numbers once a pupil’s data is erased, and the log says it in one line', async () => {
  const data = await withPupils();
  await data.book.recordAll(DAY, [
    { kind: 'roll-call.taken', rollCall: rollCall(['p-5']) },
    { kind: 'roll-call.taken', rollCall: rollCall([]), reason: 'entry-error' },
  ]);
  const names = (): LogNames => ({ state: data.book.state, profile: data.profile, lang: 'ar' });
  const lines = () => activityLog(data.book.entries).map((day) => day.items.map((item) => itemText(t, names(), item)));
  const before = listNumbers(data.book, 'k-1');
  const corrected = lines();
  expect(corrected.flat().map((one) => one.text)).toEqual([expect.stringContaining('التلميذ 5: ')]);

  await data.book.record(ERASED_ON, {
    kind: 'pupil.moved',
    pupilId: 'p-2',
    movement: { day: DAY, kind: 'out', reason: 'transfer', confirmed: true },
  });
  await data.book.erasePupil(ERASED_ON, 'p-2');
  const after = listNumbers(data.book, 'k-1');
  expect(after.has('p-2')).toBe(false);
  expect([...after]).toEqual([...before].filter(([id]) => id !== 'p-2'));
  expect(lines()).toEqual([[{ tag: t('log.tabs.erasures'), text: 'حُذفت بيانات تلميذ · دون محتواها' }], ...corrected]);

  const joining: RecordEvent = {
    kind: 'pupil.set',
    pupil: {
      id: 'p-new',
      classId: 'k-1',
      name: 'تلميذ جديد (مثال)',
      sex: 'm',
      groups: [],
      movements: [{ day: ERASED_ON, kind: 'in', reason: 'transfer' }],
    },
  };
  await data.book.record(ERASED_ON, joining);
  expect(listNumbers(data.book, 'k-1').get('p-new')).toBe(before.size + 1);
});
