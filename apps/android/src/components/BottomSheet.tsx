// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import type { ReactNode, RefObject } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ViewInstance } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { IconButton } from './IconButton';
import type { ControlIcon } from './control';
import { useSheetFocus } from './sheet-focus';
import { useSheetKeyboard } from './sheet-keyboard';

/** Screens own visibility, choice actions and persistence; cancellation never chooses anything. */
export type BottomSheetProps = {
  readonly visible: boolean;
  readonly title: string;
  readonly context: string;
  readonly reassurance: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  /** Stable native destination, normally the opener; keep this component mounted while changing visible. */
  readonly returnFocusRef: RefObject<ViewInstance | null>;
  readonly testID?: string;
};

const closeIcon: ControlIcon = ({ size, color }) => (
  <View style={{ direction: 'ltr', width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    {['45deg', '-45deg'].map((angle) => (
      <View
        key={angle}
        style={{
          position: 'absolute',
          width: size - 4,
          height: 2,
          backgroundColor: color,
          transform: [{ rotate: angle }],
        }}
      />
    ))}
  </View>
);

/** A native modal window isolates background interaction; no animation avoids motion and dismissal timing races. */
export function BottomSheet(props: BottomSheetProps) {
  const { heading, focusHeading } = useSheetFocus(props.visible, props.returnFocusRef);
  return (
    <Modal
      testID={props.testID}
      visible={props.visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
      onShow={focusHeading}
    >
      {props.visible && (
        <SafeAreaProvider>
          <SheetContent {...props} headingRef={heading} />
        </SafeAreaProvider>
      )}
    </Modal>
  );
}

/**
 * Modal-local insets and one scroll area keep close and long content reachable.
 * Focus events stop at this window so a background keyboard handler cannot
 * resize or scroll the underlying screen for a sheet input.
 */
function SheetContent({
  title,
  context,
  reassurance,
  children,
  onClose,
  headingRef,
}: BottomSheetProps & { readonly headingRef: RefObject<ViewInstance | null> }) {
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const t = useText();
  const { frame: contentFrame, scroll, reveal, onFocus, onBlur } = useSheetKeyboard();
  const textDirection = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View
      testID="sheet-layer"
      style={styles.scrim}
      onFocus={(event) => event.stopPropagation()}
      onBlur={(event) => event.stopPropagation()}
    >
      <Pressable
        testID="sheet-backdrop"
        accessible={false}
        focusable={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityRole="button"
        accessibilityLabel={t('bottomSheet.close')}
        onPress={onClose}
        style={styles.backdrop}
      />
      <KeyboardAvoidingView
        pointerEvents="box-none"
        behavior="height"
        onLayout={reveal}
        style={[
          styles.frame,
          { paddingTop: insets.top + spacing['space-12'], paddingLeft: insets.left, paddingRight: insets.right },
        ]}
      >
        <View role="dialog" accessibilityLabel={title} accessibilityViewIsModal style={[styles.sheet, { direction }]}>
          <View style={styles.chrome}>
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.spacer}
            />
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.grab}
            />
            <IconButton
              testID="sheet-close"
              icon={closeIcon}
              accessibilityLabel={t('bottomSheet.close')}
              onPress={onClose}
            />
          </View>
          <View ref={contentFrame} testID="sheet-content-frame" style={styles.scroll} onLayout={reveal}>
            <ScrollView
              ref={scroll}
              testID="sheet-scroll"
              removeClippedSubviews={false}
              style={styles.scroll}
              contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onFocus={onFocus}
              onBlur={onBlur}
              onLayout={reveal}
              onContentSizeChange={reveal}
            >
              <View ref={headingRef} accessible accessibilityRole="header" accessibilityLabel={title}>
                <Text accessible={false} style={[styles.title, textDirection]}>
                  {title}
                </Text>
              </View>
              <Text style={[styles.context, textDirection]}>{context}</Text>
              {children}
              <Text style={[styles.reassurance, textDirection]}>{reassurance}</Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    minWidth: sizes.target,
    minHeight: sizes.target,
  },
  frame: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '100%',
    flexShrink: 1,
    backgroundColor: colors.sheet,
    borderTopStartRadius: radius['radius-chip'],
    borderTopEndRadius: radius['radius-chip'],
    boxShadow: shadows['shadow-sheet'],
    overflow: 'hidden',
  },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['space-8'],
  },
  spacer: { width: sizes.target, height: sizes.target },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.rule },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: spacing['space-16'], gap: spacing['space-12'] },
  title: { ...typography.h3, color: colors.ink },
  context: { ...typography.caption, color: colors.ink2 },
  reassurance: { ...typography.caption, color: colors.ink2 },
});
