// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's calendar page in a demo world (#607, §4.5, R-4.5-18, answer
// 623): it says the page keys the world's calendar, the bundled release with
// the draft over it, each entry with its source and how sure it is, and that a
// draft kept before was set aside when it no longer fits, the next change
// starting a new one; then a choice of the national layer or one wilaya's, the
// wilayas in the official order, and that layer's entries by their first day,
// those the draft takes out among them, each with what the draft does to it
// (CalendarRow.tsx), or that there is none. Taking an entry out or undoing a
// change keeps the draft at once. A problem is said as an alert, announced on
// the phone since a PC reads the alert, and each saving is announced on both.
// The foot says the draft stays on this PC and is sent nowhere until it is
// published.

import { compareDays, draftMark, draftedCalendar, takeOutDraftEntry, undoDraftEntry, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SegmentedControl } from '../components/SegmentedControl';
import type { OpenWorld } from '../demo/world-mode';
import { colors, spacing, typography } from '../design/tokens';
import type { ReferenceResult } from '../reference';
import { ZonePicker } from '../setup/ZonePicker';
import { onPc, useDeviceText } from '../text/device-text';
import { useSaid } from '../week/useSaid';
import { useCalendarDesk } from './calendar-desk';
import { CalendarRow } from './CalendarRow';

export type MinistryCalendarProps = {
  readonly world: Pick<OpenWorld, 'book' | 'date'>;
  readonly reference: Extract<ReferenceResult, { ok: true }>;
  readonly dayText: (day: Day) => string;
};

/** The Ministry's draft of the world's calendar, layer by layer. */
export function MinistryCalendar({ world, reference, dayText }: MinistryCalendarProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const zones = reference.profile.zones ?? [];
  const [layer, setLayer] = useState<'national' | 'zone'>('national');
  const [zone, setZone] = useState(zones[0]?.code ?? '');
  const desk = useCalendarDesk(world, reference);
  const { say, region } = useSaid('', 'ministry-calendar-said');
  const problem = desk.problem === null ? null : t(desk.problem);
  const announce = useEffectEvent(() => {
    if (problem !== null && !onPc()) say(problem);
  });
  useEffect(() => {
    if (desk.problems > 0) announce();
  }, [desk.problems]);
  const saved = useEffectEvent(() => say(t('demo.ministryCalendar.saved')));
  useEffect(() => {
    if (desk.saved > 0) saved();
  }, [desk.saved]);
  const shown = [
    ...draftedCalendar(desk.base, desk.draft),
    ...desk.base.filter((entry) => desk.draft.removed.includes(entry.id)),
  ]
    .filter((entry) => entry.layer === layer && (layer === 'national' || entry.zone === zone))
    .sort((a, b) => compareDays(a.from, b.from) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return (
    <View testID="ministry-calendar" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.ministryCalendar.lead')}</Text>
      {desk.setAside && (
        <Text testID="ministry-calendar-set-aside" style={[styles.body, align]}>
          {t('demo.ministryCalendar.setAside')}
        </Text>
      )}
      <SegmentedControl
        testID="ministry-calendar-layer"
        label={t('demo.ministryCalendar.layer')}
        choices={[
          { value: 'national', label: t('demo.ministryCalendar.national') },
          { value: 'zone', label: t('demo.ministryCalendar.wilaya') },
        ]}
        selected={layer}
        onSelect={setLayer}
      />
      {layer === 'zone' && zones.length > 0 && (
        <ZonePicker testID="ministry-calendar-zone" zones={zones} value={zone} onChange={setZone} />
      )}
      {shown.length === 0 && <Text style={[styles.body, align]}>{t('demo.ministryCalendar.none')}</Text>}
      {shown.map((entry) => (
        <CalendarRow
          key={entry.id}
          entry={entry}
          mark={draftMark(desk.base, desk.draft, entry.id)}
          busy={desk.saving}
          dayText={dayText}
          onTakeOut={() => desk.save(takeOutDraftEntry(desk.base, desk.draft, entry.id))}
          onUndo={() => desk.save(undoDraftEntry(desk.draft, entry.id))}
        />
      ))}
      {desk.saving && <Text style={[styles.small, align]}>{t('demo.ministryCalendar.saving')}</Text>}
      {problem !== null && (
        <Text key={desk.problems} accessibilityRole="alert" style={[styles.problem, align]}>
          {problem}
        </Text>
      )}
      <Text style={[styles.small, align]}>{t('demo.ministryCalendar.foot')}</Text>
      {region}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  body: { ...typography.body, color: colors.ink2 },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
