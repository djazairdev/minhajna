// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The names setup shows for the profile's levels, subjects and zones, in the
// interface language. The levels' short names come from the catalogue, as
// Setup-2-Teaching's chips draw them.

import type { CountryProfile, LocalizedText, School } from '@minhajna/core';
import { currentLanguage, type useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

/** A name in the interface language, or English when the profile lacks it. */
export function localized(name: LocalizedText): string {
  return name[currentLanguage()] ?? name.en ?? Object.values(name)[0] ?? '';
}

/** A year's name in the interface language, such as «السنة الرابعة ابتدائي». */
export function gradeName(profile: CountryProfile, code: string): string {
  const grade = profile.levels.flatMap((level) => level.grades).find((candidate) => candidate.code === code);
  return grade ? localized(grade.name) : code;
}

/** A joint class's year as Today writes it, such as «4 ابتدائي». */
export function yearShort(t: Translate, code: string): string {
  return t('joint.short', { n: code.replace(/\D/g, '') });
}

/** The chips' short name for a level, as Setup-2-Teaching draws it. */
export function levelName(t: Translate, profile: CountryProfile, code: string): string {
  const level = profile.levels.find((candidate) => candidate.code === code);
  return t(`setup.levelName.${code}`, { defaultValue: level ? localized(level.name) : code });
}

/** «متوسط · اللغة العربية»: the levels, then the subjects, in the profile's names. */
export function schoolLine(t: Translate, profile: CountryProfile, school: School): string {
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const subjects = profile.subjects.filter((subject) => school.subjects.includes(subject.code));
  const parts = [
    school.levels.map((code) => levelName(t, profile, code)).join(comma),
    subjects.map((subject) => localized(subject.name)).join(comma),
  ].filter((part) => part !== '');
  return parts.length > 0 ? parts.join(' · ') : t('setup.nothingChosen');
}
