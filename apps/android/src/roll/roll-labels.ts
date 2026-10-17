// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Words for a roll call: its time from the school's bells, from the first
// session to the last, and a pupil's mark.

import type { BellData, CalendarEntry, PupilMark, RollCallUnit, State } from '@minhajna/core';
import type { useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { sessionTime } from '../times/times-rules';

type Translate = ReturnType<typeof useText>;

/** «⁧08:00 – 09:00⁩», or null where the bells give no time. */
export function unitTime(
  data: { readonly state: State; readonly bells: BellData; readonly calendar: readonly CalendarEntry[] },
  unit: RollCallUnit,
  direction: 'rtl' | 'ltr',
): string | null {
  const schoolClass = data.state.classes.get(unit.classId);
  const school = schoolClass && data.state.schools.get(schoolClass.schoolId);
  const first = unit.sessions[0];
  const last = unit.sessions.at(-1);
  const from = first && sessionTime(data, school, first.slot, unit.day);
  const to = last && sessionTime(data, school, last.slot, unit.day);
  return from == null || to == null ? null : span(from.from, to.to, direction);
}

/** «غياب غير مبرر», «تأخر، لا يُحسب غياباً». */
export function markWords(t: Translate, mark: PupilMark): string {
  return t(`correct.marks.${mark}`);
}
