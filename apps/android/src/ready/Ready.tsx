// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup-7-Ready (#31): what setup kept, the September check of each grade
// and subject before its term's exams, and the next session with what the
// plan proposes for it. The printed check for an inspector comes with #44.

import { addDays, findSessionType, formatDayWithMonth, weekday, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { WelcomeHero } from '../components/WelcomeHero';
import { Icon } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { groupName } from '../plan/pack-labels';
import { pinOfClass, planGroups } from '../plan/plan-rules';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { coreContext } from '../storage/core-context';
import { sessionTime, timesSchools } from '../times/times-rules';
import { isolate } from '../week/grid-labels';
import { CheckTable } from './CheckTable';
import { startDay, checkGroups, checkTerm, nextSession, spareOf, weekMinutes, type CheckGroup } from './ready-rules';

/** The end of setup; `onDone` opens the day's page. */
export function Ready({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, bells, packs, today } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const language = currentLanguage();
  const comma = language === 'ar' ? '، ' : ', ';
  const day = today();

  const { context, groups, checks, next } = useMemo(() => {
    const made = coreContext({ profile, year, calendar, packs, state });
    const start = startDay(year, day);
    const term = checkTerm(year, start);
    const all = planGroups(state);
    return {
      context: made,
      groups: all,
      checks: term === undefined ? [] : checkGroups(made, all, year.id, term),
      next: nextSession(made, start),
    };
  }, [profile, year, calendar, packs, state, day]);

  const named = (on: Day) => `${t(`week.days.${weekday(on)}`)} ${formatDayWithMonth(on, language, profile)}`;
  const pupils = [...state.pupils.values()].filter((pupil) => state.classes.has(pupil.classId)).length;
  const hours = Math.round(weekMinutes(context) / 30) / 2;
  const kept = [
    t('ready.summary', {
      classes: t('ready.classes', { count: state.classes.size }),
      pupils: t('setup.pupils', { count: pupils }),
    }),
    t('ready.week', {
      hours: t('ready.hours', { count: hours }),
      schools: timesSchools(state)
        .map((school) => isolate(school.name))
        .join(comma),
    }),
    ...groups.map((group) => {
      const pinned = group.classes.filter(
        (one) => pinOfClass(state, one.id, group.subject, year.id, group.grade) !== null,
      ).length;
      const key =
        pinned === 0 ? 'ready.pinnedNone' : pinned < group.classes.length ? 'ready.pinnedSome' : 'ready.pinnedAll';
      return t(key, { group: groupName(t, profile, group) });
    }),
    t('plan.calendar', { year: isolate(year.id) }),
  ];

  const checkCard = ({ group, rows }: CheckGroup) => {
    const first = rows[0].check;
    const date = formatDayWithMonth(
      first.basis === 'exam-window' ? first.before : addDays(first.before, -1),
      language,
      profile,
    );
    const shown =
      first.confidence === null || first.confidence === 'announced' ? date : t('ready.expectedDate', { date });
    const title = t(first.basis === 'exam-window' ? 'ready.checkExams' : 'ready.checkEnd', {
      term: t(`ready.terms.${first.term as 1 | 2 | 3}`),
      date: shown,
    });
    const gaps = rows.map(({ schoolClass, check }) => {
      const spare = spareOf(check);
      const values = { name: isolate(schoolClass.name), sessions: t('count.sessions', { count: Math.abs(spare) }) };
      return t(spare > 0 ? 'ready.spare' : spare < 0 ? 'ready.short' : 'ready.even', values);
    });
    const anySpare = rows.some(({ check }) => spareOf(check) > 0);
    const anyTd = rows.some(({ check }) => check.td.gives > 0 || check.td.items > 0);
    return (
      <View key={group.key} testID={`ready-check-${group.key}`} style={styles.card}>
        <Text accessibilityRole="header" style={[styles.label, align]}>
          {title}
        </Text>
        {checks.length > 1 && <Text style={[styles.body, align]}>{groupName(t, profile, group)}</Text>}
        <Text style={[styles.body, align]}>{t('ready.checkIntro')}</Text>
        <CheckTable rows={rows} testID={`ready-table-${group.key}`} />
        {gaps.map((line) => (
          <Text key={line} style={[styles.note, align]}>
            {line}
          </Text>
        ))}
        {anySpare && <Text style={[styles.note, align]}>{t('ready.spareNote')}</Text>}
        {anyTd && <Text style={[styles.note, align]}>{t('ready.tdNote')}</Text>}
      </View>
    );
  };

  const nextCard = () => {
    if (next === null) return null;
    const { session, schoolClass } = next;
    const school = state.schools.get(schoolClass.schoolId);
    const time = sessionTime({ bells, calendar, state }, school, session.slot, session.day);
    const what =
      next.proposal ?? (next.sessionType === null ? null : localized(findSessionType(profile, next.sessionType).name));
    return (
      <View testID="ready-next" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.label, align]}>
          {t('ready.next')}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.chip}>{isolate(schoolClass.name)}</Text>
          {time !== null && <Text style={styles.body}>{span(time.from, time.to, direction)}</Text>}
          <Text style={[styles.body, align]}>{named(session.day)}</Text>
        </View>
        {next.proposal !== null ? (
          <View style={styles.proposal}>
            <Text style={[styles.tag, align]}>{t('ready.proposed')}</Text>
            <Text style={[styles.body, align]}>{what}</Text>
          </View>
        ) : (
          <Text style={[styles.body, align]}>{what ?? t('ready.typed')}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WelcomeHero title={t('ready.title')} tagline={t('ready.tagline')} small />
        <View style={[styles.content, sides]}>
          <View testID="ready-kept" style={styles.kept}>
            {kept.map((line) => (
              <View key={line} style={styles.keptRow}>
                <Icon name="check" size={sizes['icon-small']} color={colors.board} />
                <Text style={[styles.body, styles.keptText, align]}>{line}</Text>
              </View>
            ))}
          </View>
          {checks.length === 0 ? (
            <View testID="ready-no-check" style={styles.card}>
              <Text style={[styles.body, align]}>{t('ready.noCheck')}</Text>
            </View>
          ) : (
            checks.map(checkCard)
          )}
          {nextCard()}
        </View>
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="ready-today" label={t('ready.today')} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1 },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'], paddingBottom: spacing['space-16'] },
  kept: { gap: spacing['space-2'] },
  keptRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  keptText: { flex: 1 },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  label: { ...typography.label, color: colors.ink },
  tag: { ...typography.tag, color: colors.ink2 },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  chip: {
    ...typography.label,
    color: colors.chalk,
    backgroundColor: colors.board,
    borderRadius: radius['radius-chip'],
    paddingHorizontal: spacing['space-12'],
    paddingVertical: spacing['space-4'],
  },
  proposal: {
    gap: spacing['space-4'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.due,
  },
  foot: { paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
