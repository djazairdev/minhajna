// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspector's key card on the inspector's home in a national world (#593,
// answer 621): as it opens, the device posts its key in its directorate's
// space (inspector-key-session.ts), then shows the key's fingerprint in its
// four groups and says the inspectorate sends it to the school in its official
// message, which the school's director checks before opening any signed week.
// While posting it says so, and once posted that is announced; when posting
// fails, it says why as an alert and offers to try again, announced on the
// phone, since a PC reads the alert.

import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { useSaid } from '../week/useSaid';
import { postInspectorKey } from './inspector-key-session';

export type InspectorKeyProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  /** The directorate's seeded ID, whose space the key goes to. */
  readonly directorate: string;
  readonly kit: WorldKit;
  readonly send?: Send;
};

/** The inspector's key, posted in its directorate's space, and its fingerprint. */
export function InspectorKey({ world, directorate, kit, send }: InspectorKeyProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const { say, region } = useSaid('', 'inspector-key-said');
  const mounted = useRef(true);
  const working = useRef(false);
  const post = () =>
    postInspectorKey(world, directorate, kit, send).then(
      (posted) => {
        if (!mounted.current) return;
        working.current = false;
        setFingerprint(posted.fingerprint);
        say(t('demo.inspectorKey.posted'));
      },
      (error: unknown) => {
        if (!mounted.current) return;
        working.current = false;
        const words = problemOf(error);
        setProblem(words);
        if (!onPc()) say(t(words));
      },
    );
  const first = useEffectEvent(() => {
    working.current = true;
    void post();
  });
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const again = () => {
    if (working.current) return;
    working.current = true;
    setProblem(null);
    void post();
  };
  return (
    <View testID="inspector-key" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.inspectorKey.title')}
      </Text>
      {fingerprint === null && problem === null && (
        <Text testID="inspector-key-posting" style={[styles.small, align]}>
          {t('demo.inspectorKey.posting')}
        </Text>
      )}
      {fingerprint !== null && (
        <>
          <Text style={[styles.small, align]}>{t('demo.inspectorKey.posted')}</Text>
          <Text style={[styles.label, align]}>{t('demo.inspectorKey.fingerprint')}</Text>
          <Text
            testID="inspector-key-fingerprint"
            selectable
            accessibilityLabel={[...fingerprint.split('-').join('')].join(' ')}
            style={styles.code}
          >
            {fingerprint.split('-').join(' ')}
          </Text>
          <Text style={[styles.small, align]}>{t('demo.inspectorKey.line')}</Text>
        </>
      )}
      {problem !== null && (
        <>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          <Button testID="inspector-key-again" variant="line" label={t('demo.inspectorKey.again')} onPress={again} />
        </>
      )}
      {region}
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
  label: { ...typography.label, color: colors.ink2 },
  small: { ...typography.small, color: colors.ink2 },
  code: {
    ...typography['body-latin'],
    color: colors.ink,
    writingDirection: 'ltr',
    textAlign: 'left',
    letterSpacing: 2,
  },
  problem: { ...typography.body, color: colors['error-ink'] },
});
