// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One slot's time at the school (#29, Settings-times): when it starts and
// ends, typed as on the school's bell, such as 08:15. «حفظ» keeps it for
// this school; «وقت القالب» goes back to the template's time; closing keeps
// nothing.

import type { BellTime, Slot } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { readClock, readSpan } from './times-rules';

export type TimeSheetProps = {
  /** The slot being changed and its time now, or null when the sheet is closed. */
  readonly open: { readonly slot: Slot; readonly time: BellTime | null } | null;
  readonly title: string;
  readonly onClose: () => void;
  /** A time to keep, or null to go back to the template's. */
  readonly onSave: (slot: Slot, span: { readonly from: string; readonly to: string } | null) => void;
};

/** The sheet, open while `open` is set. */
export function TimeSheet({ open, ...props }: TimeSheetProps) {
  return (
    <Modal visible={open !== null} animationType="slide" onRequestClose={props.onClose} statusBarTranslucent>
      {open !== null && <TimeEditor key={`${open.slot.half}${open.slot.index}`} open={open} {...props} />}
    </Modal>
  );
}

function TimeEditor({
  open,
  title,
  onClose,
  onSave,
}: TimeSheetProps & { readonly open: NonNullable<TimeSheetProps['open']> }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const [from, setFrom] = useState(open.time?.from ?? '');
  const [to, setTo] = useState(open.time?.to ?? '');
  const [tried, setTried] = useState(false);
  const span = readSpan(from, to);
  const wrong = !tried || span !== null ? null : readClock(from) === null ? 'from' : 'to';
  const error = (field: 'from' | 'to') => (wrong === field ? t('times.invalid') : undefined);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View
      style={[
        styles.sheet,
        {
          direction,
          paddingTop: insets.top + spacing['space-12'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {title}
        </Text>
        <Button testID="time-close" variant="plain" label={t('setup.close')} onPress={onClose} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <TextField
          testID="time-from"
          label={t('times.from')}
          placeholder={t('times.placeholder')}
          value={from}
          onChangeText={setFrom}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          textDirection="ltr"
          error={error('from')}
        />
        <TextField
          testID="time-to"
          label={t('times.to')}
          placeholder={t('times.placeholder')}
          value={to}
          onChangeText={setTo}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          textDirection="ltr"
          error={error('to')}
        />
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        {open.time?.by === 'school' && (
          <View style={styles.action}>
            <Button
              testID="time-reset"
              variant="line"
              label={t('times.reset')}
              onPress={() => onSave(open.slot, null)}
            />
          </View>
        )}
        <View style={styles.action}>
          <Button
            testID="time-save"
            label={t('times.save')}
            onPress={() => {
              setTried(true);
              if (span !== null) onSave(open.slot, span);
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, gap: spacing['space-12'], backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-8'] },
  title: { ...typography.h2, color: colors.ink, flex: 1 },
  content: { gap: spacing['space-20'], paddingBottom: spacing['space-16'] },
  action: { flex: 1 },
  foot: { flexDirection: 'row', gap: spacing['space-8'], paddingTop: spacing['space-12'] },
});
