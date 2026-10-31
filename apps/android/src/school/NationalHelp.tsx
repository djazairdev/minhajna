// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Help in the national system (#568, R-1.5-06, R-1.5-07, answer 604), as
// Help-national draws it, under the band, opened from a joined school's card:
// first that the list is the national system's and that this demo connects only
// to the project's demo server, by its address; then the reports, a problem
// report with pupils' names replaced and shown before it is sent, and crash
// reports, off unless turned on, each shown before it is sent without names or
// marks; then what the app connects to and why, each with who reads it and by
// which key: the plan, calendar and rule updates, the Ministry's server with
// the school's space, through which marks, and absences where the school
// chooses, go to the state's systems, and the sync between the teacher's
// devices, the state's certifier once at joining, and reports sent by the
// teacher; nothing else; that the sync left the project's server on the day the
// teacher joined; and that the privacy notice is in the app's Help, outside the
// world. The bar names the school by its short ID, and on a PC the title is
// said in the page's hidden live region. Going back leads to School-join.

import { readJoinCode, type Day, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import { colors, radius, spacing, typography } from '../design/tokens';
import { DEMO_SERVER } from '../network/world-network';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { shortSchool } from './SchoolJoined';

const REPORTS = ['problem', 'crashes'] as const;
const CONNECTIONS = ['updates', 'ministry', 'certifier', 'sent'] as const;

export type NationalHelpProps = {
  /** The world's date, written out for the band. */
  readonly date: string;
  /** The join the page is about. */
  readonly join: SchoolJoined;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  /** Back to School-join. */
  readonly onClose: () => void;
  /** What the page says aloud on a PC, in its hidden live region. */
  readonly said: string;
};

/** Who reads what in the national system, and by which key. */
export function NationalHelp({ date, join, dayText, onClose, said }: NationalHelpProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const head = (key: 'demo.help.reportsHead' | 'demo.help.connectionsHead') => (
    <Text accessibilityRole="header" style={[styles.head, align]}>
      {t(key)}
    </Text>
  );
  return (
    <View testID="national-help" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID="help-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="help-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('demo.help.title')}
          </Text>
          <Text style={[styles.small, align]}>
            {t('demo.devices.school', { school: shortSchool(readJoinCode(join.code)?.school ?? '') })}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <Text testID="help-demo" style={[styles.note, align]}>
            {t('demo.help.demo', { address: isolate(DEMO_SERVER.replace('https://', '')) })}
          </Text>
          <View style={styles.card}>
            {head('demo.help.reportsHead')}
            {REPORTS.map((key) => (
              <View key={key} testID={`help-${key}`} style={styles.row}>
                <Text style={[styles.label, align]}>{t(`demo.help.${key}.title`)}</Text>
                <Text style={[styles.small, align]}>{t(`demo.help.${key}.line`)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            {head('demo.help.connectionsHead')}
            {CONNECTIONS.map((key, index) => (
              <View key={key} testID={`help-${key}`} style={[styles.row, index > 0 && styles.ruled]}>
                <Text style={[styles.label, align]}>{t(`demo.help.${key}.title`)}</Text>
                <Text style={[styles.small, align]}>{t(`demo.help.${key}.line`)}</Text>
                <Text style={[styles.key, align]}>{t(`demo.help.${key}.key`)}</Text>
              </View>
            ))}
            <Text style={[styles.small, align]}>{t('demo.help.nothingElse')}</Text>
          </View>
          <Text testID="help-moved" style={[styles.small, align]}>
            {t('demo.help.moved', { date: dayText(join.certificate.issued) })}
          </Text>
          <Text testID="help-privacy" style={[styles.small, align]}>
            {t('demo.help.privacy')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], paddingVertical: spacing['space-8'] },
  titles: { flexShrink: 1 },
  title: { ...typography['bar-title'], color: colors.ink },
  content: {
    flexGrow: 1,
    paddingTop: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    alignItems: 'center',
  },
  column: { width: '100%', maxWidth: 640, gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  row: { gap: spacing['space-2'], paddingVertical: spacing['space-8'] },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  key: { ...typography.small, color: colors.ink },
  note: { ...typography.small, color: colors.ink },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
