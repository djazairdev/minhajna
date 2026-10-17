// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The privacy notice (Privacy, #24), shown before first use and later from
// Help, as Law 18-07 Art. 32 requires (PRD §6.2). Its words describe this
// build, which has no network permission: the design's lines on sync, backup,
// servers and crash reports wait for those features. The contact
// keeps the design's placeholders until counsel names it (R-6.2-02).

import { useLocale } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

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
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
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
              <Icon name={icon} size={sizes.icon} color={colors.board} />
            </View>
            <View style={styles.words}>
              <Text accessibilityRole="header" style={[styles.title, align]}>
                {t(`privacy.${key}Title`)}
              </Text>
              <Text style={[styles.text, align]}>{t(`privacy.${key}Text`)}</Text>
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
        <Pressable
          testID="privacy-connections"
          accessibilityRole="button"
          accessibilityLabel={t('connections.title')}
          onPress={onConnections}
          style={({ pressed }) => [styles.link, pressed && { borderColor: colors.ink }]}
        >
          <Icon name="globe" size={sizes.icon} color={colors.ink} />
          <Text style={[styles.linkText, align]}>{t('connections.title')}</Text>
          <Icon name="chevron" size={sizes.icon} color={colors.ink2} />
        </Pressable>
      </ScrollView>
      {onAccept && (
        <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
          <Button testID="privacy-accept" label={t('privacy.accept')} onPress={onAccept} />
        </View>
      )}
    </View>
  );
}

/** What this build connects to, from NETWORK.md: nothing, and the source link only after asking. */
export function Connections() {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
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
      {(['none', 'source', 'register'] as const).map((key) => (
        <Text key={key} style={[styles.paragraph, align]}>
          {t(`connections.${key}`)}
        </Text>
      ))}
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
    minHeight: 56,
    minWidth: sizes.target,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    marginTop: spacing['space-6'],
    marginBottom: spacing['space-16'],
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-button'],
    backgroundColor: colors.sheet,
  },
  linkText: { ...typography.body, color: colors.ink, flex: 1 },
  foot: { paddingTop: spacing['space-10'], backgroundColor: colors.paper },
  paragraphs: { gap: spacing['space-16'], paddingTop: spacing['space-20'] },
  paragraph: { ...typography.body, color: colors.ink },
});
