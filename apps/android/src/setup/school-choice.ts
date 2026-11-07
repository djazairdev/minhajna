// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What setup's selects offer from the directory's reference list (answers 802
// to 809): a level, then that level's options, then the wilayas with a school
// at that level, the communes of the chosen wilaya with one, and the schools
// of that commune at that level. Nothing is typed. The chosen school becomes
// the teacher's school: its directory ID as its code, its name, the one level,
// the option's subjects and the wilaya as its zone, keeping what the teacher
// set on it before, as its bell times. School data never comes with it: that
// arrives only through the school's joining code (answer 808).

import type {
  CountryProfile,
  DirectoryOption,
  DirectorySchool,
  LocalizedText,
  ReferenceList,
  School,
} from '@minhajna/core';
import { currentLanguage, type useText } from '../text/i18n';
import type { SelectOption } from '../components/Select';
import { levelName, localized } from './names';
import { zoneLabel } from './ZonePicker';

type Translate = ReturnType<typeof useText>;

/** The teacher's choices so far, each one emptied when an earlier one changes. */
export interface Choice {
  readonly level: string | null;
  readonly option: string | null;
  readonly wilaya: string | null;
  readonly commune: string | null;
  readonly school: string | null;
}

export const NO_CHOICE: Choice = { level: null, option: null, wilaya: null, commune: null, school: null };

const ORDER = ['level', 'option', 'wilaya', 'commune', 'school'] as const;

/** The choice with one field set and every later one emptied. */
export function choose(choice: Choice, field: keyof Choice, value: string): Choice {
  if (choice[field] === value) return choice;
  const at = ORDER.indexOf(field);
  const later = Object.fromEntries(ORDER.slice(at + 1).map((key) => [key, null]));
  return { ...choice, ...later, [field]: value };
}

const byName = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label, currentLanguage());

const atLevel = (list: ReferenceList, level: string | null) => list.schools.filter((one) => one.level === level);

/** Whether a list offers anything to choose: a level with options and at least one school. */
export function hasChoices(list: ReferenceList): boolean {
  return list.levels.some((level) => level.options.length > 0 && atLevel(list, level.code).length > 0);
}

/** The levels with options and at least one school, in the list's order. */
export function levelOptions(t: Translate, profile: CountryProfile, list: ReferenceList): SelectOption[] {
  return list.levels
    .filter((level) => level.options.length > 0 && atLevel(list, level.code).length > 0)
    .map((level) => ({ value: level.code, label: levelName(t, profile, level.code) }));
}

/** An option's name: the class teacher's words, or its subjects' names, a pair's both. */
export function optionName(t: Translate, profile: CountryProfile, option: DirectoryOption): string {
  if (option.classTeacher === true) return t('setup.classTeacher');
  const names = option.subjects.map((code) => {
    const subject = profile.subjects.find((one) => one.code === code);
    return subject === undefined ? code : localized(subject.name);
  });
  if (names.length === 2) return t('setup.pair', { first: names[0], second: names[1] });
  return names.join(currentLanguage() === 'ar' ? '\u060C ' : ', ');
}

/** The chosen level's options, in the list's order. */
export function optionOptions(
  t: Translate,
  profile: CountryProfile,
  list: ReferenceList,
  level: string | null,
): SelectOption[] {
  const options = list.levels.find((one) => one.code === level)?.options ?? [];
  return options.map((option) => ({ value: option.code, label: optionName(t, profile, option) }));
}

/** The wilayas with a school at the chosen level, named by the profile, in its order. */
export function wilayaOptions(profile: CountryProfile, list: ReferenceList, level: string | null): SelectOption[] {
  const codes = new Set(atLevel(list, level).map((one) => one.wilaya));
  const named = (profile.zones ?? []).filter((zone) => codes.has(zone.code));
  const unnamed = [...codes].filter((code) => !named.some((zone) => zone.code === code)).sort();
  return [
    ...named.map((zone) => ({ value: zone.code, label: zoneLabel(zone) })),
    ...unnamed.map((code) => ({ value: code, label: code })),
  ];
}

/** A commune's name in the interface language; English reads the French name when it has none of its own. */
export function communeName(name: LocalizedText): string {
  return name[currentLanguage()] ?? (currentLanguage() === 'en' ? name.fr : undefined) ?? localized(name);
}

/** The chosen wilaya's communes with a school at the chosen level, but those whose every such school is held. */
export function communeOptions(
  list: ReferenceList,
  level: string | null,
  wilaya: string | null,
  held: readonly string[] = [],
): SelectOption[] {
  const seen = new Map<string, string>();
  for (const one of atLevel(list, level)) {
    if (held.includes(one.id)) continue;
    if (one.wilaya === wilaya && !seen.has(one.commune.code)) seen.set(one.commune.code, communeName(one.commune.name));
  }
  return [...seen].map(([value, label]) => ({ value, label })).sort(byName);
}

function schoolsIn(list: ReferenceList, choice: Choice): DirectorySchool[] {
  return atLevel(list, choice.level).filter(
    (one) => one.wilaya === choice.wilaya && one.commune.code === choice.commune,
  );
}

/** The chosen commune's schools at the chosen level, by name, but those the teacher already holds as another school. */
export function schoolOptions(list: ReferenceList, choice: Choice, held: readonly string[] = []): SelectOption[] {
  return schoolsIn(list, choice)
    .filter((one) => !held.includes(one.id))
    .map((one) => ({ value: one.id, label: one.name }))
    .sort(byName);
}

/** The school the choice names, once every field is chosen and still in the list. */
export function chosenSchool(
  list: ReferenceList,
  choice: Choice,
): { readonly school: DirectorySchool; readonly option: DirectoryOption } | null {
  const school = schoolsIn(list, choice).find((one) => one.id === choice.school);
  const level = list.levels.find((one) => one.code === choice.level);
  const option = level?.options.find((one) => one.code === choice.option);
  return school === undefined || option === undefined ? null : { school, option };
}

/**
 * The teacher's school from the choice, keeping its ID, and what else the teacher set on it, as its bell times, while
 * it stays the same school: one chosen again, or one typed in an earlier version, which had no code.
 */
export function schoolFrom(
  chosen: { readonly school: DirectorySchool; readonly option: DirectoryOption },
  id: string,
  before?: School,
): School {
  const same = before !== undefined && (before.code === undefined || before.code === chosen.school.id);
  return {
    ...(same && before),
    id,
    code: chosen.school.id,
    name: chosen.school.name,
    levels: [chosen.school.level],
    subjects: [...chosen.option.subjects],
    zone: chosen.school.wilaya,
  };
}

/**
 * The choice an existing school was made from, when its directory school is still in the list. The option is the
 * largest whose subjects open the school's own, as the chosen subjects come before those kept for classes
 * (school-guards.ts); failing that, as for a history in another order, the largest whose subjects it all teaches.
 */
export function choiceOf(list: ReferenceList, school: School | undefined): Choice {
  const listed = list.schools.find((one) => one.id === school?.code);
  if (school === undefined || listed === undefined) return NO_CHOICE;
  const level = list.levels.find((one) => one.code === listed.level);
  const options = level?.options ?? [];
  const leading = (one: DirectoryOption) => {
    const start = school.subjects.slice(0, one.subjects.length);
    return one.subjects.length === start.length && one.subjects.every((code) => start.includes(code));
  };
  const option =
    options.filter(leading).sort((a, b) => b.subjects.length - a.subjects.length)[0] ??
    options
      .filter((one) => one.subjects.every((code) => school.subjects.includes(code)))
      .sort((a, b) => b.subjects.length - a.subjects.length)[0];
  return {
    level: listed.level,
    option: option?.code ?? null,
    wilaya: option === undefined ? null : listed.wilaya,
    commune: option === undefined ? null : listed.commune.code,
    school: option === undefined ? null : listed.id,
  };
}

/** Whether recording this school would change nothing the history holds. */
export function unchanged(school: School, before: School | undefined): boolean {
  if (before === undefined) return false;
  const keys = new Set([...Object.keys(school), ...Object.keys(before)]);
  return [...keys].every(
    (key) => JSON.stringify(school[key as keyof School]) === JSON.stringify(before[key as keyof School]),
  );
}
