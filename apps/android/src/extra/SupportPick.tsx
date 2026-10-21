// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The support item a support or «تدارك» session takes (#228, answer 360):
// the first item of the class's queue it has not finished, with «أُنجز
// العنصر», ticked by default; unticked, the item stays first for the next
// support session. Without an item left, it says so; the queue opens from
// here either way.

import type { SupportItem } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

export type SupportPickProps = {
  readonly item: SupportItem | null;
  readonly finished: boolean;
  readonly onFinished: (finished: boolean) => void;
  readonly onQueue?: () => void;
};

export function SupportPick({ item, finished, onFinished, onQueue }: SupportPickProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="extra-support" style={styles.box}>
      <Text style={[styles.label, align]}>{t('supportQueue.title')}</Text>
      {item === null ? (
        <Text testID="extra-support-none" style={[styles.body, align]}>
          {t('supportQueue.noItem')}
        </Text>
      ) : (
        <>
          <Text testID="extra-support-item" style={[styles.body, align]}>
            {t('supportQueue.takes', { item: t('tests.quoted', { title: isolate(item.title) }) })}
          </Text>
          <CheckRow
            testID="extra-support-finished"
            label={t('supportQueue.finishedTick')}
            checked={finished}
            onCheckedChange={onFinished}
          />
        </>
      )}
      {onQueue !== undefined && (
        <Button testID="extra-support-queue" variant="line" label={t('supportQueue.open')} onPress={onQueue} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
