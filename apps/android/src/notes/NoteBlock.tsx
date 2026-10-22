// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One paragraph of a lesson note (#237, Note): in grey in a dashed box while
// the plan proposes it, in ink in a solid box once the teacher accepts or
// writes it, its tag saying which. A tap accepts or reverts a plan paragraph
// with text; the pencil opens it for writing. The teacher's own paragraphs
// have only the pencil. The tag carries the state, as the box's line alone
// is below 3:1, and TalkBack reads it first.

import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';

export type NoteBlockProps = {
  readonly tag: string;
  readonly text: string;
  readonly inked: boolean;
  /** What the pencil is called, such as «كتابة الفقرة: الأهداف». */
  readonly writeLabel: string;
  readonly onWrite: () => void;
  /** Accepts or reverts the paragraph; none when a tap does nothing. */
  readonly onToggle?: () => void;
  readonly toggleHint?: string;
  readonly testID: string;
};

export function NoteBlock({ tag, text, inked, writeLabel, onWrite, onToggle, toggleHint, testID }: NoteBlockProps) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const color = inked ? colors.ink : colors.pencil;
  const body = (
    <>
      <Text style={[styles.tag, align, { color: inked ? colors.board : colors.pencil }]}>{tag}</Text>
      <Text style={[styles.text, align, { color }]}>{text}</Text>
    </>
  );
  return (
    <View style={[styles.row, { direction }]}>
      {onToggle === undefined ? (
        <View testID={testID} accessible style={[styles.box, inked ? styles.inked : styles.grey]}>
          {body}
        </View>
      ) : (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${tag}. ${text}`}
          accessibilityHint={toggleHint}
          onPress={onToggle}
          style={({ pressed }) => [styles.box, inked ? styles.inked : styles.grey, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      )}
      <View style={styles.pencil}>
        <IconButton
          testID={`${testID}-write`}
          icon={controlIcon('pencil')}
          accessibilityLabel={writeLabel}
          onPress={onWrite}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-4'] },
  box: {
    flex: 1,
    minHeight: sizes.target,
    paddingTop: spacing['space-4'],
    paddingBottom: spacing['space-6'],
    paddingHorizontal: spacing['space-12'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  grey: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors['pencil-edge'] },
  inked: { borderWidth: 1.5, borderColor: colors.board },
  pressed: { opacity: 0.85 },
  tag: { ...typography.tag },
  text: { ...typography.body, lineHeight: 26 },
  pencil: { flexShrink: 0 },
});
