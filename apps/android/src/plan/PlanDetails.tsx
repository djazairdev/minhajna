// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A plan pack's details (#225, Plan-details, Plan-details-link, R-4.2-10,
// R-4.2-11): its status and what it means, the issuer as printed, the
// edition, the pack's ID and release, its source pages, where the file was
// found, the licence mode, the timing and who keyed it. A link-only pack
// lists its items with their sessions and source pages, each opening its
// source in the browser after the teacher confirms (answer 289); the
// suggestion works from the titles alone, with no network.

import { budgetInSessions, courseSetup, queueItems, type PackItem } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { packTiming } from './pack-labels';
import { sourceAddress, sourceHost, sourcePages } from './pack-source';

export function PlanDetails({ courseId }: { readonly courseId: string }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, packs } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const { pack, sessionMinutes } = courseSetup(context, courseId);
  if (pack === null) return null;
  const pages = sourcePages(pack);
  const open = (address: string) =>
    Alert.alert(t('planDetails.openSource'), t('planDetails.sourceNotice', { host: isolate(sourceHost(address)) }), [
      { text: t('help.cancel'), style: 'cancel' },
      {
        text: t('help.openBrowser'),
        onPress: () => {
          void Linking.openURL(address).catch(() =>
            Alert.alert(t('planDetails.openSource'), t('planDetails.sourceRefused')),
          );
        },
      },
    ]);
  const fact = (id: string, label: string, value: string) => (
    <View key={id} testID={`pack-${id}`} accessible style={styles.group}>
      <Text style={[styles.sub, align]}>{label}</Text>
      <Text style={[styles.body, align]}>{value}</Text>
    </View>
  );
  const item = (one: PackItem, index: number) => {
    const sessions = t('planDetails.sessions', { count: budgetInSessions(pack, one, sessionMinutes) });
    const address = sourceAddress(pack, one);
    return (
      <View key={one.id} testID={`pack-item-${one.id}`} style={styles.group}>
        <Text style={[styles.title, align]}>{`${index + 1}. ${isolate(one.title)}`}</Text>
        <Text style={[styles.sub, align]}>
          {one.sourcePage === undefined ? sessions : t('planDetails.sourcePage', { sessions, page: one.sourcePage })}
        </Text>
        {address !== null && (
          <Button
            testID={`pack-source-${one.id}`}
            variant="line"
            label={t('planDetails.openSource')}
            accessibilityHint={t('planDetails.openSourceOf', { title: isolate(one.title) })}
            onPress={() => open(address)}
          />
        )}
      </View>
    );
  };
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
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', direction }}>
          <Badge label={t(`plan.status.${pack.status}`)} />
        </View>
        <Text style={[styles.body, align]}>{t(`plan.meaning.${pack.status}`)}</Text>
      </View>
      {fact('issuer', t('planDetails.issuer'), isolate(pack.provenance.issuer))}
      {fact('edition', t('planDetails.edition'), isolate(pack.provenance.edition))}
      {fact('id', t('planDetails.id'), `${pack.id} · ${pack.release}`)}
      {fact(
        'pages',
        t('planDetails.pages'),
        pages === null ? t('planDetails.pagesNone') : t('planDetails.pagesRange', pages),
      )}
      {fact(
        'found',
        t('planDetails.foundAt'),
        pack.provenance.foundAt === undefined ? t('planDetails.notStated') : isolate(pack.provenance.foundAt),
      )}
      {fact('licence', t('planDetails.licence'), t(`planDetails.licences.${pack.licence}`))}
      {fact('timing', t('planDetails.timing'), packTiming(t, pack))}
      {pack.status !== 'example' && fact('keyed', t('planDetails.keyed'), t('classPlan.keyedBy'))}
      {pack.licence === 'link-only' && (
        <View testID="pack-items" style={styles.group}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('planDetails.items')}
          </Text>
          {[...queueItems(pack, 'main'), ...queueItems(pack, 'td')].map(item)}
          <Text style={[styles.sub, align]}>{t('planDetails.linkNote')}</Text>
        </View>
      )}
    </ScrollView>
  );
}
