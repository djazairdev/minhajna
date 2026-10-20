// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import { withDay } from './today-day';

/** Five invented pupils, never data from a real school. */
export async function groupsData() {
  const data = await withDay();
  const names = ['أمينة بن علي', 'محمد الأمين بوزيد', 'إسراء قاسمي', 'يوسف شعبان', 'هبة مرابط'];
  for (const [index, name] of names.entries())
    await data.book.record(parseDay('2026-10-15'), {
      kind: 'pupil.set',
      pupil: {
        id: `example-${index}`,
        classId: 'k-1',
        name,
        sex: index % 2 === 0 ? 'f' : 'm',
        groups: [],
        movements: [],
      },
    });
  return data;
}
