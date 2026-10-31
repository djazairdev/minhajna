// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A device of a demo world waiting to hold the school key another device holds
// (#571, answer 600), as R-6.5-14 draws its first step: the one-time code, to
// scan with a device that holds the key, under the design's words, and this
// device's fingerprint, which the holder sees before it adds it. The screen is
// guarded as for a PIN pad while the code shows, since its secret admits the
// device. Every few seconds, and when asked, it reads its drop space
// (holder-wait.ts): once a holder added it, it shows the keyring's fingerprint
// and asks whether the holder shows the same; yes keeps the keyring, no starts
// over with a new code, as two different keyrings do, which it says. Giving up
// ends the wait. A problem is said in the world's words.

import { latestHeld } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { guardKey } from '../lock/lock-settings';
import qr from '../native/NativeMinhajnaCalendarInput';
import { problemOf } from '../school/school-join-session';
import { QrCode } from '../settings/QrCode';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { giveUp, keepAdmitted, readDrop, waitToHold, type Admitted, type Waiting } from './holder-wait';
import { spelled } from './keys-map';
import { PUBLIC_KEY_BYTES } from './school-desk';

/** How often the drop space is read, in milliseconds. */
const EVERY = 3000;

export type HolderWaitProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** The device holds the key now, or gave up: the page reads the store again. */
  readonly onDone: () => void;
  /** A new code is made: the page keeps waiting while the old wait is given up. */
  readonly onWait: () => void;
};

/** The one-time code and the wait for a holder to add this device. */
export function HolderWait({ world, kit, send, onDone, onWait }: HolderWaitProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [admitted, setAdmitted] = useState<Admitted | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const reading = useRef(false);
  const current = useRef<string | null>(null);
  const rows = useMemo(() => (waiting === null ? null : qr.qrRows(waiting.code)), [waiting]);
  const say = useCallback((error: unknown) => setSaid(t(problemOf(error) as 'demo.problem.other')), [t]);

  useEffect(() => guardKey(), []);
  useEffect(() => {
    let open = true;
    waitToHold(world, kit, send).then((one) => {
      if (!open) return;
      current.current = one.waiting.secret;
      setWaiting(one);
    }, say);
    return () => {
      open = false;
    };
  }, [world, kit, send, round, say]);

  const check = useCallback(
    (asked: boolean) => {
      if (waiting === null || admitted !== null || busy || reading.current) return;
      const secret = waiting.waiting.secret;
      reading.current = true;
      void readDrop(world, waiting.waiting, kit, send)
        .then((found) => {
          if (current.current !== secret) return;
          if (found === 'contested') setSaid(t('demo.keys.wait.contested'));
          else if (found !== null) setAdmitted(found);
          else if (asked) setSaid(t('demo.keys.wait.nothing'));
        })
        .catch((error: unknown) => current.current === secret && say(error))
        .finally(() => {
          reading.current = false;
        });
    },
    [world, kit, send, waiting, admitted, busy, t, say],
  );
  useEffect(() => {
    const timer = setInterval(() => check(false), EVERY);
    return () => clearInterval(timer);
  }, [check]);

  const act = (step: () => Promise<unknown>, after: () => void) => {
    setBusy(true);
    setSaid(null);
    step()
      .then(after, say)
      .finally(() => setBusy(false));
  };
  const keep = () =>
    waiting !== null &&
    admitted !== null &&
    act(
      () =>
        keepAdmitted(world, waiting.waiting, admitted, kit, send).catch((error: unknown) => {
          if (latestHeld(world.book.entries, PUBLIC_KEY_BYTES) === null) throw error;
        }),
      onDone,
    );
  const end = () => {
    const secret = current.current;
    current.current = null;
    return giveUp(world).catch((error: unknown) => {
      current.current = secret;
      throw error;
    });
  };
  const again = () => {
    onWait();
    act(end, () => {
      setWaiting(null);
      setAdmitted(null);
      setRound((one) => one + 1);
    });
  };

  return (
    <View testID="keys-wait" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.keys.wait.title')}
      </Text>
      {admitted === null ? (
        <>
          <Text style={[styles.small, align]}>{t('demo.keys.wait.scan')}</Text>
          {rows !== null && <QrCode testID="keys-wait-qr" rows={rows} module={4} label={t('demo.keys.wait.qr')} />}
          {waiting !== null && (
            <Text
              testID="keys-wait-device"
              accessibilityRole="text"
              accessibilityLabel={t('demo.keys.wait.device', { fingerprint: spelled(waiting.fingerprint) })}
              style={[styles.head, align]}
            >
              {t('demo.keys.wait.device', { fingerprint: isolate(waiting.fingerprint) })}
            </Text>
          )}
          <Button
            testID="keys-wait-check"
            variant="line"
            label={t('demo.keys.wait.check')}
            disabled={busy || waiting === null}
            onPress={() => check(true)}
          />
          <Button
            testID="keys-wait-again"
            variant="line"
            label={t('demo.keys.wait.again')}
            disabled={busy}
            onPress={again}
          />
        </>
      ) : (
        <>
          <Text
            testID="keys-wait-compare"
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
            accessibilityLabel={t('demo.keys.wait.compare', { fingerprint: spelled(admitted.fingerprint) })}
            style={[styles.head, align]}
          >
            {t('demo.keys.wait.compare', { fingerprint: isolate(admitted.fingerprint) })}
          </Text>
          <Button testID="keys-wait-same" label={t('demo.keys.wait.same')} disabled={busy} onPress={keep} />
          <Button
            testID="keys-wait-differ"
            variant="line"
            label={t('demo.keys.wait.differ')}
            disabled={busy}
            onPress={again}
          />
        </>
      )}
      <Button
        testID="keys-wait-give-up"
        variant="plain"
        label={t('demo.keys.wait.giveUp')}
        disabled={busy}
        onPress={() => act(end, onDone)}
      />
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {said ?? ''}
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
