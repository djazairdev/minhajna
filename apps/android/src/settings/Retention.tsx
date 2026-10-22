// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مدة الحفظ» in Settings (#235, Settings-retention, R-5.7-02, answer 428):
// lesson records, pupil data and private notes, each with the drawn default
// and the teacher's other choice, kept the moment it changes; under pupil
// data and lesson records, the month each school year's erasure would be
// offered. The log follows what it describes and has no choice. Nothing is
// erased here: export and erase (#248) offers it, exporting first.

import {
  erasureOffers,
  retentionOf,
  type CountryProfile,
  type Day,
  type Retention as RetentionChoice,
  type State,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import type { Translate } from '../documents/document-data';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText, type Language } from '../text/i18n';
import { settingsStyles as styles } from './styles';

/** The month an offer falls in, such as «جويلية 2028». */
function offerMonth(profile: Pick<CountryProfile, 'months'>, lang: Language, day: Day): string {
  const name = profile.months?.[Number(day.slice(5, 7)) - 1]?.[lang] ?? day.slice(5, 7);
  return `${name} ${day.slice(0, 4)}`;
}

/** The Settings row's line: lesson records, then pupil data, as chosen. */
export function retentionLine(t: Translate, state: Pick<State, 'retention'>): string {
  const { lessons, pupils } = retentionOf(state);
  return t('settings.retentionLine', {
    lessons: t(lessons === 'kept' ? 'settings.retention.lessonsShort' : 'settings.retention.lessonsShortThree'),
    pupils: t(
      pupils === 'after-next-year' ? 'settings.retention.pupilsShortNext' : 'settings.retention.pupilsShortOwn',
    ),
  });
}

export function Retention() {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { state, profile, recordFrom } = useAppData();
  const lang = currentLanguage();
  const retention = retentionOf(state);
  const offers = erasureOffers(state);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const choose =
    <K extends keyof RetentionChoice>(key: K) =>
    (value: RetentionChoice[K]) =>
      recordFrom((latest) => {
        const current = retentionOf(latest);
        return current[key] === value ? null : { kind: 'retention.set', retention: { ...current, [key]: value } };
      });
  const marked = (label: string, isDefault: boolean) =>
    isDefault ? `${label} · ${t('settings.retention.default')}` : label;
  const card = (id: string, title: string, line: string) => (
    <>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {title}
      </Text>
      <Text testID={`retention-${id}-line`} style={[styles.sub, align]}>
        {line}
      </Text>
    </>
  );
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
      <Text style={[styles.sub, align]}>{t('settings.retention.intro')}</Text>
      <View testID="retention-lessons" style={styles.card}>
        {card('lessons', t('settings.retention.lessons'), t('settings.retention.lessonsLine'))}
        <RadioCardGroup
          testID="retention-lessons-choice"
          label={t('settings.retention.lessons')}
          selected={retention.lessons}
          onSelect={choose('lessons')}
          choices={[
            {
              value: 'kept',
              label: marked(t('settings.retention.lessonsKept'), true),
              description: t('settings.retention.lessonsKeptLine'),
            },
            {
              value: 'after-three-years',
              label: t('settings.retention.lessonsThree'),
              description: t('settings.retention.lessonsThreeLine'),
            },
          ]}
        />
        <Text style={[styles.sub, align]}>{t('settings.retention.lessonsCompare')}</Text>
      </View>
      <View testID="retention-pupils" style={styles.card}>
        {card('pupils', t('settings.retention.pupils'), t('settings.retention.pupilsLine'))}
        <RadioCardGroup
          testID="retention-pupils-choice"
          label={t('settings.retention.pupils')}
          selected={retention.pupils}
          onSelect={choose('pupils')}
          choices={[
            {
              value: 'after-next-year',
              label: marked(t('settings.retention.pupilsNext'), true),
              description: t('settings.retention.pupilsNextLine'),
            },
            {
              value: 'after-its-year',
              label: t('settings.retention.pupilsOwn'),
              description: t('settings.retention.pupilsOwnLine'),
            },
          ]}
        />
        {offers.map((offer) => (
          <View key={offer.year} testID={`retention-offer-${offer.year}`} accessible>
            <Text style={[styles.body, align]}>
              {t('settings.retention.pupilsOn', { year: offer.year, month: offerMonth(profile, lang, offer.pupils) })}
            </Text>
            {offer.lessons !== null && (
              <Text style={[styles.body, align]}>
                {t('settings.retention.lessonsOn', {
                  year: offer.year,
                  month: offerMonth(profile, lang, offer.lessons),
                })}
              </Text>
            )}
          </View>
        ))}
        <Notice testID="retention-how" icon={controlIcon('info')} message={t('settings.retention.howNotice')} />
      </View>
      <View testID="retention-notes" style={styles.card}>
        {card('notes', t('settings.retention.notes'), t('settings.retention.notesLine'))}
        <RadioCardGroup
          testID="retention-notes-choice"
          label={t('settings.retention.notes')}
          selected={retention.notes}
          onSelect={choose('notes')}
          choices={[
            {
              value: 'kept',
              label: marked(t('settings.retention.notesKept'), true),
              description: t('settings.retention.notesKeptLine'),
            },
            {
              value: 'with-pupils',
              label: t('settings.retention.notesPupils'),
              description: t('settings.retention.notesPupilsLine'),
            },
          ]}
        />
      </View>
      <View testID="retention-log" style={styles.card}>
        {card('log', t('settings.retention.log'), t('settings.retention.logLine'))}
        <Text style={[styles.body, align]}>{t('settings.retention.logDefault')}</Text>
        <Text style={[styles.sub, align]}>{t('settings.retention.logNote')}</Text>
      </View>
      <Notice testID="retention-school" icon={controlIcon('school')} message={t('settings.retention.schoolNotice')} />
    </ScrollView>
  );
}
