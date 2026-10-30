// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world once entered, on a PC (#560, answers 571 to 573): the band with
// the world's date above everything, so it is read first, then the roles the
// world holds; once one is picked, the world's home names it, shows the
// world's code in its four groups for others to type, and, on the device that
// started the world, moves its date to the next announced day. Each role's
// workspace opens here once #562 brings it. Leaving is always one press away.
// The button pressed is gone with each new page, so the band and the page's
// heading are announced as it shows: on a PC through a hidden live region,
// cleared a few seconds later so browsing does not read it twice, and on the
// phone through its own announcement.

import { useLocale } from '@react-navigation/native';
import { worldCodeGroups } from '@minhajna/core';
import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { onPc } from '../text/device-text';
import { useText } from '../text/i18n';
import { DemoBand } from './DemoBand';
import { WORLD_ROLES, type OpenWorld, type WorldRole } from './world-mode';

/** How long the hidden words stay, in milliseconds, so browsing the page does not read them twice. */
const SAID_FOR = 5000;

const ROLE_ICONS: Readonly<Record<WorldRole, Parameters<typeof controlIcon>[0]>> = {
  ministry: 'publisher',
  directorate: 'globe',
  director: 'school',
  inspector: 'check',
  teacher: 'pupils',
};

export type WorldHomeProps = {
  readonly world: Pick<OpenWorld, 'kind' | 'code' | 'starter'>;
  /** The world's date, written out for the band. */
  readonly date: string;
  readonly role: WorldRole | null;
  /** True while the date is being moved. */
  readonly moving: boolean;
  /** What went wrong, as the catalogue says it. */
  readonly problem: string | null;
  readonly onRole: (role: WorldRole | null) => void;
  readonly onMove: () => void;
  readonly onLeave: () => void;
};

/** The roles of an entered world, then its home. */
export function WorldHome({ world, date, role, moving, problem, onRole, onMove, onLeave }: WorldHomeProps) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const side = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const heading = role === null ? t('demo.roles.title') : t('demo.home.role', { role: t(`demo.roles.${role}`) });
  const [said, setSaid] = useState('');
  const announce = useEffectEvent(() => {
    const words = `${t('demo.band')}. ${t('demo.date', { date })}. ${heading}`;
    if (onPc()) setSaid(words);
    else AccessibilityInfo.announceForAccessibility(words);
  });
  useEffect(() => {
    const timer = setTimeout(announce, 0);
    return () => clearTimeout(timer);
  }, [heading]);
  useEffect(() => {
    if (said === '') return;
    const timer = setTimeout(() => setSaid(''), SAID_FOR);
    return () => clearTimeout(timer);
  }, [said]);
  return (
    <View style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID="world-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <ScrollView
        contentContainerStyle={[styles.content, side, { paddingBottom: insets.bottom + spacing['space-16'] }]}
      >
        <View style={styles.column}>
          {role === null ? (
            <>
              <Text accessibilityRole="header" style={[styles.title, align]}>
                {heading}
              </Text>
              <Text style={[styles.line, align]}>{t('demo.roles.line')}</Text>
              {WORLD_ROLES[world.kind].map((one) => (
                <RowLink
                  key={one}
                  testID={`world-role-${one}`}
                  icon={controlIcon(ROLE_ICONS[one])}
                  title={t(`demo.roles.${one}`)}
                  onPress={() => onRole(one)}
                />
              ))}
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={[styles.title, align]}>
                {heading}
              </Text>
              <Text style={[styles.line, align]}>{t('demo.home.roleNext')}</Text>
              <Button
                testID="world-change-role"
                variant="line"
                label={t('demo.home.changeRole')}
                onPress={() => onRole(null)}
              />
            </>
          )}
          <View style={styles.group}>
            <Text accessibilityRole="header" style={[styles.label, align]}>
              {t('demo.home.code')}
            </Text>
            <Text testID="world-code" selectable style={styles.code}>
              {worldCodeGroups(world.code).join(' ')}
            </Text>
            <Text style={[styles.line, align]}>{t('demo.home.codeLine')}</Text>
          </View>
          {world.starter !== null && (
            <View style={styles.group}>
              <Button
                testID="world-move-date"
                variant="line"
                label={t('demo.home.move')}
                onPress={onMove}
                disabled={moving}
              />
              <Text style={[styles.line, align]}>{t('demo.home.moveLine')}</Text>
            </View>
          )}
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
            {problem ?? ''}
          </Text>
          <Button
            testID="world-leave"
            variant="plain"
            label={t('demo.home.leave')}
            onPress={onLeave}
            disabled={moving}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, paddingTop: spacing['space-20'], alignItems: 'center' },
  column: { width: '100%', maxWidth: 640, gap: spacing['space-12'] },
  group: { gap: spacing['space-6'] },
  title: { ...typography['web-heading'], color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  line: { ...typography.small, color: colors.ink2 },
  code: {
    ...typography['body-latin'],
    color: colors.ink,
    writingDirection: 'ltr',
    textAlign: 'left',
    letterSpacing: 2,
  },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
