// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سجل المشاركة» (#439, Share, R-3.10-10, answer 486): every statement of the
// teacher's classes that left, newest first, by its day alone, its class and
// how it left, then the role it went to or «دون مستلم بعد». A row opens «لمن؟»
// to say or change the role; the history keeps what was said before.

import type { SharedStatement } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SectionHeader } from '../components/SectionHeader';
import { colors, radius, spacing, typography } from '../design/tokens';
import { logDay } from '../log/log-text';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { shareClass, shareHow, shareTo } from './share-words';

export type ShareHistoryProps = {
  readonly shares: readonly SharedStatement[];
  readonly onShare: (share: SharedStatement) => void;
};

export function ShareHistory({ shares, onShare }: ShareHistoryProps) {
  const t = useText();
  const { direction } = useLocale();
  const { state } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View style={styles.group}>
      <SectionHeader testID="statement-history" label={t('statement.history')} />
      {shares.length === 0 ? (
        <Text style={[styles.note, align]}>{t('statement.historyNone')}</Text>
      ) : (
        <View style={[styles.card, { direction }]}>
          {shares.map((share, index) => {
            const head = [logDay(share.day), shareClass(state, share.courseId), shareHow(t, share.how)].join(' · ');
            const to = share.to === null ? t('statement.noRecipient') : shareTo(t, share.to);
            return (
              <Pressable
                key={share.id}
                testID={`statement-share-${share.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${head}. ${to}`}
                accessibilityHint={t('statement.historyHint')}
                onPress={() => onShare(share)}
                style={[styles.row, index > 0 && styles.ruled]}
              >
                <Text style={[styles.head, align]}>{head}</Text>
                <Text style={[styles.note, align]}>{to}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={[styles.note, align]}>{t('statement.historyNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-10'] },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: radius['radius-card'], overflow: 'hidden' },
  row: { minHeight: 48, minWidth: 48, padding: spacing['space-12'], gap: spacing['space-2'], justifyContent: 'center' },
  ruled: { borderTopWidth: 1, borderTopColor: colors.line },
  head: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
