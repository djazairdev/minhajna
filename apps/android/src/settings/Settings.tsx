// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { signatureStatus } from '../drawn/DrawnSignature';
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
  'notifications',
  'security',
  'language',
  'log',
  'export',
  'retention',
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
  { id: 'phone', rows: ['notifications', 'security', 'backup', 'language'] },
  { id: 'data', rows: ['log', 'export', 'retention'] },
  { id: 'help', rows: ['help', 'privacy'] },
] as const;

/** The teacher's settings, with existing screens reachable without running setup again (#233). */
export function Settings({ onOpen }: { onOpen: (target: SettingTarget, schoolId?: string) => void }) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { state, profile, unsaved } = useAppData();
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
      {SECTIONS.map((section) => (
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
                  if (target !== undefined) onOpen(target);
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
