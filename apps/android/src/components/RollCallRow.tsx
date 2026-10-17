// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One pupil in the roll call (#131, RollCallRow): a number, the name, and two
// toggles, «غياب» and «تأخر». Everyone is present by default; only absence
// and lateness are marked, and lateness never counts as an absence (PRD
// §3.4). Absent is board with chalk text; late is hi with a late-edge border
// and a tick besides its fill, so colour is never the only signal. A marked
// row is shaded alt-day. Each toggle reports its state, and its spoken name
// includes the pupil's. The caller owns the states and saves them. The
// name may be a button, such as one that opens the pupil's correction.

import { useLocale } from '@react-navigation/native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../design/Icon';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type RollCallRowProps = {
  readonly number: number;
  readonly name: string;
  readonly absent: boolean;
  readonly late: boolean;
  readonly onAbsent: (absent: boolean) => void;
  readonly onLate: (late: boolean) => void;
  /** Makes the name a button, such as one that opens the pupil's correction once the roll call is taken. */
  readonly onName?: () => void;
  /** The name button's spoken name. */
  readonly nameLabel?: string;
  readonly testID?: string;
};

function Toggle(props: {
  kind: 'absent' | 'late';
  on: boolean;
  label: string;
  spoken: string;
  onPress: () => void;
  testID?: string;
}) {
  const late = props.kind === 'late';
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="checkbox"
      accessibilityLabel={props.spoken}
      accessibilityState={{ checked: props.on }}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.toggle,
        props.on && (late ? styles.lateOn : styles.absentOn),
        pressed && !props.on && styles.pressed,
      ]}
    >
      {props.on && late && <Icon name="check" size={sizes['icon-small']} color={colors.ink} />}
      <Text style={[styles.toggleLabel, props.on && (late ? styles.lateLabel : styles.absentLabel)]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export const RollCallRow = memo(function RollCallRow(props: RollCallRowProps) {
  const { direction } = useLocale();
  const t = useText();
  const sub = (id: string) => (props.testID === undefined ? undefined : `${props.testID}-${id}`);
  return (
    <View style={[styles.row, { direction }, (props.absent || props.late) && styles.marked]}>
      <Text style={styles.number}>{props.number}</Text>
      {props.onName === undefined ? (
        <Text style={[styles.name, { writingDirection: direction }]}>{props.name}</Text>
      ) : (
        <Pressable
          testID={sub('name')}
          accessibilityRole="button"
          accessibilityLabel={props.nameLabel ?? props.name}
          onPress={props.onName}
          style={({ pressed }) => [styles.nameButton, pressed && styles.pressed]}
        >
          <Text style={[styles.name, styles.link, { writingDirection: direction }]}>{props.name}</Text>
        </Pressable>
      )}
      <Toggle
        testID={sub('absent')}
        kind="absent"
        on={props.absent}
        label={t('roll.absent')}
        spoken={t('roll.spoken', { state: t('roll.absent'), name: props.name })}
        onPress={() => props.onAbsent(!props.absent)}
      />
      <Toggle
        testID={sub('late')}
        kind="late"
        on={props.late}
        label={t('roll.late')}
        spoken={t('roll.spoken', { state: t('roll.late'), name: props.name })}
        onPress={() => props.onLate(!props.late)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-10'],
    paddingHorizontal: spacing['space-16'],
    paddingVertical: spacing['space-4'],
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.sheet,
  },
  marked: { backgroundColor: colors['alt-day'] },
  number: { ...typography['roll-number'], color: colors.ink2, minWidth: 24, textAlign: 'center' },
  name: { ...typography.body, color: colors.ink, flex: 1, minWidth: 0, textAlign: 'start' },
  nameButton: { flex: 1, minWidth: 0, minHeight: sizes.target, justifyContent: 'center' },
  link: { flex: 0, textDecorationLine: 'underline' },
  toggle: {
    width: 64,
    minHeight: sizes.target,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-2'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  absentOn: { backgroundColor: colors.board, borderColor: colors.board },
  lateOn: { backgroundColor: colors.hi, borderColor: colors['late-edge'] },
  pressed: { backgroundColor: colors.soft },
  toggleLabel: { ...typography.label, color: colors.ink },
  absentLabel: { color: colors.chalk },
  lateLabel: { fontWeight: '700' },
});
