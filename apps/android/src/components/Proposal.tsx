// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, spacing, typography } from '../design/tokens';

/** One line as it will be written in the book, such as «الموضوع: …», or a stage with no label. */
export type ProposalLine = { readonly label?: string; readonly text: string };

export type ProposalProps = {
  /** Where it comes from, such as «مقترح من المخطط · يتابع من الحصة السابقة». */
  readonly tag: string;
  readonly lines: readonly ProposalLine[];
  readonly testID?: string;
};

/**
 * What the plan proposes, in pencil: a dashed pencil-edge box, the tag, then
 * the lines as the book will take them (docs/design/system/components/Proposal).
 * It is never drawn in ink, as nothing is written until the teacher confirms
 * (PRD §3.1, rule 3). The dashed border alone is below 3:1, so the tag is
 * always there, and TalkBack reads it first.
 */
export function Proposal({ tag, lines, testID }: ProposalProps) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const spoken = (line: ProposalLine) => (line.label === undefined ? line.text : `${line.label}: ${line.text}`);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={[tag, ...lines.map(spoken)].join('. ')}
      style={[styles.box, { direction }]}
    >
      <Text style={[styles.tag, align]}>{tag}</Text>
      {lines.map((line, index) => (
        <Text key={index} style={[styles.line, align]}>
          {line.label !== undefined && <Text style={styles.label}>{`${line.label}: `}</Text>}
          {line.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingTop: spacing['space-4'],
    paddingBottom: spacing['space-6'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors['pencil-edge'],
    borderRadius: radius['radius-control'],
  },
  tag: { ...typography.tag, color: colors.pencil },
  line: { ...typography.body, lineHeight: 26, color: colors.pencil },
  label: { fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'), fontWeight: '700' },
});
