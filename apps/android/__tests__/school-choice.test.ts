// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind setup's school selects (answers 802 to 809): choosing a
// value empties only what follows, and choosing the same one changes nothing;
// each select offers only what the list holds there, and the schools held as
// another are left out; a school vanished from the list, or an option no
// longer offered, chooses nothing; the chosen school keeps the ID, and the
// bell times only while it stays the same school. The list is made up.

import { bundledReference, readReference } from '../src/reference';
import { MADE_UP_LIST } from '../jest/directory-list';
import {
  choiceOf,
  choose,
  chosenSchool,
  communeName,
  communeOptions,
  hasChoices,
  NO_CHOICE,
  optionName,
  schoolFrom,
  schoolOptions,
  unchanged,
  wilayaOptions,
  type Choice,
} from '../src/setup/school-choice';
import { i18n } from '../src/text/i18n';

const reference = readReference(bundledReference);
if (!reference.ok) throw new Error('The bundled reference data is refused');
const { profile } = reference;
const t = i18n.t.bind(i18n) as never;
const FULL: Choice = { level: 'cem', option: 'arabic', wilaya: '16', commune: '1601', school: 'cem-16-1' };

afterEach(() => i18n.changeLanguage('ar'));

test('choosing empties what follows, and the same value changes nothing', () => {
  expect(choose(FULL, 'level', 'cem')).toBe(FULL);
  expect(choose(FULL, 'wilaya', '07')).toEqual({ ...FULL, wilaya: '07', commune: null, school: null });
  expect(choose(NO_CHOICE, 'level', 'primary')).toEqual({ ...NO_CHOICE, level: 'primary' });
});

test('offers the wilayas with a school at the level, and the schools but those held', () => {
  expect(wilayaOptions(profile, MADE_UP_LIST, 'cem').map((one) => one.value)).toEqual(['07', '16']);
  expect(wilayaOptions(profile, MADE_UP_LIST, 'lycee')).toEqual([]);
  expect(communeOptions(MADE_UP_LIST, 'cem', '16').map((one) => one.value)).toEqual(['1601']);
  expect(schoolOptions(MADE_UP_LIST, FULL, ['cem-16-1']).map((one) => one.value)).toEqual(['cem-16-2']);
  expect(communeOptions(MADE_UP_LIST, 'cem', '07', ['cem-07-1'])).toEqual([]);
});

test('a list with no school, or no option, offers nothing to choose', () => {
  expect(hasChoices(MADE_UP_LIST)).toBe(true);
  expect(hasChoices({ ...MADE_UP_LIST, schools: [] })).toBe(false);
  expect(hasChoices({ ...MADE_UP_LIST, levels: MADE_UP_LIST.levels.map((one) => ({ ...one, options: [] })) })).toBe(
    false,
  );
});

test('a vanished school or option chooses nothing', () => {
  expect(chosenSchool(MADE_UP_LIST, FULL)?.school.id).toBe('cem-16-1');
  expect(chosenSchool(MADE_UP_LIST, { ...FULL, school: 'cem-16-9' })).toBeNull();
  expect(chosenSchool(MADE_UP_LIST, { ...FULL, option: 'music' })).toBeNull();
  expect(chosenSchool(MADE_UP_LIST, { ...FULL, wilaya: '07' })).toBeNull();
});

test('names the class teacher, a pair, and three subjects', async () => {
  const [classTeacher] = MADE_UP_LIST.levels[0].options;
  expect(optionName(t, profile, classTeacher)).toBe(i18n.t('setup.classTeacher'));
  await i18n.changeLanguage('en');
  expect(optionName(t, profile, { code: 'p', subjects: ['arabic', 'islamic'] })).toMatch(/ and /u);
  expect(optionName(t, profile, { code: 'p', subjects: ['arabic', 'islamic', 'math'] }).split(', ')).toHaveLength(3);
  expect(communeName({ ar: 'بلدية', fr: 'Commune' })).toBe('Commune');
});

test('keeps the ID always, and the bell times only for the same school or one typed before', () => {
  const chosen = chosenSchool(MADE_UP_LIST, FULL)!;
  const bells = { times: [] } as never;
  const typed = { id: 's-1', name: 'مدرسة مكتوبة', levels: ['cem'], subjects: ['arabic'], bells };
  expect(schoolFrom(chosen, 's-1', typed)).toMatchObject({ id: 's-1', code: 'cem-16-1', bells });
  const other = { ...typed, code: 'cem-16-2' };
  expect(schoolFrom(chosen, 's-1', other)).not.toHaveProperty('bells');
  expect(schoolFrom(chosen, 's-1', other).id).toBe('s-1');
  const again = schoolFrom(chosen, 's-1', typed);
  expect(unchanged(again, again)).toBe(true);
  expect(unchanged(again, typed)).toBe(false);
  expect(unchanged(again, undefined)).toBe(false);
});

test('finds the choice of a school saved before, even with subjects kept for its classes', () => {
  const saved = schoolFrom(chosenSchool(MADE_UP_LIST, FULL)!, 's-1');
  expect(choiceOf(MADE_UP_LIST, saved)).toEqual(FULL);
  expect(choiceOf(MADE_UP_LIST, { ...saved, subjects: ['arabic', 'math'] })).toEqual(FULL);
  expect(choiceOf(MADE_UP_LIST, { ...saved, subjects: ['math', 'arabic'] })).toEqual({ ...FULL, option: 'math' });
  expect(choiceOf(MADE_UP_LIST, { ...saved, subjects: ['math', 'arabic', 'islamic'] })).toEqual({
    ...FULL,
    option: 'math',
  });
  expect(choiceOf(MADE_UP_LIST, { ...saved, subjects: ['arabic', 'islamic'] })).toEqual({
    ...FULL,
    option: 'arabic-islamic',
  });
  expect(choiceOf(MADE_UP_LIST, { ...saved, code: 'gone' })).toBe(NO_CHOICE);
  expect(choiceOf(MADE_UP_LIST, undefined)).toBe(NO_CHOICE);
});
