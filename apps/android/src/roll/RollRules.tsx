// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «قواعد العدّ» (#39, Roll-rules): the roll-call book's counting rules for
// every class, which no official text settles (PRD §3.4). The day counting
// starts, and whether training days and seminars, and sessions not held,
// count in possible attendance. Holidays never count and a day with one
// shift counts half, so they are stated, not set. The unit is the half-day
// in primary and the session in CEM and lycée. Each change is recorded at
// once; recorded absences never change, only the totals.

import { DEFAULT_COUNTING, unitKind, type CountingRules, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { OptionRow } from '../components/OptionRow';
import { colors, radius, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { countingStarts } from './roll-rules';

function isDefault(rules: CountingRules): boolean {
  return (
    rules.from === undefined &&
    rules.untaken === DEFAULT_COUNTING.untaken &&
    rules.notHeld === DEFAULT_COUNTING.notHeld &&
    rules.seminars === DEFAULT_COUNTING.seminars
  );
}

export function RollRules() {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, packs, today, record } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [choosing, setChoosing] = useState(false);
  const change = useRef<ViewInstance>(null);
  const rules = state.counting ?? DEFAULT_COUNTING;
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const kinds = new Set([...state.classes.values()].map((schoolClass) => unitKind(context, schoolClass)));
  const starts = useMemo(() => countingStarts(profile, year, today()), [profile, year, today]);
  const language = currentLanguage();
  const start = rules.from ?? year.from;
  const startLine = (day: Day) =>
    [`${dayName(t, day, language, profile)} ${day.slice(0, 4)}`, day === year.from ? t('rules.schoolStart') : null]
      .filter(Boolean)
      .join(' · ');
  const set = (change: Partial<CountingRules>) => record({ kind: 'counting.set', rules: { ...rules, ...change } });
  const fixed = (testID: string, title: string, line: string) => (
    <View testID={testID} accessible style={styles.fixed}>
      <Text style={[styles.label, align]}>{title}</Text>
      <Text style={[styles.note, align]}>{line}</Text>
    </View>
  );
  const unit = (kind: 'half-day' | 'session') => (
    <View key={kind} testID={`rules-unit-${kind}`} accessible style={styles.unit}>
      <Text style={[styles.label, align]}>{t(kind === 'half-day' ? 'rules.unitHalf' : 'rules.unitSession')}</Text>
      <Text style={[styles.body, align]}>
        {t(kind === 'half-day' ? 'rules.unitHalfNote' : 'rules.unitSessionNote')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
            paddingBottom: insets.bottom + spacing['space-16'],
          },
        ]}
      >
        <Text style={[styles.note, align]}>{t('rules.scope')}</Text>
        <Text style={[styles.body, align]}>{t('rules.intro')}</Text>
        <View style={styles.card}>
          <View testID="rules-start" accessible style={styles.grow}>
            <Text style={[styles.label, align]}>{t('rules.start')}</Text>
            <Text style={[styles.note, align]}>{startLine(start)}</Text>
          </View>
          <View ref={change} collapsable={false}>
            <Button
              testID="rules-start-change"
              variant="plain"
              label={t('rules.change')}
              onPress={() => setChoosing(true)}
            />
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.rows}>
            {fixed('rules-holidays', t('rules.holidays'), t('rules.never'))}
            <CheckRow
              testID="rules-seminars"
              label={t('rules.countSeminars')}
              checked={rules.seminars === 'counted'}
              onCheckedChange={(on) => set({ seminars: on ? 'counted' : 'excluded' })}
            />
            <CheckRow
              testID="rules-not-held"
              label={t('rules.countNotHeld')}
              checked={rules.notHeld === 'counted'}
              onCheckedChange={(on) => set({ notHeld: on ? 'counted' : 'excluded' })}
            />
            {fixed('rules-single-shift', t('rules.singleShift'), t('rules.halfDay'))}
          </View>
        </View>
        {(['half-day', 'session'] as const).filter((kind) => kinds.has(kind)).map(unit)}
        <Button
          testID="rules-reset"
          variant="line"
          label={t('rules.reset')}
          disabled={isDefault(rules)}
          onPress={() => record({ kind: 'counting.set', rules: DEFAULT_COUNTING })}
        />
      </ScrollView>
      <BottomSheet
        testID="rules-start-sheet"
        visible={choosing}
        title={t('rules.startTitle')}
        context={t('rules.startContext')}
        reassurance={t('rules.intro')}
        returnFocusRef={change}
        onClose={() => setChoosing(false)}
      >
        {starts.map((day) => (
          <OptionRow
            key={day}
            testID={`rules-start-${day}`}
            label={startLine(day)}
            selected={day === start}
            onPress={() => {
              setChoosing(false);
              if (day !== start) set({ from: day });
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], padding: spacing['space-16'] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  grow: { flex: 1, gap: spacing['space-4'] },
  rows: { flex: 1, gap: spacing['space-8'] },
  fixed: { gap: spacing['space-4'], paddingVertical: spacing['space-8'] },
  unit: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.soft,
  },
  body: { ...typography.body, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
