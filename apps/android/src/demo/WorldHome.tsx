// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world once entered (#560 to #562, answers 571 to 573, 575 and 576):
// the band with the world's date above everything, so it is read first, then
// the roles the world holds that this device offers; once one is picked, a role
// above the teacher opens its workspace on its first page, and the teacher's or
// the inspector's home names it, the inspector's with its key card (#593). The
// world's own facts, on the home and on the workspace's last page, are its code
// in its four groups for others to type and, on the device that started the
// world, moving its date to the next announced day. Leaving is always one press
// away.
// The button pressed is gone with each new page, so the band and the page's
// heading are announced as it shows: on a PC through a hidden live region,
// cleared a few seconds later so browsing does not read it twice, and on the
// phone through its own announcement; a workspace says its page too, and
// only its page when the role is the same.

import { useLocale } from '@react-navigation/native';
import { worldCodeGroups } from '@minhajna/core';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { DemoBand } from './DemoBand';
import { rolesHere, type OpenWorld, type WorldRole } from './world-mode';
import { hasWorkspace, ROLE_PAGES, type WorldPage, type WorkspaceRole } from './world-pages';
import { WorldShell } from './WorldShell';

/** How long the hidden words stay, in milliseconds, so browsing the page does not read them twice. */
const SAID_FOR = 5000;

const ROLE_ICONS: Readonly<Record<WorldRole, Parameters<typeof controlIcon>[0]>> = {
  ministry: 'publisher',
  directorate: 'globe',
  director: 'school',
  preparer: 'pencil',
  inspector: 'check',
  teacher: 'pupils',
  curator: 'homework',
  operator: 'tune',
  observatory: 'info',
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
  /** Opens reader mode inside the world, for the teacher and the inspector (#563); none when absent. */
  readonly onReader?: () => void;
  /** Opens School-join, for the teacher of a national world (#564); none when absent. */
  readonly onSchool?: () => void;
  /** Signs in on a staffroom PC, from the phone or on the PC, for the teacher of a national world (#572). */
  readonly onStaff?: () => void;
  /** The inspector's key card, for the inspector of a national world (#593); none when absent. */
  readonly inspectorCard?: ReactNode;
  /**
   * A workspace page's own content once its part of the demo has landed, or null for the empty page; it is handed a way
   * to open another page of the workspace.
   */
  readonly pageBody?: (role: WorkspaceRole, page: WorldPage, onPage: (page: WorldPage) => void) => ReactNode;
};

/** The roles of an entered world, then its home. */
export function WorldHome(props: WorldHomeProps) {
  const { world, date, role, moving, problem, onRole, onMove, onLeave, onReader, onSchool, onStaff } = props;
  const { inspectorCard, pageBody } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const side = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const workspace = role !== null && onPc() && hasWorkspace(role) ? role : null;
  const [chosen, setChosen] = useState<{ role: WorkspaceRole; page: WorldPage } | null>(null);
  const page = workspace === null ? null : chosen?.role === workspace ? chosen.page : ROLE_PAGES[workspace][0];
  const heading = role === null ? t('demo.roles.title') : t('demo.home.role', { role: t(`demo.roles.${role}`) });
  const spoken = page === null ? heading : `${heading}. ${t(`demo.pages.${page}`)}`;
  const [said, setSaid] = useState('');
  const heard = useRef<WorldRole | null | undefined>(undefined);
  const announce = useEffectEvent(() => {
    const samePlace = page !== null && heard.current === role;
    heard.current = role;
    const words = samePlace ? t(`demo.pages.${page}`) : `${t('demo.band')}. ${t('demo.date', { date })}. ${spoken}`;
    if (onPc()) setSaid(words);
    else AccessibilityInfo.announceForAccessibility(words);
  });
  useEffect(() => {
    const timer = setTimeout(announce, 0);
    return () => clearTimeout(timer);
  }, [spoken]);
  useEffect(() => {
    if (said === '') return;
    const timer = setTimeout(() => setSaid(''), SAID_FOR);
    return () => clearTimeout(timer);
  }, [said]);
  const facts: ReactNode = (
    <>
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
    </>
  );
  const hiddenSaid = onPc() && (
    <Text testID="world-said" accessibilityLiveRegion="polite" style={styles.hidden}>
      {said}
    </Text>
  );
  const trouble = (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
      {problem ?? ''}
    </Text>
  );
  if (workspace !== null && page !== null)
    return (
      <View style={[styles.screen, { direction }]}>
        <DemoBand date={date} />
        {hiddenSaid}
        <WorldShell
          role={workspace}
          page={page}
          moving={moving}
          onPage={(one) => setChosen({ role: workspace, page: one })}
          onChangeRole={() => {
            setChosen(null);
            onRole(null);
          }}
          onLeave={onLeave}
        >
          {page === 'world'
            ? facts
            : (pageBody?.(workspace, page, (one) => setChosen({ role: workspace, page: one })) ?? (
                <Text style={[styles.line, align]}>{t('demo.pages.empty')}</Text>
              ))}
          {trouble}
        </WorldShell>
      </View>
    );
  return (
    <View style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {hiddenSaid}
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
              {rolesHere(world.kind).map((one) => (
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
              {role === 'teacher' && onSchool !== undefined && (
                <Button testID="world-school-open" variant="line" label={t('demo.home.school')} onPress={onSchool} />
              )}
              {role === 'teacher' && onStaff !== undefined && (
                <Button
                  testID="world-staff-open"
                  variant="line"
                  label={t(onPc() ? 'demo.home.staffPc' : 'demo.home.pcApprove')}
                  onPress={onStaff}
                />
              )}
              {role === 'inspector' && inspectorCard}
              {onReader !== undefined && (
                <Button testID="world-reader-open" variant="line" label={t('demo.home.reader')} onPress={onReader} />
              )}
              <Button
                testID="world-change-role"
                variant="line"
                label={t('demo.home.changeRole')}
                onPress={() => onRole(null)}
              />
            </>
          )}
          {facts}
          {trouble}
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
