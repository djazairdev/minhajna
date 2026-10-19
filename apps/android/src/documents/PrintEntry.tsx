// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One document in «طباعة الأسبوع» (#215, Print-set): ticked or not, with
// its line, such as «ما جدّ منذ آخر طباعة · من 15 أكتوبر إلى 22 أكتوبر · 3
// صفحات», which TalkBack reads with it, and, for a document of days or
// months, the button that opens its range.

import { useRef } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { CheckRow } from '../components/CheckRow';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import type { DocumentKind } from './catalogue';
import { PRINT_UNITS } from './print-ranges';

export type PrintEntryProps = {
  readonly kind: DocumentKind;
  readonly line: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChecked: (checked: boolean) => void;
  /** Opens the range, handing over the button the sheet gives focus back to. */
  readonly onRange: (view: ViewInstance | null) => void;
};

export function PrintEntry({ kind, line, checked, disabled, onChecked, onRange }: PrintEntryProps) {
  const t = useText();
  const button = useRef<ViewInstance>(null);
  const unit = PRINT_UNITS[kind.id];
  const title = kind.title(t);
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <CheckRow
          testID={`print-${kind.id}`}
          label={title}
          accessibilityHint={line}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChecked}
        />
        <Text testID={`print-${kind.id}-line`} importantForAccessibility="no" style={styles.line}>
          {line}
        </Text>
      </View>
      {(unit === 'day' || unit === 'month') && (
        <View ref={button} collapsable={false}>
          <IconButton
            testID={`print-${kind.id}-range`}
            icon={controlIcon('tune')}
            accessibilityLabel={t('documents.printWeek.rangeOf', { name: title })}
            disabled={disabled}
            onPress={() => onRange(button.current)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-8'] },
  main: { flex: 1, gap: spacing['space-4'] },
  line: { ...typography.body, color: colors.pencil, paddingHorizontal: spacing['space-16'] },
});
