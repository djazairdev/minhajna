// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's update from Settings (answer 808): it fetches with the kept
// code at once, shows only what changes (new classes, pupils leaving, classes
// no longer given, a changed week, or that names changed), says when nothing
// is new, and keeps no second copy of the same code. Made-up data only.

import type { TeacherDelivery } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { MADE_UP_CODE, MADE_UP_DELIVERY, serveJoin } from '../jest/directory-join';
import {
  CHOSEN,
  closeJoin,
  joinRoot,
  onDone,
  press,
  showJoin,
  shown,
  typeCode,
  withId,
  withSchools,
} from '../jest/join-screen';
import text from '../src/text/ar.json';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await closeJoin();
  jest.restoreAllMocks();
});

const keptCodes = (data: TestData) =>
  data.book.entries.filter((entry) => JSON.stringify(entry).includes('directory.joined')).length;

async function joined(): Promise<TestData> {
  serveJoin();
  const data = await withSchools(CHOSEN);
  await showJoin(data);
  await typeCode(MADE_UP_CODE);
  await press('join-next');
  await press('join-approve');
  await closeJoin();
  jest.restoreAllMocks();
  return data;
}

test('fetches with the kept code and says when nothing is new', async () => {
  const data = await joined();
  const join = serveJoin();
  await showJoin(data, 's-1');
  expect(join).toHaveBeenCalledWith('/directory/join', { code: '7K2M9Q4RX8ZT3HN6' }, undefined, expect.anything());
  expect(withId('join-code')).toEqual([]);
  expect(withId('join-nothing')).toHaveLength(1);
  expect(withId('join-approve')).toEqual([]);
  expect(accessibilityProblems(joinRoot())).toEqual([]);
  await press('join-cancel');
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('shows only what changes, and applies it without keeping the code again', async () => {
  const data = await joined();
  const [c1, c2] = MADE_UP_DELIVERY.classes;
  const changed: TeacherDelivery = {
    ...MADE_UP_DELIVERY,
    classes: [
      { ...c1, pupils: [c1.pupils[0]] },
      { id: 'c3', grade: '1am', name: '1م3', pupils: [{ id: 'p1', name: 'تلميذ رابع', sex: 'm' }] },
    ],
    sessions: [
      MADE_UP_DELIVERY.sessions[0],
      { id: 's3', classId: 'c3', subject: 'arabic', weekday: 2, slot: { half: 'morning', index: 3 } },
    ],
  };
  serveJoin(changed);
  await showJoin(data, 's-1');
  const t = i18n.t.bind(i18n);
  expect(shown()).toEqual(
    expect.arrayContaining([
      '\u20681م3\u2069 · تلميذ واحد',
      t('join.leaving', { pupils: t('setup.pupils', { count: 1 }) }),
      t('join.dropped', { classes: `\u2068${c2.name}\u2069` }),
      t('join.week', { sessions: t('week.sessions', { count: 2 }) }),
    ]),
  );
  expect(shown()).not.toContain('\u20681م1\u2069 · تلميذ واحد');
  expect(shown()).toContain(text.join.apply);
  await press('join-approve');
  expect(data.book.state.classes.size).toBe(3);
  expect(keptCodes(data)).toBe(1);
});

test('says when only names changed', async () => {
  const data = await joined();
  const [c1, c2] = MADE_UP_DELIVERY.classes;
  serveJoin({ ...MADE_UP_DELIVERY, classes: [{ ...c1, name: '1م1 أ' }, c2] });
  await showJoin(data, 's-1');
  expect(withId('join-details')).toHaveLength(1);
  expect(withId('join-approve')).toHaveLength(1);
});
