// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which of the phone's schools a delivery fills (answer 808): the one whose
// official code is the delivery's school, said when Settings named another;
// else the one named from Settings; else the only school with no class yet,
// which setup chose; else a new school. The teacher sees which before
// approving: a school the phone chose whose code is another, or with no code
// another name, which the delivery renames; a new school; and a delivery whose
// school is no longer listed, which goes to the school named from Settings or
// to the phone's only school, or nowhere when there is no single one.

import type { School, State, TeacherDelivery } from '@minhajna/core';

type Listed = NonNullable<TeacherDelivery['school']>;

/**
 * How the school was found: `chosen` by its code, or with no code by its name; `elsewhere` by its code when
 * Settings named another; `other` when the phone chose it with another code or name; `new` when the phone adds
 * it; `unlisted` when the delivery's school is not listed.
 */
export type JoinTargetKind = 'chosen' | 'elsewhere' | 'other' | 'new' | 'unlisted';

export interface JoinTarget {
  readonly school: School;
  readonly kind: JoinTargetKind;
}

/** The phone's school `delivery` goes to, or null with none; `named` is the one Settings opened it for. */
export function joinTarget(
  state: State,
  delivery: TeacherDelivery,
  named: string | undefined,
  newId: () => string,
): JoinTarget | null {
  const listed = delivery.school;
  const schools = [...state.schools.values()];
  const matched = listed === null ? undefined : schools.find((school) => school.code === listed.id);
  if (matched !== undefined) {
    return { school: matched, kind: named === undefined || named === matched.id ? 'chosen' : 'elsewhere' };
  }
  const given = named === undefined ? undefined : state.schools.get(named);
  if (given !== undefined) return { school: given, kind: listed === null ? 'unlisted' : kindOf(given, listed) };
  const taught = new Set([...state.classes.values()].map((one) => one.schoolId));
  const empty = schools.filter((school) => !taught.has(school.id));
  const only = empty.length === 1 ? empty[0] : undefined;
  if (listed === null) {
    const school = only ?? (schools.length === 1 ? schools[0] : undefined);
    return school === undefined ? null : { school, kind: 'unlisted' };
  }
  if (only !== undefined) return { school: only, kind: kindOf(only, listed) };
  const fresh: School = { id: newId(), name: listed.name, levels: [listed.level], subjects: [] };
  return { school: fresh, kind: 'new' };
}

/** Whether the phone chose `school` for `listed`: by its code, or by its name when it has none. */
function kindOf(school: School, listed: Listed): JoinTargetKind {
  const same = school.code === undefined ? school.name === listed.name : school.code === listed.id;
  return same ? 'chosen' : 'other';
}
