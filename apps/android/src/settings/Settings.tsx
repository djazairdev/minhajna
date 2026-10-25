// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { courseSetup } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { RowLink } from '../components/RowLink';
import { SectionHeader } from '../components/SectionHeader';
import { Switch } from '../components/Switch';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { signatureStatus } from '../drawn/DrawnSignature';
import { backupLine } from './backup-line';
import { retentionLine } from './Retention';
import { setCountMinutes, useCountMinutes } from './preferences';
import { settingsStyles as styles } from './styles';

const AVAILABLE = [
  'card',
  'schools',
  'classes',
  'week',
  'times',
  'lengths',
  'plans',
  'calendar',
  'updates',
  'rules',
  'print',
  'signature',
  'statement',
  'notifications',
  'security',
  'backup',
  'language',
  'log',
  'export',
  'retention',
  'erase',
  'help',
  'privacy',
] as const;

/** Only implemented destinations can receive an action; future rows stay disabled. */
export type SettingTarget = (typeof AVAILABLE)[number];

const SECTIONS = [
  {
    id: 'teaching',
    rows: ['card', 'schools', 'classes', 'week', 'times', 'lengths', 'plans', 'calendar', 'updates', 'rules'],
  },
  { id: 'documents', rows: ['print', 'signature'] },
  { id: 'sharing', rows: ['statement'] },
  { id: 'phone', rows: ['notifications', 'security', 'backup', 'language'] },
  { id: 'data', rows: ['log', 'export', 'retention', 'erase'] },
  { id: 'help', rows: ['help', 'privacy'] },
] as const;

/**
 * The teacher's settings, with existing screens reachable without running setup again (#233); «بيان التقدّم» opens on
 * the first class with a plan, and shows only when one has a plan (answer 486).
 */
export function Settings({ onOpen }: { onOpen: (target: SettingTarget, id?: string) => void }) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { state, profile, year, calendar, calendarRelease, packs, unsaved, entries } = useAppData();
  const context = coreContext({ profile, year, calendar, calendarRelease, packs, state });
  const withPlan = [...state.courses.values()].filter((course) => courseSetup(context, course.id).pack !== null);
  const planned = withPlan.find((course) => course.year === year.id) ?? withPlan[0];
  const minutes = useCountMinutes();
  const [failed, setFailed] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const descriptions = {
    card: t('settings.cardLine'),
    schools: t('settings.schoolsLine'),
    week: t('settings.weekLine'),
    times: t('settings.timesLine'),
    plans: t('settings.plansLine'),
    signature: signatureStatus(t, state.personal),
    log: t('settings.logLine'),
    export: t('settings.exportLine'),
    retention: retentionLine(t, state),
    erase: t('settings.eraseLine'),
    backup: backupLine(t, entries(), profile),
    statement: t('settings.statementLine'),
  };
  const schools = [...state.schools.values()];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text testID="settings-summary" style={[styles.sub, align]}>
        {[state.personal?.name, ...schools.map((school) => school.name)].filter(Boolean).join(' · ')}
      </Text>
      {(failed || unsaved) && (
        <Notice
          testID="settings-unsaved"
          icon={controlIcon('info')}
          message={t(unsaved ? 'setup.notSaved' : 'settings.failed')}
        />
      )}
      {SECTIONS.filter((section) => section.id !== 'sharing' || planned !== undefined).map((section) => (
        <View key={section.id} style={styles.group}>
          <SectionHeader label={t(`settings.${section.id}`)} />
          {section.rows.map((id) => {
            const target = AVAILABLE.find((candidate) => candidate === id);
            const description =
              target === undefined
                ? t('settings.later')
                : id in descriptions
                  ? descriptions[id as keyof typeof descriptions]
                  : undefined;
            return (
              <RowLink
                key={id}
                testID={`settings-${id}`}
                icon={controlIcon('tune')}
                title={t(`settings.rows.${id}`)}
                description={description}
                disabled={target === undefined}
                onPress={() => {
                  if (target === 'statement') onOpen(target, planned?.id);
                  else if (target !== undefined) onOpen(target);
                }}
              />
            );
          })}
          {section.id === 'teaching' && (
            <>
              <Switch
                testID="settings-minutes"
                label={t('settings.minutesTitle')}
                description={t('settings.minutesLine')}
                value={minutes}
                onValueChange={(value) => {
                  try {
                    setCountMinutes(value);
                    setFailed(false);
                  } catch {
                    setFailed(true);
                  }
                }}
              />
              {schools.map((school) => (
                <View key={school.id} testID={`settings-school-${school.id}`} style={styles.card}>
                  <Text accessibilityRole="header" style={[styles.title, align]}>
                    {school.name}
                  </Text>
                  <Text style={[styles.sub, align]}>
                    {school.subjects
                      .map((code) => {
                        const subject = profile.subjects.find((one) => one.code === code);
                        return subject === undefined ? code : localized(subject.name);
                      })
                      .join(' · ')}
                  </Text>
                  <RowLink
                    testID={`settings-school-times-${school.id}`}
                    icon={controlIcon('school')}
                    title={t('settings.rows.times')}
                    onPress={() => onOpen('times', school.id)}
                  />
                  <RowLink
                    testID={`settings-school-plans-${school.id}`}
                    icon={controlIcon('tune')}
                    title={t('settings.rows.plans')}
                    onPress={() => onOpen('plans', school.id)}
                  />
                </View>
              ))}
            </>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
