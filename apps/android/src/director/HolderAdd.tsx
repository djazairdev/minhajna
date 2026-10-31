// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Adding a device that holds the school key, on a holder in a demo world (#571,
// answers 555 and 600), as R-6.5-14 draws its second step: the phone scans the
// new device's one-time code with its camera, and a PC, which scans none, takes
// its text pasted; the code's device fingerprint is then shown with the
// question whether to add it, to compare with the one on the new device, so a
// code put in its place is caught. Once added, the keyring's fingerprint is
// shown for the new device to compare, or that the device held the key already
// and its keyring was sent again. A code that is not a holder's, or a problem,
// is said in the world's words.

import { holderFingerprint, readHolderQr, type Holder } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { errorCode } from '../lock/lock-rules';
import scanner from '../native/NativeMinhajnaCalendarInput';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { addDevice } from './holders-session';
import { spelled } from './keys-map';
import type { IssueDesk } from './school-desk';

export type HolderAddProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly desk: IssueDesk;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** Reads the keyring again, once a device is added. */
  readonly onAdded: () => void;
};

/** The way to add a device from its one-time code. */
export function HolderAdd({ world, desk, kit, send, onAdded }: HolderAddProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [pasted, setPasted] = useState('');
  const [scanned, setScanned] = useState<{ holder: Holder; secret: string; fingerprint: string } | null>(null);
  const [said, setSaid] = useState<{ readonly text: string; readonly spoken?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const adding = useRef(false);
  const open = useRef(true);
  const pc = onPc();
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      scanner.cancel();
    };
  }, []);
  const sayText = (text: string) => setSaid({ text });
  const say = (error: unknown) => open.current && sayText(t(problemOf(error) as 'demo.problem.other'));

  const read = (text: string) => {
    setSaid(null);
    const code = readHolderQr(text.trim());
    if (code === null) return sayText(t('demo.keys.add.notCode'));
    if (code.holder.id === desk.held.device) return sayText(t('demo.keys.add.own'));
    holderFingerprint(code.holder, desk.crypto).then(
      (fingerprint) => open.current && setScanned({ ...code, fingerprint }),
      say,
    );
  };
  const scan = () => {
    setSaid(null);
    scanner
      .scanQr(t('demo.keys.add.scan'), t('demo.keys.add.hint'), t('demo.keys.recovery.cancel'), direction === 'rtl')
      .then((text) => open.current && text !== null && read(text))
      .catch((error: unknown) => {
        const camera = errorCode(error) === 'E_CALENDAR_CAMERA';
        if (open.current) sayText(t(camera ? 'demo.school.problem.camera' : 'demo.school.problem.scan'));
      });
  };
  const add = () => {
    if (scanned === null || adding.current) return;
    adding.current = true;
    setBusy(true);
    void addDevice(world, desk, scanned, kit, send)
      .then(({ fingerprint, added }) => {
        if (!open.current) return;
        setScanned(null);
        setPasted('');
        const key = added ? 'demo.keys.add.done' : 'demo.keys.add.again';
        setSaid({
          text: t(key, { fingerprint: isolate(fingerprint) }),
          spoken: t(key, { fingerprint: spelled(fingerprint) }),
        });
        onAdded();
      })
      .catch(say)
      .finally(() => {
        adding.current = false;
        if (open.current) setBusy(false);
      });
  };

  return (
    <View testID="keys-add" style={styles.card}>
      {scanned === null ? (
        <>
          {pc && (
            <TextField
              testID="keys-add-paste"
              label={t('demo.keys.add.paste')}
              placeholder={t('demo.keys.add.placeholder')}
              value={pasted}
              onChangeText={setPasted}
              textDirection="ltr"
              returnKeyType="done"
              onSubmitEditing={() => pasted.trim() !== '' && read(pasted)}
            />
          )}
          <Button
            testID="keys-add-scan"
            label={t('demo.keys.add.button')}
            disabled={pc && pasted.trim() === ''}
            onPress={() => (pc ? read(pasted) : scan())}
          />
        </>
      ) : (
        <>
          <Text
            testID="keys-add-confirm"
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
            accessibilityLabel={t('demo.keys.add.confirm', { fingerprint: spelled(scanned.fingerprint) })}
            style={[styles.head, align]}
          >
            {t('demo.keys.add.confirm', { fingerprint: isolate(scanned.fingerprint) })}
          </Text>
          <Button testID="keys-add-yes" label={t('demo.keys.add.yes')} disabled={busy} onPress={add} />
          <Button
            testID="keys-add-cancel"
            variant="line"
            label={t('demo.keys.recovery.cancel')}
            disabled={busy}
            onPress={() => {
              setScanned(null);
              setPasted('');
            }}
          />
        </>
      )}
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={said?.spoken}
        style={[styles.small, align]}
      >
        {said?.text ?? ''}
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
