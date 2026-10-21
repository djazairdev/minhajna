// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { maxDay, minDay, type CalendarEntry, type Day } from '@minhajna/core';
import { localized } from '../setup/names';
import type { AppData } from '../storage/AppData';
import { currentLanguage, type Language } from '../text/i18n';
import { calendarCatalogues } from './catalogues';

/** Manual entries; added sessions, councils and A/B resets open their own focused editors. */
export const LOCAL_KINDS = [
  'school-closure',
  'zone-closure',
  'training',
  'duty',
  'school-event',
  'council',
  'added-day',
  'ab-reset',
] as const;
export type LocalKind = (typeof LOCAL_KINDS)[number];
/** A draft stays on this page until its preview is confirmed. */
export interface CalendarDraft {
  readonly kind: LocalKind;
  readonly schoolId: string;
  readonly from: Day;
  readonly to: Day;
  readonly title: string;
  readonly source: string;
  readonly confidence: 'announced' | 'expected';
  readonly period: 'all' | 'morning' | 'afternoon';
}

/** An existing name is preserved verbatim unless the teacher changes it. */
export function entryKind(entry: CalendarEntry): LocalKind {
  if (entry.effect === 'adds-sessions') return 'added-day';
  if (entry.council !== undefined) return 'council';
  if (entry.layer === 'zone') return 'zone-closure';
  if (entry.layer === 'school') return entry.effect === 'closure' ? 'school-closure' : 'school-event';
  return Object.values(calendarCatalogues).some((text) => Object.values(entry.name).includes(text.edit.kinds.duty))
    ? 'duty'
    : 'training';
}

/** The first date is the phone's day bounded by the actual school year, not an invented date. */
export function initialCalendarDraft(data: AppData, schoolId: string, old?: CalendarEntry): CalendarDraft {
  const day = minDay(maxDay(data.today(), data.year.from), data.year.to);
  const kind = old === undefined ? 'school-closure' : entryKind(old);
  return {
    kind,
    schoolId,
    from: old?.from ?? day,
    to: old?.to ?? day,
    title: old === undefined ? calendarCatalogues[currentLanguage()].edit.kinds[kind] : localized(old.name),
    source: old?.source ?? '',
    period: old?.half ?? 'all',
    confidence: old?.confidence === 'expected' ? 'expected' : 'announced',
  };
}

/** Local edits cannot change their layer or scope; a mistaken scope can be cancelled and entered again. */
export function offeredKinds(old?: CalendarEntry): readonly LocalKind[] {
  if (old === undefined) return LOCAL_KINDS;
  if (old.layer === 'teacher') return ['training', 'duty'];
  return old.layer === 'zone' ? ['zone-closure'] : ['school-closure', 'school-event'];
}

/** Build only the fields this form owns, retaining restrictions and untranslated name variants on an edit. */
export function draftEntry(
  data: AppData,
  id: string,
  draft: CalendarDraft,
  language: Language,
  old?: CalendarEntry,
): CalendarEntry {
  const teacher = draft.kind === 'training' || draft.kind === 'duty';
  const layer = teacher ? 'teacher' : draft.kind === 'zone-closure' ? 'zone' : 'school';
  const school = data.state.schools.get(draft.schoolId);
  const name = old !== undefined && draft.title === localized(old.name) ? old.name : { [language]: draft.title.trim() };
  return {
    ...(old ?? {}),
    id,
    layer,
    from: draft.from,
    to: draft.to,
    effect:
      old !== undefined && draft.kind === entryKind(old)
        ? old.effect
        : draft.kind === 'school-event'
          ? 'marker'
          : 'closure',
    ...(layer === 'school' && { schoolId: school?.id }),
    ...(layer === 'zone' && { zone: school?.zone }),
    name,
    source: draft.source,
    confidence: draft.confidence,
    half: draft.period === 'all' ? undefined : draft.period,
  };
}
