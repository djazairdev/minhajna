// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the app connects to in a teachers' world, and why (#622, R-1.5-06,
// answer 698), as Help-insights draws it, opened from the insights page: that a
// demo world connects only to the project's demo server, by its address, and
// only while it is open, a PC's page fetching its own files too; then the world
// itself, with what it sends, all made up; the world's insights server, opened
// as the world starts, with taking part on or off as the teacher chose, and
// what each sending carries and never holds; what the server and Cloudflare see
// of the device, the one thing not made up; nothing else, the full list
// published with the code; and that the privacy notice is in Help, outside the
// world. It mirrors NETWORK.md's demo worlds. Going back returns to the
// insights page.

import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { DEMO_SERVER } from '../network/world-network';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { InsightsScreen } from './InsightsScreen';
import { insightsStyles as styles } from './insights-styles';

export type InsightsHelpProps = {
  /** Whether the teacher has turned the insights on. */
  readonly on: boolean;
  /** The world's date, written out for the band. */
  readonly date: string;
  /** Back to the insights page. */
  readonly onClose: () => void;
};

/** Who the app connects to in a teachers' world, and what goes there. */
export function InsightsHelp({ on, date, onClose }: InsightsHelpProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const server = t('demo.insights.help.insights.title');
  const state = t(on ? 'demo.insights.help.insights.on' : 'demo.insights.help.insights.off');
  return (
    <InsightsScreen
      name="insights-help"
      title={t('demo.help.connectionsHead')}
      sub={t('demo.insights.help.sub')}
      date={date}
      onClose={onClose}
    >
      <Text testID="insights-help-demo" style={[styles.note, align]}>
        {t('demo.insights.help.demo', { address: isolate(DEMO_SERVER.replace('https://', '')) })}
      </Text>
      <View style={styles.card}>
        <View testID="insights-help-world" style={styles.row}>
          <Text style={[styles.label, align]}>{t('demo.insights.help.world.title')}</Text>
          <Text style={[styles.small, align]}>{t('demo.insights.help.world.line')}</Text>
        </View>
        <View testID="insights-help-insights" style={[styles.row, styles.ruled]}>
          <View accessible accessibilityLabel={`${server}: ${state}`}>
            <Text style={[styles.label, align]}>{server}</Text>
            <Text testID="insights-help-state" style={[styles.head, align]}>
              {state}
            </Text>
          </View>
          <Text style={[styles.small, align]}>{t('demo.insights.help.insights.line')}</Text>
        </View>
        <View testID="insights-help-sees" style={[styles.row, styles.ruled]}>
          <Text style={[styles.label, align]}>{t('demo.insights.help.sees.title')}</Text>
          <Text style={[styles.small, align]}>{t('demo.insights.help.sees.line')}</Text>
        </View>
        <Text style={[styles.small, align]}>{t('demo.insights.help.nothingElse')}</Text>
      </View>
      <Text style={[styles.small, align]}>{t('demo.help.privacy')}</Text>
    </InsightsScreen>
  );
}
