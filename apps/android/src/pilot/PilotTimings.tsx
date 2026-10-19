// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «توقيتاتي في التجربة» (Pilot-timings, #220, R-10.3-03, R-10.3-04, choice
// P7, answer 267): what the phone measured, on this phone only. Four cards:
// the median seconds per session, the share confirmed in one tap, the
// minutes a week on sessions and roll calls, and the term's export. Then
// exactly what would be sent, and what never is. Nothing is sent by the app:
// «مشاركة هذه الأرقام» opens the phone's share sheet with those lines, and
// the teacher picks where they go, once. The design's switch to send them
// to the project's server is left out, as the build asks for no network
// (choices P4 and P7). «مسح القياسات» deletes the timings after a question.

import { timingSummary, type Timing } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import build from '../native/NativeMinhajnaBuild';
import { useText } from '../text/i18n';
import { sharedLines, shareText, timingCards, type TimingCard } from './timing-figures';
import type { TimingStore } from './timing-store';

type Loaded =
  { readonly kind: 'loading' } | { readonly kind: 'failed' } | { readonly kind: 'ready'; timings: Timing[] };

export function PilotTimings({ store }: { readonly store: TimingStore }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [version, setVersion] = useState('');
  const [asking, setAsking] = useState(false);
  const [cleared, setCleared] = useState(false);
  const clearRef = useRef<ViewInstance>(null);
  const load = useCallback(() => {
    store.load().then(
      (timings) => setLoaded({ kind: 'ready', timings }),
      () => setLoaded({ kind: 'failed' }),
    );
  }, [store]);
  useEffect(() => {
    load();
    build.describe().then(
      (facts) => setVersion(facts.version),
      () => undefined,
    );
  }, [load]);
  const summary = useMemo(() => timingSummary(loaded.kind === 'ready' ? loaded.timings : []), [loaded]);
  const lines = sharedLines(t, summary, version);
  const clear = () => {
    setAsking(false);
    store.clear().then(
      () => {
        setCleared(true);
        load();
      },
      () => setLoaded({ kind: 'failed' }),
    );
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <View style={styles.head}>
        <Text style={styles.scope}>{t('pilotTimings.scope')}</Text>
        <Badge testID="timings-badge" label={t('pilotTimings.badge')} />
      </View>
      <Text style={styles.body}>{t('pilotTimings.intro')}</Text>
      {loaded.kind === 'failed' && (
        <Notice testID="timings-failed" icon={controlIcon('info')} message={t('pilotTimings.failed')} />
      )}
      {loaded.kind === 'ready' && summary.weeks === 0 && (
        <Notice testID="timings-none" icon={controlIcon('info')} message={t('pilotTimings.none')} />
      )}
      {cleared && <Notice testID="timings-cleared" icon={controlIcon('check')} message={t('pilotTimings.cleared')} />}
      <View style={styles.grid}>
        {timingCards(t, summary).map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </View>
      <Notice icon={controlIcon('info')} message={t('pilotTimings.note')} />
      {lines.length > 0 && (
        <>
          <Text style={styles.heading}>{t('pilotTimings.sent')}</Text>
          <View testID="timings-sent" style={styles.sent}>
            {lines.map((line) => (
              <View key={line.label} style={styles.line} accessible accessibilityLabel={`${line.label}: ${line.value}`}>
                <Text style={styles.lineLabel}>{line.label}</Text>
                <Text style={styles.lineValue}>{line.value}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Text style={styles.heading}>{t('pilotTimings.never')}</Text>
      {(['neverDay', 'neverClasses', 'neverMe'] as const).map((key) => (
        <View key={key} style={styles.never}>
          <Text style={styles.cross} accessible={false} importantForAccessibility="no">
            ×
          </Text>
          <Text style={styles.body}>{t(`pilotTimings.${key}`)}</Text>
        </View>
      ))}
      <Button
        testID="timings-share"
        label={t('pilotTimings.share')}
        disabled={lines.length === 0}
        onPress={() => {
          Share.share({ message: shareText(t, lines), title: t('pilotTimings.shareTitle') }).catch(() => undefined);
        }}
      />
      <Text style={styles.small}>{t('pilotTimings.shareLine')}</Text>
      <Button
        testID="timings-clear"
        ref={clearRef}
        variant="line"
        label={t('pilotTimings.clear')}
        disabled={loaded.kind === 'loading' || (loaded.kind === 'ready' && loaded.timings.length === 0)}
        onPress={() => setAsking(true)}
      />
      <BottomSheet
        testID="timings-clear-sheet"
        visible={asking}
        title={t('pilotTimings.clearTitle')}
        context={t('pilotTimings.title')}
        reassurance={t('pilotTimings.clearLine')}
        returnFocusRef={clearRef}
        onClose={() => setAsking(false)}
      >
        <View style={styles.actions}>
          <Button testID="timings-clear-yes" variant="danger" label={t('pilotTimings.clearYes')} onPress={clear} />
          <Button
            testID="timings-clear-no"
            variant="line"
            label={t('pilotTimings.cancel')}
            onPress={() => setAsking(false)}
          />
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

function Card({ card }: { readonly card: TimingCard }) {
  const label = [card.value, card.unit, card.label, card.line].filter((part) => part !== undefined && part !== '');
  return (
    <View testID={`timings-${card.id}`} style={styles.card} accessible accessibilityLabel={label.join(' ')}>
      <Text style={styles.value}>
        {card.value}
        {card.unit !== undefined && <Text style={styles.unit}>{` ${card.unit}`}</Text>}
      </Text>
      <Text style={styles.label}>{card.label}</Text>
      {card.line !== '' && <Text style={styles.small}>{card.line}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-8'] },
  scope: { ...typography.body, color: colors.pencil, flexShrink: 1 },
  body: { ...typography.body, color: colors.ink, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-10'] },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 150,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-4'],
  },
  value: { ...typography.stat, color: colors.ink },
  unit: { ...typography.body, color: colors.ink },
  label: { ...typography.body, color: colors.ink },
  small: { ...typography.caption, color: colors.ink2 },
  heading: { ...typography.h3, color: colors.ink },
  sent: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  line: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'], justifyContent: 'space-between' },
  lineLabel: { ...typography.caption, color: colors.pencil },
  lineValue: { ...typography.body, color: colors.ink, flexShrink: 1 },
  never: { flexDirection: 'row', gap: spacing['space-8'], alignItems: 'flex-start' },
  cross: { ...typography.body, color: colors.ink },
  actions: { gap: spacing['space-10'] },
});
