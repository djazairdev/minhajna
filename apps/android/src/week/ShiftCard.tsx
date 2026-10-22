// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The double shift on Week-draw (#28, #230, Week-draw-primary, answer 385): the
// half-day taught in A weeks. For a primary teacher it is «الدوامان»: two
// classes share one room, one in the morning and one in the afternoon, swapping
// each week. The card names the teacher's class and its room, the other class
// in the room by an optional name kept on the version, trimmed once the field
// is left, this week and next week by letter with the half each class takes,
// with no «هذا الأسبوع» in a holiday week, what follows for the sessions, Today
// and the roll call, and links to the calendar's week letter and to the
// roll-call rules. At large text each week's row stacks its parts. Classes in
// two schools follow the first one's letter (answer 386).

import type { Half, SchoolClass, TimetableVersion } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import { OptionRow } from '../components/OptionRow';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from './grid-labels';

export type ShiftCardProps = {
  readonly version: TimetableVersion;
  readonly classes: readonly SchoolClass[];
  readonly onShift: (half: Half) => void;
  /** The other class in the room, by name; empty takes it off. */
  readonly onShared: (name: string) => void;
  /** Opens the week letter of the school's calendar. */
  readonly onLetter?: (schoolId: string) => void;
  readonly onRules?: () => void;
};

const HALVES: readonly Half[] = ['morning', 'afternoon'];

export function ShiftCard({ version, classes, onShift, onShared, onLetter, onRules }: ShiftCardProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const large = useWindowDimensions().fontScale >= 1.5;
  const shift = version.options?.doubleShift;
  if (shift === undefined) return null;
  const chips = (
    <ChipGroup
      testID="shift"
      label={t(primaryOnly(classes) ? 'week.shiftMine' : 'week.shiftA')}
      hint={t('week.shiftNote')}
      choices={HALVES.map((value) => ({ value, label: t(`week.${value}`) }))}
      selected={shift}
      onSelect={onShift}
    />
  );
  if (!primaryOnly(classes)) return chips;
  const school = state.schools.get(classes[0].schoolId);
  const context = coreContext({ profile, year, calendar, calendarRelease, packs, state });
  const parity = school === undefined ? null : context.calendar.parityOn(today(), school);
  const running = school !== undefined && context.calendar.weekOf(today(), school) !== null;
  const rooms = [...new Set(version.entries.flatMap((entry) => (entry.room === undefined ? [] : [entry.room])))];
  const room = rooms.length === 1 ? rooms[0] : undefined;
  const shared = version.options?.sharedWith ?? '';
  const other = shared.trim() === '' ? t('week.otherClass') : isolate(shared.trim());
  const names = classes.map((one) => isolate(one.name)).join(t('week.and'));
  const band = (half: Half) => t(`today.band.${half}`);
  const second: Half = shift === 'morning' ? 'afternoon' : 'morning';
  const weeks = (['A', 'B'] as const).map((letter) => {
    const mine = letter === 'A' ? shift : second;
    const now = parity === letter;
    const when = parity === null || (now && !running) ? null : t(now ? 'week.thisWeek' : 'week.nextWeek');
    const head = when === null ? t(`week.week${letter}`) : `${t(`week.week${letter}`)} · ${when}`;
    const cells = HALVES.map((half) => ({ half, who: half === mine ? t('week.mine') : other, mine: half === mine }));
    return { letter, head, cells };
  });
  return (
    <View testID="shift-card" style={styles.group}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('week.shiftTitle')}
      </Text>
      <Text style={[styles.body, align]}>
        {room === undefined ? names : t('week.shiftRoom', { classes: names, room: isolate(room) })}
      </Text>
      <Text style={[styles.note, align]}>{t('week.shiftExplain')}</Text>
      {chips}
      <TextField
        testID="shift-shared"
        label={t('week.shiftShared')}
        optionalLabel={t('setup.optional')}
        placeholder={t('week.shiftSharedPlaceholder')}
        value={shared}
        onChangeText={onShared}
        onBlur={() => shared !== shared.trim() && onShared(shared.trim())}
      />
      {shared.trim() !== '' && (
        <Text style={[styles.body, align]}>
          {room === undefined
            ? t('week.shiftOther', { name: other })
            : t('week.shiftOtherRoom', { name: other, room: isolate(room) })}
        </Text>
      )}
      <View style={styles.table}>
        {weeks.map((week) => (
          <View
            key={week.letter}
            testID={`shift-week-${week.letter}`}
            accessible
            accessibilityLabel={[week.head, ...week.cells.map((cell) => `${band(cell.half)}: ${cell.who}`)].join(
              t('week.shiftSeparator'),
            )}
            style={[styles.row, { direction }, large && styles.stacked]}
          >
            <Text style={[styles.head, align, large && styles.unflexed]}>{week.head}</Text>
            {week.cells.map((cell) => (
              <View key={cell.half} style={[styles.cell, cell.mine && styles.mine, large && styles.unflexed]}>
                <Text style={styles.small}>{band(cell.half)}</Text>
                <Text style={[styles.who, cell.mine && styles.strong]}>{cell.who}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <Text style={[styles.note, align]}>{t('week.shiftLegend')}</Text>
      {[
        t('week.shiftSame'),
        t('week.shiftToday', { first: band(shift), second: band(second) }),
        t('week.shiftRoll'),
        t('week.shiftLetter'),
      ].map((fact) => (
        <Text key={fact} style={[styles.body, align]}>
          {`• ${fact}`}
        </Text>
      ))}
      {onLetter !== undefined && school !== undefined && (
        <OptionRow
          testID="shift-letter"
          label={t('week.letterLink')}
          sub={t('week.letterSub')}
          onPress={() => onLetter(school.id)}
        />
      )}
      {onRules !== undefined && (
        <OptionRow testID="shift-rules" label={t('week.rulesLink')} sub={t('week.rulesSub')} onPress={onRules} />
      )}
    </View>
  );
}

/** Whether every class of the teacher's is a primary class, so the double shift is «الدوامان». */
export function primaryOnly(classes: readonly SchoolClass[]): boolean {
  return classes.length > 0 && classes.every((one) => one.level === 'primary');
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  table: { gap: spacing['space-6'] },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing['space-6'] },
  stacked: { flexDirection: 'column' },
  unflexed: { flex: 0, alignSelf: 'stretch' },
  head: { ...typography.caption, color: colors.ink, flex: 1.2, alignSelf: 'center' },
  cell: {
    flex: 1,
    minHeight: 48,
    padding: spacing['space-6'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    justifyContent: 'center',
  },
  mine: { borderColor: colors.ink, backgroundColor: colors.paper },
  small: { ...typography.caption, color: colors.ink2, textAlign: 'center' },
  who: { ...typography.caption, color: colors.ink, textAlign: 'center' },
  strong: { ...typography.label },
});
