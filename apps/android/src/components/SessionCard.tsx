// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { controlIcon, Icon } from '../design/Icon';
import { colors, radius, shadows, sizes, spacing, typography } from '../design/tokens';
import { Button } from './Button';
import { DueStrip, type DueStripProps } from './DueStrip';
import { Proposal, type ProposalProps } from './Proposal';

/** The meta line: the class, the slot, and the subject where the card shows it. */
export type SessionMeta = { readonly className: string; readonly slot: string; readonly subject?: string };

/** A secondary button: its words, its action and its test ID's suffix. */
export type MoreAction = { readonly label: string; readonly onPress: () => void; readonly id: string };

export type SessionCardProps = { readonly meta: SessionMeta; readonly testID?: string } & (
  | {
      readonly kind: 'focus';
      readonly proposal: ProposalProps;
      readonly due?: readonly DueStripProps[];
      /** «تمّت كما هو مقترح»: the one tap that records the proposal. */
      readonly confirm: string;
      readonly onConfirm: () => void;
      /** The row of two line buttons, such as «نتيجة أخرى» and «تفاصيل الحصة», once their screens exist. */
      readonly more?: readonly [MoreAction, MoreAction];
    }
  | { readonly kind: 'mini'; readonly lesson: string; readonly note?: string }
  | {
      readonly kind: 'done';
      /** What was written, such as «أعمال موجهة: مراجعة العدد والمعدود». */
      readonly written: string;
      /** Where, such as «كُتبت في دفتر النصوص، الصفحة 10». */
      readonly where: string;
      /** A soft button that opens the entry, such as «عرض». */
      readonly show?: MoreAction;
    }
);

/**
 * A session on Today (docs/design/system/components/SessionCard): the focus
 * card for the next session awaiting confirmation, a mini card for the
 * others, and a done card once confirmed. Nothing is recorded without the
 * focus card's tap (PRD §3.1, rules 2–3). The focus card's rule-coloured
 * border marks it where Android 8 draws no outset shadow.
 */
export function SessionCard(props: SessionCardProps) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { meta, testID } = props;
  const spokenMeta = [meta.className, meta.slot, meta.subject].filter(Boolean).join(', ');
  const metaLine = (
    <View style={styles.meta} accessible accessibilityLabel={spokenMeta}>
      <Text style={styles.cls}>{meta.className}</Text>
      <Text style={styles.slot}>{meta.slot}</Text>
      {meta.subject !== undefined && (
        <>
          <View style={styles.dot} />
          <Text style={[styles.subject, align]}>{meta.subject}</Text>
        </>
      )}
    </View>
  );
  const sub = (id: string) => (testID === undefined ? undefined : `${testID}-${id}`);

  if (props.kind === 'focus') {
    return (
      <View testID={testID} style={[styles.card, styles.focus, { direction }]}>
        {metaLine}
        <Proposal {...props.proposal} />
        {props.due?.map((strip, index) => (
          <DueStrip key={index} {...strip} />
        ))}
        <Button testID={sub('confirm')} label={props.confirm} icon={controlIcon('check')} onPress={props.onConfirm} />
        {props.more !== undefined && (
          <View style={styles.buttons}>
            {props.more.map((action) => (
              <View key={action.id} style={styles.half}>
                <Button testID={sub(action.id)} variant="line" label={action.label} onPress={action.onPress} />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
  if (props.kind === 'mini') {
    return (
      <View testID={testID} style={[styles.card, styles.mini, { direction }]}>
        {metaLine}
        <Text style={[styles.lesson, align]}>{props.lesson}</Text>
        {props.note !== undefined && <Text style={[styles.note, align]}>{props.note}</Text>}
      </View>
    );
  }
  return (
    <View testID={testID} style={[styles.card, { direction }]}>
      {metaLine}
      <View style={styles.done}>
        <View style={styles.okdot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="check" size={sizes['icon-small']} color={colors.chalk} />
        </View>
        <View style={styles.written}>
          <Text style={[styles.lesson, align]}>{props.written}</Text>
          <Text style={[styles.note, align]}>{props.where}</Text>
        </View>
        {props.show !== undefined && (
          <Button testID={sub(props.show.id)} variant="soft" label={props.show.label} onPress={props.show.onPress} />
        )}
      </View>
    </View>
  );
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
  mini: { gap: spacing['space-4'] },
  meta: { minHeight: 30, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  cls: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: colors['on-subject'],
    backgroundColor: colors.subject,
    borderRadius: radius['radius-class'],
    paddingTop: spacing['space-2'],
    paddingBottom: spacing['space-4'],
    paddingHorizontal: 9,
  },
  slot: { ...typography.label, fontSize: 14, color: colors.ink },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors['sep-dot'] },
  subject: { ...typography.body, fontSize: 14, color: colors.ink2, flexShrink: 1 },
  lesson: { ...typography.body, lineHeight: 15 * 1.5, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  buttons: { flexDirection: 'row', gap: spacing['space-8'] },
  half: { flex: 1 },
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-10'] },
  okdot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.board,
  },
  written: { flex: 1, minWidth: 0 },
});
