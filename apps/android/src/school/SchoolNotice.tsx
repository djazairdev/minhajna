// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The notice before a teacher joins the school's space (#564, R-7.5-01,
// R-7.5-04, answer 582), as School-join draws it: what the signed week is, what
// enters the school's space and what never does, who reads it and what the
// director and the inspector may do, the full copy a teacher who leaves takes,
// that no personal phone is needed, and how signing in works in the national
// system and in the demo. During the trial term end (#565, answer 587), a lead
// that names the trial opens it in place of what the signed week is, and only
// who reads it is kept, as School-join-trial draws it. What enters and what
// never does sit side by side, as the design draws them. Its last line, the
// legal notice, closes the page centred under the code's card, whose head, the
// QR code's dashed frame and what the code is, is drawn here too.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Facts } from '../components/Facts';
import { Icon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

const ENTERS = ['demo.school.in1', 'demo.school.in2', 'demo.school.in3', 'demo.school.in4', 'demo.school.in5'] as const;
const NEVER = ['demo.school.out1', 'demo.school.out2', 'demo.school.out3', 'demo.school.out4'] as const;
const READS = [
  'demo.school.read1',
  'demo.school.read2',
  'demo.school.read3',
  'demo.school.read4',
  'demo.school.read5',
] as const;

/** What enters the school's space and what never does, and who reads it; `lead`, during the trial, opens it. */
export function SchoolNotice({ lead }: { readonly lead?: string }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const column = (title: string, keys: typeof ENTERS | typeof NEVER, testID: string) => (
    <View testID={testID} style={[styles.column, testID === 'school-never' && styles.never]}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {title}
      </Text>
      {keys.map((key) => (
        <Text key={key} style={[styles.item, testID === 'school-never' && styles.faint, align]}>
          {t(key)}
        </Text>
      ))}
    </View>
  );
  return (
    <View style={styles.notice}>
      <Text style={[styles.body, align]}>{lead ?? t('demo.school.notice')}</Text>
      <View style={styles.box}>
        {column(t('demo.school.enters'), ENTERS, 'school-enters')}
        {column(t('demo.school.never'), NEVER, 'school-never')}
      </View>
      <Facts
        kept={(lead === undefined ? READS : READS.slice(0, 1)).map((key) => ({ id: key, text: t(key), kept: true }))}
        keptLabel={t('demo.school.kept')}
        notKeptLabel={t('demo.school.kept')}
      />
      <Text style={[styles.small, align]}>{t('demo.school.signIn')}</Text>
    </View>
  );
}

/** The code card's head: the QR code's dashed frame, and what the code is. */
export function SchoolCodeHead() {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View style={styles.code}>
      <View style={styles.frame}>
        <Icon name="qr" size={24} color={colors.ink2} />
      </View>
      <View style={styles.codeWords}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.school.codeTitle')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.school.codeLine')}</Text>
      </View>
    </View>
  );
}

/** The legal notice at the page's foot, centred. */
export function SchoolLaw() {
  const t = useDeviceText();
  const { direction } = useLocale();
  return (
    <Text style={[styles.small, { writingDirection: direction, textAlign: 'center' }]}>{t('demo.school.law')}</Text>
  );
}

const styles = StyleSheet.create({
  notice: { gap: spacing['space-12'] },
  body: { ...typography.body, color: colors.ink },
  box: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  column: { flex: 1, minWidth: 0, gap: spacing['space-4'], padding: spacing['space-12'] },
  never: { borderStartWidth: 1, borderColor: colors.line, backgroundColor: colors.well },
  head: { ...typography.label, color: colors.ink },
  item: { ...typography.small, color: colors.ink },
  faint: { color: colors.ink2 },
  small: { ...typography.small, color: colors.ink2 },
  code: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-12'] },
  frame: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.rule,
    borderRadius: radius['radius-control'],
  },
  codeWords: { flex: 1, minWidth: 0, gap: spacing['space-4'] },
});
