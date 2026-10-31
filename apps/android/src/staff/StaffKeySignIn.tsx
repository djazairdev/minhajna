// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing in on a staffroom PC with a school security key in a national demo
// world (#572, answer 602), for a teacher without a smartphone: the browser
// asks for the key and its PIN, and the session the director's PC put at the
// key's place opens at once, since the key with its PIN is the teacher's proof.
// A browser without security keys says so; a key never set up in the world, a
// key or browser without the PRF extension, a closed prompt and any other
// problem are said in the world's words. Leaving the screen aborts the key's
// prompt, and an answer that comes after it is dropped.

import type { PcSession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { useDeviceText } from '../text/device-text';
import { signInWithKey } from './key-session';
import { browserKey, type StaffKey } from './security-key';

export type StaffKeySignInProps = {
  readonly world: Pick<OpenWorld, 'world'>;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** The browser's keys; by default, the browser's own. */
  readonly staffKey?: StaffKey | null;
  readonly onSession: (session: PcSession) => void;
};

/** The staffroom PC's sign-in with a security key. */
export function StaffKeySignIn({ world, kit, send, staffKey, onSession }: StaffKeySignInProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const key = useMemo(() => (staffKey === undefined ? browserKey(kit.random) : staffKey), [staffKey, kit]);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const asking = useRef<AbortController | null>(null);
  useEffect(() => () => asking.current?.abort(), []);
  const ask = () => {
    if (key === null || asking.current !== null) return;
    const controller = new AbortController();
    asking.current = controller;
    setBusy(true);
    setSaid(null);
    const live = () => !controller.signal.aborted;
    void signInWithKey(world, key, kit, send, controller.signal)
      .then(
        (session) => live() && onSession(session),
        (error: unknown) => live() && setSaid(t(problemOf(error) as 'demo.problem.other')),
      )
      .finally(() => {
        if (!live()) return;
        asking.current = null;
        setBusy(false);
      });
  };
  return (
    <View testID="staff-key-sign-in" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.staff.key.title')}
      </Text>
      <Text style={[styles.small, align]}>{t(key === null ? 'demo.staff.key.none' : 'demo.staff.key.note')}</Text>
      {key !== null && <Button testID="staff-key" label={t('demo.staff.key.button')} disabled={busy} onPress={ask} />}
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {said ?? (busy ? t('demo.staff.key.asking') : '')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
