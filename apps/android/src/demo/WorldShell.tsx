// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A role's workspace on the PC in a demo world (#562, answer 576), after the
// design's WebShell, below the band: the sidebar names the demo's deployment,
// never «منهاجنا», as the national system names the Ministry's, except for the
// curators and the observatory, which the project runs and names in its
// wordmark; then the role, then the role's own pages as tabs, scrolling when
// the window is short, and at its foot the board's note on what the role never
// sees, changing the role and leaving the world; the page opens beside it
// with its heading.

import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { RailButton, RailLink, railStyles } from '../navigation/RailLink';
import { useDeviceText } from '../text/device-text';
import type { WorldPage, WorkspaceRole } from './world-pages';
import { PROJECT_ROLES, ROLE_PAGES } from './world-pages';

export type WorldShellProps = {
  readonly role: WorkspaceRole;
  readonly page: WorldPage;
  /** True while the world is busy, so it is not left halfway. */
  readonly moving: boolean;
  readonly onPage: (page: WorldPage) => void;
  readonly onChangeRole: () => void;
  readonly onLeave: () => void;
  /** The page's body, below its heading. */
  readonly children: ReactNode;
};

/** The sidebar of a role's pages, and the page that is open. */
export function WorldShell({ role, page, moving, onPage, onChangeRole, onLeave, children }: WorldShellProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const project = PROJECT_ROLES.includes(role);
  return (
    <View testID="world-shell" style={[styles.shell, { direction }]}>
      <View testID="world-rail" style={railStyles.rail}>
        <Text
          testID="world-name"
          accessibilityRole="header"
          style={[project ? railStyles.brand : railStyles.dep, align]}
        >
          {t(project ? 'name' : 'demo.shell.name')}
        </Text>
        <Text testID="world-who" style={[railStyles.who, align]}>
          {t(`demo.roles.${role}`)}
        </Text>
        <ScrollView style={styles.links} contentContainerStyle={railStyles.links} accessibilityRole="tablist">
          {ROLE_PAGES[role].map((one) => (
            <RailLink
              key={one}
              testID={`world-page-${one}`}
              label={t(`demo.pages.${one}`)}
              selected={one === page}
              tab
              round={one === 'world'}
              onPress={() => onPage(one)}
            />
          ))}
        </ScrollView>
        <View style={railStyles.foot}>
          <Text testID="world-note" style={[railStyles.line, align]}>
            {t(`demo.shell.note.${role}`)}
          </Text>
          <RailButton testID="world-change-role" label={t('demo.home.changeRole')} onPress={onChangeRole} />
          <RailButton testID="world-leave" label={t('demo.home.leave')} disabled={moving} onPress={onLeave} />
        </View>
      </View>
      <ScrollView style={styles.main} contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t(`demo.pages.${page}`)}
          </Text>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row' },
  links: { flexGrow: 0, flexShrink: 1 },
  main: { flex: 1 },
  content: { padding: spacing['space-24'] },
  column: { width: '100%', maxWidth: 760, gap: spacing['space-12'] },
  title: { ...typography['web-heading'], color: colors.ink },
});
