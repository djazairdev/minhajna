// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One entry of the world's calendar on the Ministry's calendar page (#607,
// answer 623): its name, its effect and days, its source and how sure it is,
// the days it had and why when it moved, and what the draft does to it, as a
// badge; then buttons to change it and to take it out, unless the draft already
// takes it out, and one to undo the draft's change, each spoken with the
// entry's name; names, sources and reasons are isolated from the text around
// them. The buttons wait while the draft is saving.

import type { CalendarEntry, Day, DraftMark } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import type { Ref } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';

export const EFFECTS = {
  'no-school': 'demo.ministryCalendar.effects.holiday',
  closure: 'demo.ministryCalendar.effects.closure',
  exam: 'demo.ministryCalendar.effects.exam',
  marker: 'demo.ministryCalendar.effects.marker',
} as const;

export type CalendarRowProps = {
  readonly entry: CalendarEntry;
  readonly mark: DraftMark;
  readonly busy: boolean;
  readonly dayText: (day: Day) => string;
  readonly onChange: () => void;
  /** Takes the Change button, which the focus comes back to once the form closes. */
  readonly changeRef?: Ref<ViewInstance>;
  readonly onTakeOut: () => void;
  readonly onUndo: () => void;
};

/** An entry of the world's calendar, with what the draft does to it. */
export function CalendarRow({ entry, mark, busy, dayText, onChange, changeRef, onTakeOut, onUndo }: CalendarRowProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const name = localized(entry.name);
  const days = (from: Day, to: Day) =>
    from === to ? dayText(from) : t('demo.ministryCalendar.days', { from: dayText(from), to: dayText(to) });
  const effect = Object.hasOwn(EFFECTS, entry.effect)
    ? t(EFFECTS[entry.effect as keyof typeof EFFECTS])
    : t('demo.ministryCalendar.effects.other');
  return (
    <View testID={`ministry-entry-${entry.id}`} style={styles.row}>
      <Text accessibilityRole="header" style={[styles.name, align]}>
        {name}
      </Text>
      {mark !== null && (
        <Badge
          testID={`ministry-mark-${entry.id}`}
          label={t(`demo.ministryCalendar.marks.${mark}`)}
          variant={mark === 'removed' ? 'warning' : 'done'}
        />
      )}
      <Text style={[styles.body, align]}>
        {t('demo.ministryCalendar.line', { effect, days: days(entry.from, entry.to) })}
      </Text>
      <Text style={[styles.small, align]}>{t('demo.ministryCalendar.source', { source: isolate(entry.source) })}</Text>
      <Text style={[styles.small, align]}>
        {t('demo.ministryCalendar.confidence', {
          confidence: t(`demo.ministryCalendar.confidences.${entry.confidence}`),
        })}
      </Text>
      {entry.moved !== undefined && (
        <Text style={[styles.small, align]}>
          {t('demo.ministryCalendar.moved', {
            days: days(entry.moved.from, entry.moved.to),
            reason: isolate(entry.moved.reason),
          })}
        </Text>
      )}
      <View style={styles.actions}>
        {mark !== 'removed' && (
          <Button
            ref={changeRef}
            testID={`ministry-change-${entry.id}`}
            variant="line"
            label={t('demo.ministryCalendar.change')}
            name={t('demo.ministryCalendar.changeFor', { name: isolate(name) })}
            disabled={busy}
            onPress={onChange}
          />
        )}
        {mark !== 'removed' && (
          <Button
            testID={`ministry-take-out-${entry.id}`}
            variant="line"
            label={t('demo.ministryCalendar.takeOut')}
            name={t('demo.ministryCalendar.takeOutFor', { name: isolate(name) })}
            disabled={busy}
            onPress={onTakeOut}
          />
        )}
        {mark !== null && (
          <Button
            testID={`ministry-undo-${entry.id}`}
            variant="plain"
            label={t('demo.ministryCalendar.undo')}
            name={t('demo.ministryCalendar.undoFor', { name: isolate(name) })}
            disabled={busy}
            onPress={onUndo}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.paper,
    padding: spacing['space-12'],
    gap: spacing['space-4'],
  },
  name: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
