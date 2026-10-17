// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { controlIcon, Icon } from '../design/Icon';
import { colors, radius, shadows, sizes, spacing, typography } from '../design/tokens';
import { Button } from '../components/Button';
import { DueStrip, type DueStripProps } from '../components/DueStrip';
import { Proposal, type ProposalProps } from '../components/Proposal';
import { MetaLine, type MoreAction, type SessionMeta } from '../components/SessionCard';

/** One year of the class: its badge, its spoken name, and its proposal, lesson or what was written. */
export type JointYear = {
  /** The test ID's suffix, such as the year's code. */
  readonly id: string;
  /** Such as «4». */
  readonly badge: string;
  /** Such as «4 ابتدائي», spoken before the year's line. */
  readonly name: string;
} & (
  | {
      readonly kind: 'proposal';
      readonly proposal: ProposalProps;
      /** A tap on the proposal records it alone. */
      readonly onConfirm: () => void;
      readonly hint: string;
    }
  | { readonly kind: 'lesson'; readonly lesson: string; readonly show?: MoreAction }
  | { readonly kind: 'done'; readonly written: string; readonly show?: MoreAction }
);

export type JointCardProps = {
  readonly meta: SessionMeta;
  readonly testID?: string;
  readonly years: readonly JointYear[];
  /** The roll call, one for the whole class. */
  readonly due?: readonly DueStripProps[];
  /** On the focus card: the one tap that records every year's proposal, and what it records. */
  readonly confirm?: { readonly label: string; readonly note: string; readonly onConfirm: () => void };
};

/**
 * A joint class's slot on Today (P-Multi, #43): one card, each year on its
 * own plan, the roll call once for the class. On the focus card, one tap
 * confirms every year's proposal, and a tap on a proposal confirms it alone.
 */
export function JointCard({ meta, testID, years, due, confirm }: JointCardProps) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sub = (id: string) => (testID === undefined ? undefined : `${testID}-${id}`);
  return (
    <View testID={testID} style={[styles.card, confirm !== undefined && styles.focus, { direction }]}>
      <MetaLine meta={meta} />
      {years.map((year) => (
        <View key={year.id} style={styles.year}>
          <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.badgeText}>{year.badge}</Text>
          </View>
          <View style={styles.body}>
            {year.kind === 'proposal' && (
              <Pressable
                testID={sub(`year-${year.id}`)}
                accessibilityRole="button"
                accessibilityLabel={[
                  year.name,
                  year.proposal.tag,
                  ...year.proposal.lines.map((line) => line.text),
                ].join('. ')}
                accessibilityHint={year.hint}
                onPress={year.onConfirm}
                style={({ pressed }) => [styles.press, pressed && styles.pressed]}
              >
                <Proposal {...year.proposal} />
              </Pressable>
            )}
            {year.kind !== 'proposal' && (
              <View style={styles.line} accessible accessibilityLabel={`${year.name}. ${lineOf(year)}`}>
                {year.kind === 'done' && (
                  <View style={styles.okdot}>
                    <Icon name="check" size={sizes['icon-small']} color={colors.chalk} />
                  </View>
                )}
                <Text style={[styles.lesson, align]}>{lineOf(year)}</Text>
              </View>
            )}
            {year.kind !== 'proposal' && year.show !== undefined && (
              <Button testID={sub(year.show.id)} variant="soft" label={year.show.label} onPress={year.show.onPress} />
            )}
          </View>
        </View>
      ))}
      {due?.map((strip, index) => (
        <DueStrip key={index} {...strip} />
      ))}
      {confirm !== undefined && (
        <>
          <Button
            testID={sub('confirm')}
            label={confirm.label}
            icon={controlIcon('check')}
            onPress={confirm.onConfirm}
          />
          <Text style={[styles.note, align]}>{confirm.note}</Text>
        </>
      )}
    </View>
  );
}

function lineOf(year: Exclude<JointYear, { kind: 'proposal' }>): string {
  return year.kind === 'done' ? year.written : year.lesson;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-10'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  focus: { borderColor: colors.rule, boxShadow: shadows['shadow-focus-card'] },
  year: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-10'] },
  badge: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['radius-class'],
    backgroundColor: colors.subject,
  },
  badgeText: { ...typography['class-chip'], color: colors['on-subject'] },
  body: { flex: 1, minWidth: 0, gap: spacing['space-6'] },
  press: { minHeight: sizes.target, minWidth: sizes.target, borderRadius: radius['radius-card'] },
  pressed: { opacity: 0.7 },
  line: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  lesson: { ...typography.body, lineHeight: 15 * 1.5, color: colors.ink, flexShrink: 1 },
  okdot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.board,
  },
  note: { ...typography.caption, color: colors.ink2 },
});
