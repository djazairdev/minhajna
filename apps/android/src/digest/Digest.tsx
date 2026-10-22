// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The weekly digest (#234, Digest, Digest-closure, Digest-primary, answers
// 402 and 405), for the teacher alone, worked out when it opens: the days
// it covers; the sessions awaiting confirmation, which open Today's list,
// with the week's confirmed and the earlier weeks' apart; each make-up due
// with «جدولتها»; the sessions lost to the calendar, apart, so a closure
// never reads as slow teaching; the next exam windows; each class behind a
// parallel one, with «مواءمة» on its plan, «خيارات الاستدراك» and «تجاهل»;
// then a card for each class. The footer says when the digest comes, and
// opens «الإشعارات».

import { weekDigest, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { DueStrip } from '../components/DueStrip';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { termName } from '../classes/plan-labels';
import { courseLabel } from '../exams/course-label';
import { dismissDrift, useDismissedDrifts } from '../plan/drift-dismissal';
import { useCountMinutes } from '../settings/preferences';
import { useNotifyPrefs } from '../settings/notify-prefs';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayAndMonth, dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { DigestClass, lostWhat } from './DigestClass';
import { digestClasses, examGroups, lastWorking, lostGroups, shownDrifts } from './digest-rules';

export type DigestProps = {
  readonly onBacklog: () => void;
  readonly onMakeUp: (courseId: string) => void;
  readonly onCatchUp: (courseId: string) => void;
  readonly onPlan: (courseId: string) => void;
  readonly onNotify: () => void;
};

export function Digest({ onBacklog, onMakeUp, onCatchUp, onPlan, onNotify }: DigestProps) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const data = useAppData();
  const { state, today } = data;
  const prefs = useNotifyPrefs();
  const minutes = useCountMinutes();
  const dismissed = useDismissedDrifts();
  const context = useMemo(() => coreContext(data), [data]);
  const day = today();
  const digest = useMemo(() => weekDigest(context, day, prefs.saturday), [context, day, prefs.saturday]);
  const groups = useMemo(() => (digest === null ? [] : lostGroups(context, digest.lost)), [context, digest]);
  const cards = useMemo(() => digestClasses(context, groups, day), [context, groups, day]);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const profile = context.ref.country;
  const language = currentLanguage();
  const named = (id: string) => isolate(courseLabel(t, state, profile, id));
  const on = (one: Day) => dayName(t, one, language, profile);
  const facts: string[] = [];
  const text = (line: string, testID?: string, key = line) => (
    <Text key={key} testID={testID} style={[styles.fact, align]}>
      {line}
    </Text>
  );

  if (digest === null) {
    return <View style={[styles.screen, { padding: spacing['space-16'] }]}>{text(t('digest.empty'))}</View>;
  }
  const school = (id: string) => isolate(state.schools.get(id)?.name ?? '');
  const many = new Set(cards.map((card) => card.row.schoolClass.schoolId)).size > 1;
  const schoolsOf = (courseIds: Iterable<string>) =>
    [...new Set([...courseIds].map((id) => state.classes.get(state.courses.get(id)?.classId ?? '')?.schoolId ?? ''))]
      .map(school)
      .join(t('daymark.andNames'));
  const windows = examGroups(context, digest.exams);
  for (const { entry, schoolIds } of windows) {
    const exams =
      entry.term === undefined
        ? isolate(localized(entry.name))
        : t('classPlan.driftExams', { term: termName(t, entry.term) });
    const at = { exams, day: dayAndMonth(entry.from, language, profile) };
    const schools = schoolIds.map(school).join(t('daymark.andNames'));
    facts.push(many ? t('digest.examsAt', { ...at, school: schools }) : t('digest.exams', at));
  }
  const confirmed =
    digest.sessions === 0
      ? t('digest.noSessions')
      : digest.awaiting === 0
        ? t('digest.allConfirmed', { count: digest.sessions })
        : t('digest.confirmed', { count: digest.confirmed, total: digest.sessions });
  const earlier =
    digest.earlier === 0 ? [] : [t('digest.earlier', { sessions: t('count.sessions', { count: digest.earlier }) })];
  const drifts = shownDrifts(digest.drifts, dismissed);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-16'],
        },
      ]}
    >
      {text(
        t('digest.range', {
          from: dayAndMonth(digest.from, language, profile),
          to: dayAndMonth(lastWorking(profile, digest, prefs.saturday), language, profile),
        }),
        'digest-range',
      )}
      {digest.awaiting + digest.earlier > 0 ? (
        <RowLink
          testID="digest-awaiting"
          icon={controlIcon('check')}
          title={t('digest.awaiting', { count: digest.awaiting + digest.earlier })}
          description={[confirmed, ...earlier].join('\n')}
          onPress={onBacklog}
        />
      ) : (
        text(confirmed, 'digest-confirmed')
      )}
      {digest.makeUps.map((one) => (
        <DueStrip
          key={one.key}
          testID={`digest-makeup-${one.key}`}
          icon={controlIcon('plus')}
          fact={t('digest.makeUp', { class: named(one.courseId), day: on(one.day) })}
          action={t('digest.schedule')}
          onOpen={() => onMakeUp(one.courseId)}
        />
      ))}
      <View testID="digest-facts" style={styles.group}>
        {groups.length === 0
          ? text(t('digest.noLost'))
          : [
              text(t('daymark.lost', { count: groups.reduce((sum, one) => sum + one.count, 0) })),
              ...groups.map((one, index) => {
                const what = isolate(lostWhat(t, one));
                const at = { day: on(one.day), sessions: t('count.sessions', { count: one.count }) };
                const line = many
                  ? t('digest.lostDayAt', { ...at, what, school: schoolsOf(one.courses.keys()) })
                  : t('digest.lostDay', { ...at, what });
                return text(line, undefined, `lost-${index}`);
              }),
              text(t('digest.lostNote')),
            ]}
        {facts.map((line, index) => text(line, undefined, `fact-${index}`))}
      </View>
      {drifts.map(({ courseId, drift }) => (
        <View key={courseId} testID={`digest-drift-${courseId}`} style={styles.card}>
          <View accessible style={styles.group}>
            <Badge label={t('classPlan.driftBadge')} variant="warning" />
            {text(
              t('classPlan.drift', {
                count: drift.gap,
                here: named(courseId),
                there: named(drift.other),
                before:
                  drift.before.kind === 'test'
                    ? t('tests.quoted', { title: isolate(drift.before.title) })
                    : t('classPlan.driftExams', { term: termName(t, drift.before.term) }),
                day: on(drift.before.day),
              }),
            )}
          </View>
          <Button testID={`digest-align-${courseId}`} label={t('digest.align')} onPress={() => onPlan(courseId)} />
          <Button
            testID={`digest-drift-catchup-${courseId}`}
            variant="line"
            label={t('catchUp.open')}
            onPress={() => onCatchUp(courseId)}
          />
          <Button
            testID={`digest-dismiss-${courseId}`}
            variant="plain"
            label={t('classPlan.driftDismiss')}
            onPress={() => dismissDrift(courseId, drift, day)}
          />
        </View>
      ))}
      {cards.map((card) => (
        <DigestClass key={card.row.course.id} context={context} card={card} minutes={minutes} onCatchUp={onCatchUp} />
      ))}
      {text(t(prefs.saturday ? 'digest.footerSaturday' : 'digest.footer'), 'digest-footer')}
      {!prefs.digest && text(t('digest.off'), 'digest-off')}
      <RowLink
        testID="digest-notify"
        icon={controlIcon('tune')}
        title={t('settings.rows.notifications')}
        onPress={onNotify}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  group: { gap: spacing['space-4'], alignItems: 'stretch' },
  fact: { ...typography.body, color: colors.ink2 },
  card: {
    gap: spacing['space-10'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
});
