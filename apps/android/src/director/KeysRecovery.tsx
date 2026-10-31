// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' recovery, made or renewed on the director's device (#571, answers
// 556 to 558 and 599): one button makes the recovery from two new parts; when
// the keyring already holds one, it renews it, once the director has heard
// that the sheets in the school's safe and at the directorate stop working.
// While it is made, the page says so, then that the parts are shown; they show
// (RecoveryParts.tsx) until the director says both sheets are printed, which
// forgets them, or leaves the page. The page keeps them, and whether one is
// being made, above its tabs, so changing tab or reading the keyring again
// keeps them. A problem is said in the world's words, the keyring is read
// again, and the button works again; a keyring that changed since it was read
// asks again rather than renewing unasked.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { useDeviceText } from '../text/device-text';
import type { IssueDesk } from './issue-session';
import { isolate } from '../week/grid-labels';
import { makeRecovery, type MadeRecovery } from './keys-session';
import { RecoveryParts } from './RecoveryParts';

export type KeysRecoveryProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly desk: IssueDesk;
  /** Whether the keyring already holds a recovery. */
  readonly made: boolean;
  readonly kit: WorldKit;
  /** The school's name, for the sheets. */
  readonly school: string;
  readonly dayText: (day: Day) => string;
  /** The recovery just made, kept by the page, and how to keep or forget it. */
  readonly recovery: MadeRecovery | null;
  readonly setRecovery: (recovery: MadeRecovery | null) => void;
  /** Whether a recovery is being made, kept by the page too. */
  readonly making: boolean;
  readonly setMaking: (making: boolean) => void;
  /** What was last said of the making, kept by the page too. */
  readonly said: string | null;
  readonly setSaid: (said: string | null) => void;
  /** Reads the keyring again, once a recovery is made or a making failed. */
  readonly onMade: () => void;
};

/** Characters of the school's space ID the sheets name. */
const SPACE = 8;

/** The recovery's button, its renewal's question, and its two parts until they are printed. */
export function KeysRecovery(props: KeysRecoveryProps) {
  const { world, desk, made, kit, recovery, setRecovery, making, setMaking, said, setSaid, onMade } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [asking, setAsking] = useState(false);
  const going = useRef(false);

  const make = () => {
    if (going.current || making) return;
    going.current = true;
    setMaking(true);
    setAsking(false);
    setSaid(t('demo.keys.recovery.making'));
    void makeRecovery(world, desk, kit, made ? 'renew' : 'make')
      .then((fresh) => {
        setRecovery(fresh);
        setSaid(t('demo.keys.recovery.shown'));
      })
      .catch((error: unknown) => setSaid(t(problemOf(error) as 'demo.problem.other')))
      .finally(() => {
        going.current = false;
        setMaking(false);
        onMade();
      });
  };

  const forget = () => {
    setRecovery(null);
    setSaid(t('demo.keys.recovery.printed'));
  };

  const sheet =
    recovery === null
      ? ''
      : t('demo.keys.recovery.sheetFor', {
          school: isolate(props.school),
          space: isolate(desk.held.school.slice(0, SPACE)),
          date: isolate(props.dayText(world.date)),
          fingerprint: isolate(recovery.fingerprint),
        });

  return (
    <View testID="keys-recovery" style={styles.card}>
      {recovery !== null ? (
        <RecoveryParts recovery={recovery} sheet={sheet} onForget={forget} />
      ) : asking ? (
        <>
          <Button
            testID="keys-recovery-renew"
            label={t('demo.keys.recovery.renewYes')}
            variant="danger"
            disabled={making}
            onPress={make}
          />
          <Button
            testID="keys-recovery-cancel"
            label={t('demo.keys.recovery.cancel')}
            variant="line"
            onPress={() => {
              setAsking(false);
              setSaid(null);
            }}
          />
        </>
      ) : (
        <>
          <Text style={[styles.small, align]}>{t('demo.keys.recovery.note')}</Text>
          <Button
            testID="keys-recovery-make"
            label={t(made ? 'demo.keys.recovery.renew' : 'demo.keys.recovery.make')}
            disabled={making}
            onPress={made ? () => setAsking(true) : make}
          />
        </>
      )}
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[asking ? styles.head : styles.small, align]}
      >
        {asking ? t('demo.keys.recovery.renewAsk') : (said ?? '')}
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
