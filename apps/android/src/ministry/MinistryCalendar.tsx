// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's calendar page in a demo world (#607, §4.5, R-4.5-18, answer
// 623): it says the page keys the world's calendar, the latest release the
// world holds (#608) with the draft over it, each entry with its source and how
// sure it is, and that a draft kept before was set aside when it no longer
// fits, the next change starting a new one; then a choice of the national layer
// or one wilaya's, the wilayas in the official order, and that layer's entries
// by their first day, those the draft takes out among them, each with what the
// draft does to it (CalendarRow.tsx), or that there is none, with a button to
// add an entry to that layer, or that wilaya. Adding or changing an entry opens
// the form in the place of the layers and the list (CalendarForm.tsx), a new
// entry named at random and going where it was added; saving it keeps the draft
// and closes the form, which stays open when the draft is refused or not kept,
// and says when fields are missing; closing it brings the focus back to the
// button that opened it, an entry's Change or the one that adds an entry;
// taking an entry out or undoing a change keeps the draft at once. A problem is
// said as an alert, announced on the phone since a PC reads the alert, and each
// saving is announced on both. The foot says the draft stays on this PC and is
// sent nowhere until it is published.

import {
  compareDays,
  draftMark,
  draftedCalendar,
  newDraftId,
  setDraftEntry,
  takeOutDraftEntry,
  undoDraftEntry,
  type CalendarEntry,
  type Day,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { useSheetFocus } from '../components/sheet-focus';
import type { OpenWorld } from '../demo/world-mode';
import type { WorldKit } from '../demo/world-session';
import { colors, spacing, typography } from '../design/tokens';
import type { ReferenceResult } from '../reference';
import { ZonePicker, zoneLabel } from '../setup/ZonePicker';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { useSaid } from '../week/useSaid';
import { CalendarForm } from './CalendarForm';
import { useCalendarDesk } from './calendar-desk';
import { CalendarRow } from './CalendarRow';

export type MinistryCalendarProps = {
  readonly world: Pick<OpenWorld, 'book' | 'date'>;
  readonly reference: Extract<ReferenceResult, { ok: true }>;
  /** The world's kit, whose random bytes name a new entry. */
  readonly kit: Pick<WorldKit, 'random'>;
  readonly dayText: (day: Day) => string;
};

/** The Ministry's draft of the world's calendar, layer by layer. */
export function MinistryCalendar({ world, reference, kit, dayText }: MinistryCalendarProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const zones = reference.profile.zones ?? [];
  const [layer, setLayer] = useState<'national' | 'zone'>('national');
  const [zone, setZone] = useState(zones[0]?.code ?? '');
  const desk = useCalendarDesk(world, reference);
  const [editing, setEditing] = useState<{
    entry: CalendarEntry | null;
    place: Pick<CalendarEntry, 'id' | 'layer' | 'zone'>;
  } | null>(null);
  const add = useRef<ViewInstance>(null);
  const changes = useRef(new Map<string, ViewInstance | null>());
  const opener = useRef<ViewInstance>(null);
  const closed = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (editing !== null) closed.current = editing.entry === null ? null : editing.place.id;
    else opener.current = (closed.current === null ? null : changes.current.get(closed.current)) ?? add.current;
  }, [editing]);
  useSheetFocus(editing !== null, opener);
  const wilayaName = (place: Pick<CalendarEntry, 'layer' | 'zone'>) => {
    const found = zones.find((one) => one.code === place.zone);
    return place.layer === 'zone' && found !== undefined ? zoneLabel(found) : null;
  };
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
      <Text style={[styles.body, align]}>
        {t('demo.ministryCalendar.lead', { release: isolate(reference.calendar.release) })}
      </Text>
      {desk.setAside && (
        <Text testID="ministry-calendar-set-aside" style={[styles.body, align]}>
          {t('demo.ministryCalendar.setAside')}
        </Text>
      )}
      {editing === null && (
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
      )}
      {editing === null && layer === 'zone' && zones.length > 0 && (
        <ZonePicker testID="ministry-calendar-zone" zones={zones} value={zone} onChange={setZone} />
      )}
      {editing === null ? (
        <Button
          ref={add}
          testID="ministry-calendar-add"
          label={t('demo.ministryCalendar.add')}
          disabled={desk.saving || (layer === 'zone' && zone === '')}
          onPress={() =>
            setEditing({
              entry: null,
              place: { id: newDraftId(kit.random), layer, ...(layer === 'zone' && { zone }) },
            })
          }
        />
      ) : (
        <CalendarForm
          key={editing.place.id}
          entry={editing.entry}
          place={editing.place}
          was={desk.base.find((one) => one.id === editing.place.id)}
          wilaya={wilayaName(editing.place)}
          date={world.date}
          year={reference.calendar.year}
          profile={reference.profile}
          busy={desk.saving}
          dayText={dayText}
          onSave={(entry, reason) =>
            void desk.save(setDraftEntry(desk.base, desk.draft, entry, reason)).then((kept) => kept && setEditing(null))
          }
          onCancel={() => setEditing(null)}
          onMissing={() => say(t('demo.ministryCalendar.form.missing'))}
        />
      )}
      {editing === null && shown.length === 0 && (
        <Text style={[styles.body, align]}>{t('demo.ministryCalendar.none')}</Text>
      )}
      {editing === null &&
        shown.map((entry) => (
          <CalendarRow
            key={entry.id}
            entry={entry}
            mark={draftMark(desk.base, desk.draft, entry.id)}
            busy={desk.saving}
            dayText={dayText}
            onChange={() => setEditing({ entry, place: entry })}
            changeRef={(node) => {
              changes.current.set(entry.id, node);
            }}
            onTakeOut={() => void desk.save(takeOutDraftEntry(desk.base, desk.draft, entry.id))}
            onUndo={() => void desk.save(undoDraftEntry(desk.draft, entry.id))}
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
