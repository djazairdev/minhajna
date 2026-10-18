// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One row of the texts book's page in the app (#213, P09, P10): the date
// and the time, then what the book takes, ruled like the paper book. A
// confirmed row carries a check in the signature column and opens the
// session's details to correct it. A row awaiting confirmation is grey,
// says so, and offers the details, and «تمّت كما هو مقترح» when a lesson is
// proposed, as Today does; it never reads as taught (R-2.3-14).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { fontFamilyForWeight } from '../design/fonts';
import { Icon } from '../design/Icon';
import { colors, fontFamilies, spacing, typography } from '../design/tokens';
import type { BookLine } from '../entry/book-lines';
import type { Translate } from '../documents/document-data';
import type { ViewRow } from './book-pages';

export interface BookPageRowProps {
  readonly row: ViewRow;
  /** The page's direction: the subject's. */
  readonly dir: 'rtl' | 'ltr';
  readonly today: boolean;
  readonly t: Translate;
  readonly onDetails: () => void;
  readonly onConfirm: () => void;
}

const spoken = (line: BookLine) => (line.label === undefined ? line.text : `${line.label}: ${line.text}`);

export function BookPageRow({ row, dir, today, t, onDetails, onConfirm }: BookPageRowProps) {
  const lines = (
    <View style={styles.what}>
      {row.awaiting && (
        <Text style={[styles.cell, styles.tag, styles.ruled]}>{t(today ? 'book.proposedToday' : 'book.awaiting')}</Text>
      )}
      {row.lines.map((line, index) => (
        <Text key={index} style={[styles.cell, index < row.lines.length - 1 && styles.ruled]}>
          {line.label !== undefined && <Text style={styles.label}>{`${line.label}: `}</Text>}
          {line.text}
        </Text>
      ))}
    </View>
  );
  const when = (
    <View style={styles.when}>
      <Text style={[styles.cell, styles.ruled, styles.date]}>{row.date}</Text>
      {row.time !== '' && <Text style={[styles.cell, styles.date]}>{row.time}</Text>}
    </View>
  );
  if (row.awaiting) {
    return (
      <View testID={`book-row-${row.key}`} style={[styles.entry, styles.awaiting]}>
        <View
          accessible
          accessibilityLabel={[t(today ? 'book.proposedToday' : 'book.awaiting'), row.date, row.time]
            .concat(row.lines.map(spoken))
            .filter(Boolean)
            .join('. ')}
          style={[styles.row, { direction: dir }]}
        >
          {when}
          {lines}
          <View style={styles.sign} />
        </View>
        <View style={styles.actions}>
          {row.proposed && <Button testID={`book-confirm-${row.key}`} label={t('today.confirm')} onPress={onConfirm} />}
          <Button testID={`book-details-${row.key}`} variant="soft" label={t('entry.open')} onPress={onDetails} />
        </View>
      </View>
    );
  }
  return (
    <Pressable
      testID={`book-row-${row.key}`}
      accessibilityRole="button"
      accessibilityLabel={[row.date, row.time, ...row.lines.map(spoken), t('book.confirmed')]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={t('book.editHint')}
      onPress={onDetails}
      style={({ pressed }) => [styles.entry, styles.row, { direction: dir }, pressed && styles.pressed]}
    >
      {when}
      {lines}
      <View style={styles.sign}>
        <Icon name="check" size={20} color={colors.ink} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  entry: { borderBottomWidth: 1.5, borderColor: colors['book-edge'], backgroundColor: colors.sheet },
  awaiting: { backgroundColor: colors['alt-day'] },
  pressed: { backgroundColor: colors['link-row'] },
  row: { flexDirection: 'row', minHeight: 48 },
  when: { width: '30%', borderEndWidth: 1, borderColor: colors.line },
  what: { flex: 1 },
  sign: {
    width: 48,
    borderStartWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    paddingTop: spacing['space-8'],
  },
  cell: {
    ...typography.body,
    color: colors.ink,
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-4'],
  },
  date: { textAlign: 'center' },
  tag: { color: colors.pencil },
  ruled: { borderBottomWidth: 1, borderStyle: 'dotted', borderColor: colors.line },
  label: { fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'), fontWeight: '700' },
  actions: { gap: spacing['space-8'], padding: spacing['space-12'] },
});
