// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The privacy notice (Privacy, #24), shown before first use and later from
// Help, as Law 18-07 Art. 32 requires (PRD §6.2). Its words describe this
// build, which connects only inside a demo world, to the demo server, with
// made-up data (#559): nothing of the teacher's leaves unless the teacher sends
// or saves it, and crash reports stay off until turned on (#479). On a PC both
// screens read their PC wording, with a lock for the phone's icon: the
// browser's storage, the host and what Cloudflare sees, no camera, and reports
// leaving through the browser (#483). The design's lines on sync and servers
// wait for those features. The contact keeps the design's placeholders until
// counsel names it (R-6.2-02). The build the Ministry runs states its ANPDP
// declaration under the publisher (#211, answer 274); the project's own builds
// have none to state. The dashboard's reader mode gives texts of its own for
// both screens, with its own sections (answer 857); the contact and the
// declaration stay under the sections keyed `rights` and `publisher`.

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
  ['globe', 'demo'],
  ['never', 'never'],
  ['no_tracking', 'tracking'],
  ['publisher', 'publisher'],
  ['rights', 'rights'],
] as const satisfies readonly (readonly [IconName, string])[];

/** One section of the notice, by its key, with its icon and words. */
export type NoticeSection = {
  readonly key: string;
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
};

/** The notice's words, which the teacher app reads from its catalogue unless an app gives its own. */
export type NoticeTexts = {
  readonly heading: string;
  readonly intro: string;
  readonly sections: readonly NoticeSection[];
  /** The line over the link to what the app connects to. */
  readonly fileLine: string;
  /** The link's title, the teacher app's when not given. */
  readonly connectionsTitle?: string;
};

/** The notice; `onAccept` adds the first-use accept button, which Help leaves out; `texts` replace the words. */
export function PrivacyNotice({
  onAccept,
  onConnections,
  texts,
}: {
  onAccept?: () => void;
  onConnections: () => void;
  texts?: NoticeTexts;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useDeviceText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const declaration = buildDeclaration(REAL_NAMES);
  const shown: NoticeTexts = texts ?? {
    heading: t('privacy.heading'),
    intro: t('privacy.intro'),
    sections: SECTIONS.map(([icon, key]) => ({
      key,
      icon: icon === 'phone' && onPc() ? 'lock' : icon,
      title: t(`privacy.${key}Title`),
      text: t(`privacy.${key}Text`),
    })),
    fileLine: t('calendarView.receive.privacy'),
  };
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
            {shown.heading}
          </Text>
          <Text style={[styles.sub, align]}>{shown.intro}</Text>
        </View>
        {shown.sections.map(({ key, icon, title, text }) => (
          <View key={key} testID={`privacy-${key}`} style={styles.section}>
            <View style={styles.icon}>
              <Icon name={icon} size={sizes.icon} color={colors.board} />
            </View>
            <View style={styles.words}>
              <Text accessibilityRole="header" style={[styles.title, align]}>
                {title}
              </Text>
              <Text style={[styles.text, align]}>{text}</Text>
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
          <Text style={[styles.text, align]}>{shown.fileLine}</Text>
          <RowLink
            testID="privacy-connections"
            icon={controlIcon('globe')}
            title={shown.connectionsTitle ?? t('connections.title')}
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

/** The teacher app's paragraphs on what it connects to, in order. */
const CONNECTIONS = [
  'none',
  'demo',
  'source',
  'packSource',
  'errorReport',
  'problemReport',
  'crashReport',
  'register',
] as const;

/**
 * What this build connects to, from NETWORK.md: the demo server inside a demo world, and on a PC its own address; an
 * app may give its own paragraphs, by key, in order.
 */
export function Connections({ paragraphs }: { paragraphs?: readonly (readonly [string, string])[] }) {
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
      {(paragraphs ?? CONNECTIONS.map((key) => [key, t(`connections.${key}`)] as const)).map(([key, text]) => (
        <Text key={key} style={[styles.paragraph, align]}>
          {text}
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
    marginTop: spacing['space-6'],
    marginBottom: spacing['space-16'],
  },
  foot: { paddingTop: spacing['space-10'], backgroundColor: colors.paper },
  paragraphs: { gap: spacing['space-16'], paddingTop: spacing['space-20'] },
  paragraph: { ...typography.body, color: colors.ink },
});
