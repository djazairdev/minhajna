// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class on a stale pack (#230, Plan-stale, answer 382): the pack proposes
// nothing in the sessions, with its reason, and the ways to work with the
// class. «استعماله بحذر» shows the pack as printed, a reference only, with
// each session written freely and no buffer or delay counted from it.
// «كتابة العناصر», once confirmed, leaves the pack for the class's own list,
// which proposes the next item in each session; «تغيير الحزمة» can pin a
// release again. «سؤال المفتش» prints a sheet with the pack, its release
// and its reason, to show the inspector.
// A release in force, once published, shows in «تغيير الحزمة».

import type { PackItem, PlanPack, PlanRow } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { OptionRow } from '../components/OptionRow';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { PlanRows, weekPack } from './PlanRows';

export type StalePlanProps = {
  readonly pack: PlanPack;
  readonly rows: readonly PlanRow[];
  readonly heads: readonly PackItem[];
  /** Leaves the pack and opens the class's own list, once confirmed. */
  readonly onWrite?: () => void;
  /** Opens «سؤال المفتش», the sheet to print for the inspector. */
  readonly onAsk?: () => void;
};

export function StalePlan({ pack, rows, heads, onWrite, onAsk }: StalePlanProps) {
  const t = useText();
  const { direction } = useLocale();
  const [care, setCare] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <>
      <View testID="plan-stale" accessible style={styles.card}>
        <Text style={[styles.title, align]}>{t('classPlan.stale.title')}</Text>
        {pack.staleReason !== undefined && (
          <Text style={[styles.body, align]}>
            {t('classPlan.stale.reason', { reason: isolate(localized(pack.staleReason)) })}
          </Text>
        )}
        <Text style={[styles.note, align]}>{t('classPlan.stale.check')}</Text>
      </View>
      <View style={styles.group}>
        <Text accessibilityRole="header" style={[styles.label, align]}>
          {t('classPlan.stale.ways')}
        </Text>
        <OptionRow
          testID="plan-stale-care"
          label={t('classPlan.stale.care')}
          sub={t('classPlan.stale.careSub')}
          selected={care}
          onPress={() => setCare(!care)}
        />
        {onWrite !== undefined && (
          <OptionRow
            testID="plan-stale-write"
            label={t('classPlan.stale.write')}
            sub={t('classPlan.stale.writeSub')}
            onPress={() =>
              Alert.alert(t('classPlan.stale.write'), t('classPlan.stale.writeAsk'), [
                { text: t('classPlan.stale.cancel'), style: 'cancel' },
                { text: t('classPlan.stale.writeConfirm'), onPress: onWrite },
              ])
            }
          />
        )}
        {onAsk !== undefined && (
          <OptionRow
            testID="plan-stale-ask"
            label={t('staleQuestion.title')}
            sub={t('staleQuestion.openSub')}
            onPress={onAsk}
          />
        )}
        <Text style={[styles.note, align]}>{t('classPlan.stale.newer')}</Text>
      </View>
      {care && (
        <>
          <Text testID="plan-stale-note" style={[styles.note, align]}>
            {t('classPlan.stale.careNote')}
          </Text>
          <PlanRows rows={rows} heads={heads} later={new Set()} by={weekPack(pack) ? 'week' : 'unit'} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  group: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
