// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The privacy notice (Privacy, #24), shown before first use and later from
// Help, as Law 18-07 Art. 32 requires (PRD §6.2). Its words describe this
// build, which has no network permission: nothing leaves unless the teacher
// sends or saves it, and crash reports stay off until turned on (#479). On a PC
// both screens read their PC wording, with a lock for the phone's icon: the
// browser's storage, the host and what Cloudflare sees, no camera, and reports
// leaving through the browser (#483). The design's lines on sync and servers
// wait for those features. The contact keeps the design's placeholders until
// counsel names it (R-6.2-02). The build the Ministry runs states its ANPDP
// declaration under the publisher (#211, answer 274); the project's own builds
// have none to state.

import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon, Icon, type IconName } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { buildDeclaration, REAL_NAMES } from '../privacy/real-names';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';

const SECTIONS = [
  ['phone', 'phone'],
  ['lock', 'leave'],
  ['never', 'never'],
  ['no_tracking', 'tracking'],
  ['publisher', 'publisher'],
  ['rights', 'rights'],
] as const satisfies readonly (readonly [IconName, string])[];

/** The notice; `onAccept` adds the first-use «فهمت، لنبدأ», which Help leaves out. */
export function PrivacyNotice({ onAccept, onConnections }: { onAccept?: () => void; onConnections: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useDeviceText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const declaration = buildDeclaration(REAL_NAMES);
  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          sides,
          !onAccept && { paddingBottom: insets.bottom + spacing['space-16'] },
        ]}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {t('privacy.heading')}
          </Text>
          <Text style={[styles.sub, align]}>{t('privacy.intro')}</Text>
        </View>
        {SECTIONS.map(([icon, key]) => (
          <View key={key} testID={`privacy-${key}`} style={styles.section}>
            <View style={styles.icon}>
              <Icon name={icon === 'phone' && onPc() ? 'lock' : icon} size={sizes.icon} color={colors.board} />
            </View>
            <View style={styles.words}>
              <Text accessibilityRole="header" style={[styles.title, align]}>
                {t(`privacy.${key}Title`)}
              </Text>
              <Text style={[styles.text, align]}>{t(`privacy.${key}Text`)}</Text>
              {key === 'publisher' && declaration !== null && (
                <Text testID="privacy-declaration" style={[styles.text, align]}>
                  {t('realNames.privacy', { declaration: isolate(declaration) })}
                </Text>
              )}
              {key === 'rights' && (
                <View style={styles.contact}>
                  <Text style={[styles.text, align]}>{t('privacy.contact')}</Text>
                  <Text style={styles.placeholder}>{t('privacy.contactName')}</Text>
                  <Text style={styles.placeholder}>{t('privacy.contactAddress')}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
        <View style={styles.link}>
          <Text style={[styles.text, align]}>{t('calendarView.receive.privacy')}</Text>
          <RowLink
            testID="privacy-connections"
            icon={controlIcon('globe')}
            title={t('connections.title')}
            onPress={onConnections}
          />
        </View>
      </ScrollView>
      {onAccept && (
        <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
          <Button testID="privacy-accept" label={t('privacy.accept')} onPress={onAccept} />
        </View>
      )}
    </View>
  );
}

/** What this build connects to, from NETWORK.md: on the phone nothing, on a PC its own address. */
export function Connections() {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useDeviceText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        styles.paragraphs,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-16'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      {(['none', 'source', 'packSource', 'errorReport', 'problemReport', 'crashReport', 'register'] as const).map(
        (key) => (
          <Text key={key} style={[styles.paragraph, align]}>
            {t(`connections.${key}`)}
          </Text>
        ),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, paddingTop: spacing['space-4'] },
  intro: { gap: spacing['space-6'], paddingBottom: spacing['space-12'] },
  heading: { ...typography.h2, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  section: {
    flexDirection: 'row',
    gap: spacing['space-10'],
    paddingTop: spacing['space-12'],
    paddingBottom: spacing['space-10'],
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  icon: { width: 26, paddingTop: spacing['space-3'] },
  words: { flex: 1, minWidth: 0 },
  title: { ...typography['bar-title'], lineHeight: 16 * 1.5, color: colors.ink },
  text: { ...typography.fact, lineHeight: 14 * 1.6, color: colors.ink2 },
  contact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-6'],
    marginTop: spacing['space-4'],
  },
  placeholder: {
    ...typography.fact,
    color: colors.pencil,
    paddingHorizontal: spacing['space-8'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors['pencil-edge'],
    borderRadius: radius['radius-class'],
  },
  link: {
    marginTop: spacing['space-6'],
    marginBottom: spacing['space-16'],
  },
  foot: { paddingTop: spacing['space-10'], backgroundColor: colors.paper },
  paragraphs: { gap: spacing['space-16'], paddingTop: spacing['space-20'] },
  paragraph: { ...typography.body, color: colors.ink },
});
