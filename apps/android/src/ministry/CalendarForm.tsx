// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The form on the Ministry's calendar page that adds an entry to the world's
// calendar or changes one (#607, answer 623), as entry-form.ts fills and reads
// it, a new one titled with its wilaya when it goes in one: the name in Arabic,
// then in French and English if given; the first and last days, picked on one
// month's days within the school year, the last never before the first; the
// effect, among a holiday, a closure, an exam window and a marker, or, for an
// entry whose effect the editor does not offer, that effect, said and kept; for
// an exam window, the term it closes; the levels it covers, none meaning every
// level, which must cover the years an exam of the release keeps; the source,
// one line; how sure it is; and, when the days of an entry of the release
// moved, why. Saving says what is missing beside its field, and that fields are
// missing, or hands the entry on; cancelling leaves the draft as it was. The
// buttons wait while the draft is saving.

import {
  DRAFT_EFFECTS,
  DRAFT_NAME_MOST,
  DRAFT_REASON_MOST,
  SOURCE_MAX,
  type CalendarEntry,
  type CountryProfile,
  type Day,
  type SchoolYear,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { MonthDays } from '../extra/MonthDays';
import { localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import {
  effectOffered,
  entryOf,
  formOf,
  formProblems,
  movesDays,
  type EntryForm,
  type FormProblem,
} from './entry-form';
import { EFFECTS } from './CalendarRow';

export type CalendarFormProps = {
  /** The entry changed, as the draft shows it, or null for a new one. */
  readonly entry: CalendarEntry | null;
  /** Where a new entry goes: its ID, layer and wilaya. */
  readonly place: Pick<CalendarEntry, 'id' | 'layer' | 'zone'>;
  /** The release's entry it changes, if any, whose days moving needs a reason. */
  readonly was: CalendarEntry | undefined;
  readonly date: Day;
  readonly year: SchoolYear;
  readonly profile: Pick<CountryProfile, 'months' | 'levels'>;
  readonly busy: boolean;
  readonly dayText: (day: Day) => string;
  readonly onSave: (entry: CalendarEntry, reason: string) => void;
  readonly onCancel: () => void;
  /** Said when saving finds fields missing. */
  readonly onMissing: () => void;
  /** The wilaya's name, for a new entry in one. */
  readonly wilaya: string | null;
};

/** Adds an entry to the draft, or changes one. */
export function CalendarForm({
  entry,
  place,
  was,
  date,
  year,
  profile,
  busy,
  dayText,
  onSave,
  onCancel,
  onMissing,
  wilaya,
}: CalendarFormProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [form, setForm] = useState<EntryForm>(() => formOf(entry, date, year, was));
  const [edge, setEdge] = useState<'from' | 'to'>('from');
  const [month, setMonth] = useState(form.from.slice(0, 7));
  const [missing, setMissing] = useState<readonly FormProblem[]>([]);
  const set = (change: Partial<EntryForm>) => setForm((before) => ({ ...before, ...change }));
  const error = (problem: FormProblem) =>
    missing.includes(problem) ? t(`demo.ministryCalendar.form.${problem}`) : undefined;
  const effectWord = (effect: string) =>
    t(EFFECTS[effect as keyof typeof EFFECTS] ?? 'demo.ministryCalendar.effects.other');
  const pick = (day: Day) =>
    edge === 'from'
      ? set({ from: day, to: form.to < day ? day : form.to })
      : set({ to: day < form.from ? form.from : day });
  const save = () => {
    const problems = formProblems(form, was, profile);
    setMissing(problems);
    if (problems.length > 0) onMissing();
    else onSave(entryOf(form, place, was), form.reason.trim());
  };
  const name = (key: 'ar' | 'fr' | 'en', optional: boolean) => (
    <TextField
      testID={`ministry-form-name-${key}`}
      label={t(`demo.ministryCalendar.form.name.${key}`)}
      placeholder={t('demo.ministryCalendar.form.nameHint')}
      value={form[key]}
      onChangeText={(text) => set({ [key]: text })}
      maxLength={DRAFT_NAME_MOST}
      {...(optional ? { optionalLabel: t('demo.ministryCalendar.form.optional') } : {})}
      {...(key === 'ar' ? { error: error('needName') } : {})}
    />
  );
  return (
    <View testID="ministry-form" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {entry === null && wilaya !== null
          ? t('demo.ministryCalendar.form.newIn', { wilaya: isolate(wilaya) })
          : entry === null
            ? t('demo.ministryCalendar.form.newTitle')
            : t('demo.ministryCalendar.form.changeTitle', { name: isolate(localized(entry.name)) })}
      </Text>
      {name('ar', false)}
      {name('fr', true)}
      {name('en', true)}
      <SegmentedControl
        testID="ministry-form-edge"
        label={t('demo.ministryCalendar.form.days')}
        choices={[
          { value: 'from', label: t('demo.ministryCalendar.form.from') },
          { value: 'to', label: t('demo.ministryCalendar.form.to') },
        ]}
        selected={edge}
        onSelect={(next) => {
          setEdge(next);
          setMonth((next === 'from' ? form.from : form.to).slice(0, 7));
        }}
      />
      <Text testID="ministry-form-span" style={[styles.body, align]}>
        {form.from === form.to
          ? dayText(form.from)
          : t('demo.ministryCalendar.days', { from: dayText(form.from), to: dayText(form.to) })}
      </Text>
      <MonthDays
        month={month}
        selected={edge === 'from' ? form.from : form.to}
        first={year.from}
        last={year.to}
        profile={profile}
        onMonth={setMonth}
        onSelect={pick}
      />
      {effectOffered(form.effect) ? (
        <ChipGroup
          testID="ministry-form-effect"
          label={t('demo.ministryCalendar.form.effect')}
          choices={DRAFT_EFFECTS.map((value) => ({ value, label: effectWord(value) }))}
          selected={form.effect as (typeof DRAFT_EFFECTS)[number]}
          onSelect={(effect) =>
            set({ effect, term: effect === 'exam' ? (form.term ?? year.terms[0]?.number ?? null) : null })
          }
        />
      ) : (
        <Text style={[styles.body, align]}>
          {t('demo.ministryCalendar.form.effectKept', { effect: effectWord(form.effect) })}
        </Text>
      )}
      {form.effect === 'exam' && (
        <ChipGroup
          testID="ministry-form-term"
          label={t('demo.ministryCalendar.form.term')}
          choices={year.terms.map((term) => ({
            value: String(term.number),
            label: t('demo.ministryCalendar.form.termN', { number: term.number }),
          }))}
          selected={form.term === null ? null : String(form.term)}
          onSelect={(term) => set({ term: Number(term) })}
        />
      )}
      <ChipGroup
        testID="ministry-form-levels"
        multiple
        label={t('demo.ministryCalendar.form.levels')}
        choices={profile.levels.map((level) => ({ value: level.code, label: localized(level.name) }))}
        selected={form.levels}
        onSelect={(levels) =>
          set({ levels: profile.levels.map((one) => one.code).filter((code) => levels.includes(code)) })
        }
      />
      {missing.includes('needLevels') && (
        <Text accessibilityLiveRegion="polite" style={[styles.problem, align]}>
          {t('demo.ministryCalendar.form.needLevels')}
        </Text>
      )}
      <TextField
        testID="ministry-form-source"
        label={t('demo.ministryCalendar.form.source')}
        placeholder={t('demo.ministryCalendar.form.sourceHint')}
        value={form.source}
        onChangeText={(source) => set({ source: source.replace(/[\r\n]+/gu, ' ') })}
        maxLength={SOURCE_MAX}
        error={error('needSource')}
      />
      <SegmentedControl
        testID="ministry-form-confidence"
        label={t('demo.ministryCalendar.form.confidence')}
        choices={[
          { value: 'announced', label: t('demo.ministryCalendar.confidences.announced') },
          { value: 'expected', label: t('demo.ministryCalendar.confidences.expected') },
          { value: 'projected', label: t('demo.ministryCalendar.confidences.projected') },
        ]}
        selected={form.confidence}
        onSelect={(confidence) => set({ confidence })}
      />
      {movesDays(form, was) && (
        <TextField
          testID="ministry-form-reason"
          label={t('demo.ministryCalendar.form.reason')}
          placeholder={t('demo.ministryCalendar.form.reasonHint')}
          value={form.reason}
          onChangeText={(reason) => set({ reason: reason.replace(/[\r\n]+/gu, ' ') })}
          maxLength={DRAFT_REASON_MOST}
          error={error('needReason')}
        />
      )}
      <View style={styles.actions}>
        <Button
          testID="ministry-form-save"
          label={t('demo.ministryCalendar.form.save')}
          disabled={busy}
          onPress={save}
        />
        <Button
          testID="ministry-form-cancel"
          variant="plain"
          label={t('demo.ministryCalendar.form.cancel')}
          disabled={busy}
          onPress={onCancel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.paper,
    padding: spacing['space-12'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  problem: { ...typography.body, color: colors['error-ink'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
