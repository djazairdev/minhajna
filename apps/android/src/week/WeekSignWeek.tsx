// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The week's record on Week-sign (#582, answer 610), as the design draws it:
// the first session awaiting confirmation, with its day, span, group and week,
// as the focus card, confirmed as planned or not held, with the line that
// signing as it stands leaves it awaiting, which is never an absence; then
// every session with its state, a confirmed one with a way to change it back,
// named with its session; what else the week holds, which a demo world does not
// record yet; what stays on the teacher's devices only, the reason for a
// session not held and private notes; and the four lines on the working record,
// the official record, correcting it and when a signature counts. Once the week
// is signed its sessions show as signed, and while the page reads or signs,
// with nothing to change.

import type { SessionState, WeekSession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { sessionKey } from './week-sign-session';
import { slotText } from './week-sign-text';

type Session = Omit<WeekSession, 'state'>;

export type WeekSignWeekProps = {
  readonly sessions: readonly Session[];
  /** Each session's state, by its key. */
  readonly state: (one: Session) => SessionState;
  /** Confirms a session, or returns it to awaiting; absent once signed and while the page reads or signs. */
  readonly onState?: (one: Session, state: SessionState) => void;
};

/** The week's record: the session awaiting confirmation first, every session with its state, and what stays out. */
export function WeekSignWeek({ sessions, state, onState }: WeekSignWeekProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const slot = (one: Session) => slotText(t, one);
  const focus = onState === undefined ? undefined : sessions.find((one) => state(one) === 'awaiting');
  return (
    <View style={styles.column}>
      {focus !== undefined && onState !== undefined && (
        <View testID="week-sign-focus" style={[styles.card, styles.focus]}>
          <Text style={[styles.label, align]}>{t('demo.weekSign.awaiting')}</Text>
          <Text style={[styles.title, align]}>{slot(focus)}</Text>
          <View style={styles.buttons}>
            <Button testID="week-sign-held" label={t('demo.weekSign.held')} onPress={() => onState(focus, 'held')} />
            <Button
              testID="week-sign-not-held"
              variant="line"
              label={t('demo.weekSign.notHeld')}
              onPress={() => onState(focus, 'not-held')}
            />
          </View>
          <Text style={[styles.small, align]}>{t('demo.weekSign.asItStands')}</Text>
        </View>
      )}
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('demo.weekSign.record')}
      </Text>
      {sessions.map((one) => (
        <View key={sessionKey(one)} testID="week-sign-row" style={styles.row}>
          <Text style={[styles.body, styles.grow, align]}>
            {`${slot(one)} · ${t(`demo.weekSign.states.${state(one)}`)}`}
          </Text>
          {onState !== undefined && state(one) !== 'awaiting' && (
            <Button
              testID="week-sign-undo"
              variant="plain"
              label={t('demo.weekSign.undo')}
              name={t('demo.weekSign.undoOf', { session: slot(one) })}
              onPress={() => onState(one, 'awaiting')}
            />
          )}
        </View>
      ))}
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('demo.weekSign.also')}
      </Text>
      <Text style={[styles.small, align]}>{t('demo.weekSign.alsoLine')}</Text>
      <View style={styles.card}>
        <Text style={[styles.label, align]}>{t('demo.weekSign.privateHead')}</Text>
        <Text style={[styles.small, align]}>{t('demo.weekSign.privateLine')}</Text>
      </View>
      {(['before', 'after', 'fix', 'counted'] as const).map((key) => (
        <Text key={key} style={[styles.small, align]}>
          {t(`demo.weekSign.lines.${key}`)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing['space-8'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-14'],
    gap: spacing['space-8'],
  },
  focus: { borderColor: colors.ink },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1 },
  title: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
