// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard's wide page, as N-Reference and D-Classes draw it: the board's
// sidebar with who is working, the pages and, at its foot, locking the page and
// going back, where there is somewhere to go; the page itself under the line
// saying its data is made up, as the server holds it in the clear (answer 809);
// and a side panel when the page gives one. While the page is held, as when
// someone else saved first, its content takes no touch, key or reader focus,
// and its panel closes; the line over it stays.

import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Icon, type IconName } from '../../android/src/design/Icon';
import { colors, radius, sizes, spacing, typography } from '../../android/src/design/tokens';
import { useDashboardText } from './text';

export type FrameItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly on?: boolean;
  /** Turns the icon round, as the chevron for going back. */
  readonly backward?: boolean;
  readonly onPress: () => void;
};

export type DashboardFrameProps = {
  readonly who: string;
  readonly whoLine?: string;
  readonly items?: readonly FrameItem[];
  readonly onLock?: () => void;
  /** Goes back, or nothing on the home, which has nothing behind it. */
  readonly onBack?: () => void;
  readonly aside?: ReactNode;
  /** The words over the page, as its calls' status, which stay usable while the page is held. */
  readonly top?: ReactNode;
  /** True while the page takes no change, as when someone else saved first. */
  readonly held?: boolean;
  readonly children: ReactNode;
};

/** A sidebar's button, on the board's colours. */
function SideButton({ item }: { item: FrameItem }) {
  const { direction } = useLocale();
  return (
    <Pressable
      testID={`dashboard-side-${item.id}`}
      accessibilityRole="button"
      {...({ 'aria-current': item.on === true ? 'page' : undefined } as object)}
      onPress={item.onPress}
      style={[styles.item, item.on === true && styles.itemOn]}
    >
      <View style={item.backward === true && styles.backward}>
        <Icon name={item.icon} size={sizes['icon-small']} color={colors.chalk} />
      </View>
      <Text
        style={[
          styles.itemWords,
          item.on === true && styles.itemWordsOn,
          { writingDirection: direction, textAlign: 'start' },
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

/** The sidebar, the page and its panel. */
export function DashboardFrame(props: DashboardFrameProps) {
  const { who, whoLine, items = [], onLock, onBack, aside, top, held = false, children } = props;
  const t = useDashboardText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const content = useRef<ViewInstance>(null);
  useEffect(() => {
    const node = content.current as unknown as { inert?: boolean } | null;
    if (node !== null && 'inert' in node) node.inert = held;
  }, [held]);
  return (
    <View testID="dashboard-frame" style={[styles.frame, { direction }]}>
      <View role="navigation" style={styles.side}>
        <Text accessibilityRole="header" style={[styles.brand, align]}>
          {t('dashboard.name')}
        </Text>
        <View style={styles.who}>
          <Text style={[styles.whoName, align]}>{who}</Text>
          {whoLine !== undefined && <Text style={[styles.whoLine, align]}>{whoLine}</Text>}
        </View>
        {items.map((item) => (
          <SideButton key={item.id} item={item} />
        ))}
        <View style={styles.foot}>
          {onLock !== undefined && (
            <SideButton item={{ id: 'lock', label: t('dashboard.lock'), icon: 'lock', onPress: onLock }} />
          )}
          {onBack !== undefined && (
            <SideButton
              item={{ id: 'back', label: t('dashboard.back'), icon: 'chevron', backward: true, onPress: onBack }}
            />
          )}
        </View>
      </View>
      <ScrollView style={styles.page} contentContainerStyle={styles.pageInner}>
        <Text testID="dashboard-made-up" style={[styles.madeUp, align]}>
          {t('dashboard.madeUp')}
        </Text>
        {top}
        <View
          ref={content}
          pointerEvents={held ? 'none' : 'auto'}
          aria-disabled={held}
          importantForAccessibility={held ? 'no-hide-descendants' : 'auto'}
          style={[styles.content, held && styles.held]}
        >
          {children}
        </View>
      </ScrollView>
      {aside !== undefined && aside !== null && !held && (
        <ScrollView
          testID="dashboard-aside"
          role="complementary"
          accessibilityLabel={t('dashboard.panel')}
          style={styles.aside}
          contentContainerStyle={styles.asideInner}
        >
          {aside}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, flexDirection: 'row', backgroundColor: colors.paper, minHeight: 0 },
  side: {
    width: 232,
    flexShrink: 0,
    gap: spacing['space-4'],
    paddingVertical: spacing['space-16'],
    paddingHorizontal: spacing['space-12'],
    backgroundColor: colors.board,
  },
  brand: { ...typography.h3, color: colors.chalk, paddingHorizontal: spacing['space-8'] },
  who: { paddingHorizontal: spacing['space-8'], paddingBottom: spacing['space-12'] },
  whoName: { ...typography.label, color: colors.chalk },
  whoLine: { ...typography.small, color: colors['chalk-75'] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-10'],
    minHeight: 44,
    paddingHorizontal: spacing['space-12'],
    borderRadius: radius['radius-card'],
  },
  itemOn: { backgroundColor: colors['chalk-14'] },
  itemWords: { ...typography.body, color: colors['chalk-82'], flexShrink: 1 },
  itemWordsOn: { ...typography.label, color: colors.chalk },
  foot: { marginTop: 'auto', gap: spacing['space-4'] },
  page: { flex: 1, minWidth: 0 },
  pageInner: { gap: spacing['space-12'], padding: spacing['space-20'] },
  madeUp: { ...typography.small, color: colors['notice-ink'] },
  backward: { transform: [{ scaleX: -1 }] },
  content: { gap: spacing['space-12'] },
  held: { opacity: 0.5 },
  aside: {
    width: 420,
    flexGrow: 0,
    flexShrink: 0,
    borderStartWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sheet,
  },
  asideInner: { gap: spacing['space-10'], padding: spacing['space-16'] },
});
