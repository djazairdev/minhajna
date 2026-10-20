// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDay, hoursOn, nextRamadan, ramadanLength, templateFor } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Notice } from '../components/Notice';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { settingsStyles as styles } from './styles';

/** Reference data, never an editor: missing primary rules stay missing, and provisional sources say so. */
export function Lengths({ onTimes }: { onTimes: () => void }) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { profile, bells, calendar, state, today } = useAppData();
  const day = today();
  const entries = [...calendar, ...state.calendar];
  const ramadan = nextRamadan(entries, day);
  const levels = new Set([...state.schools.values()].flatMap((school) => school.levels));
  const align = { writingDirection: direction, textAlign: 'start' } as const;
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
      <View testID="lengths-today" style={styles.card}>
        <Text style={[styles.title, align]}>{formatDay(day)}</Text>
        <Badge label={t(hoursOn(entries, day) === 'ramadan' ? 'times.ramadanNow' : 'times.usualNow')} />
      </View>
      <Text style={[styles.body, align]}>{t('settings.lengthsIntro')}</Text>
      {profile.levels.map((level) => {
        const template = templateFor(bells, level.code, 'single');
        const shortened = ramadanLength(bells, level.code);
        return (
          <View key={level.code} testID={`lengths-${level.code}`} style={styles.card}>
            <Text accessibilityRole="header" style={[styles.title, align]}>
              {localized(level.name)}
            </Text>
            {levels.has(level.code) && <Badge label={t('settings.myLevel')} />}
            <Text style={[styles.body, align]}>
              {t('settings.usual')}: {t('settings.minutes', { count: level.sessionMinutes })}
            </Text>
            <Text style={[styles.sub, align]}>{t('settings.reference', { release: profile.release })}</Text>
            <Text style={[styles.sub, align]}>
              {template === null ? t('settings.noTemplate') : t('settings.source', { source: template.source })}
            </Text>
            <Text style={[styles.title, align]}>{t('settings.ramadan')}</Text>
            {shortened === null ? (
              <Text testID={`lengths-no-ramadan-${level.code}`} style={[styles.body, align]}>
                {t('settings.noRamadan')}
              </Text>
            ) : (
              <>
                <Text style={[styles.body, align]}>{t('settings.minutes', { count: shortened.minutes })}</Text>
                <Badge label={t(`settings.confidence.${shortened.confidence}`)} variant="warning" />
                <Text style={[styles.sub, align]}>{t('settings.source', { source: shortened.source })}</Text>
              </>
            )}
            {ramadan !== null && (
              <Text style={[styles.sub, align]}>
                {t('settings.range', { from: formatDay(ramadan.from), to: formatDay(ramadan.to) })} ·{' '}
                {t(`settings.confidence.${ramadan.confidence}`)}
              </Text>
            )}
          </View>
        );
      })}
      <Notice icon={controlIcon('check')} message={t('settings.lengthsRule')} />
      <RowLink testID="lengths-times" icon={controlIcon('school')} title={t('settings.rows.times')} onPress={onTimes} />
    </ScrollView>
  );
}
