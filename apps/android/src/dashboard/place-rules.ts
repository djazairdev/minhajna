// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Choosing a school on the school's page: the wilayas that have a school in the
// published list, in the profile's order, then that wilaya's communes, then
// that commune's schools, each as the boards write it, its code then its name.

import type { CountryProfile, DirectorySchool, LocalizedText, ReferenceList } from '@minhajna/core';
import { localized } from '../setup/names';
import type { PickChoice } from './PickField';

/** A place as a select writes it: «16 · الجزائر». */
export const placeLabel = (code: string, name: LocalizedText | string) =>
  `${code} · ${typeof name === 'string' ? name : localized(name)}`;

/** The profile's wilayas that have a school in this list. */
export function wilayaChoices(profile: CountryProfile, schools: readonly DirectorySchool[]): PickChoice[] {
  const held = new Set(schools.map((school) => school.wilaya));
  return (profile.zones ?? [])
    .filter((zone) => held.has(zone.code))
    .map((zone) => ({ value: zone.code, label: placeLabel(zone.code, zone.name) }));
}

/** The communes of a wilaya that have a school in this list, by code. */
export function schoolCommuneChoices(schools: readonly DirectorySchool[], wilaya: string | null): PickChoice[] {
  const communes = new Map<string, PickChoice>();
  for (const { commune, wilaya: of } of schools)
    if (of === wilaya) communes.set(commune.code, { value: commune.code, label: placeLabel(commune.code, commune.name) });
  return [...communes.values()].sort((one, other) => one.value.localeCompare(other.value));
}

/** The schools of a commune in this list, by name. */
export function schoolChoices(list: ReferenceList, commune: string | null): PickChoice[] {
  return list.schools
    .filter((school) => school.commune.code === commune)
    .map((school) => ({ value: school.id, label: school.name }))
    .sort((one, other) => one.label.localeCompare(other.label));
}
