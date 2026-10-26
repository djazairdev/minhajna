// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «القفل والأمان» (#210, Security): how the app opens, changing the PIN,
// the automatic lock's delay, whether screenshots are allowed on screens
// with pupils' records, and what is fixed and cannot be switched off
// (PRD §6.4). The fingerprint or face shows only where the phone can match
// a strong one. Each choice is kept the moment it is made. The activity log
// the design links to comes with its own issue. On a PC (#250) the app opens
// with the passphrase, a browser cannot block screenshots, and the fixed
// protections are the PC's own.

import { useFocusEffect, useLocale } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Facts } from '../components/Facts';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { Switch } from '../components/Switch';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import type { LockStatus, Spec as Storage } from '../native/NativeMinhajnaStorage';
import { useText } from '../text/i18n';
import { errorCode } from './lock-rules';
import { allowScreenshots, setLockDelay, useLockSettings } from './lock-settings';

/** What the PIN page just did, said once at the top. */
export type SecurityDone = 'pin' | 'biometricOn';

export type SecurityProps = {
  readonly storage: Storage;
  readonly done?: SecurityDone;
  /** When the PIN page came back, so the same change twice is said twice; the screen keeps it once the route forgets it. */
  readonly doneAt?: number;
  readonly onChangePin: () => void;
  /** Asks for the PIN, then the phone's prompt, to turn the fingerprint or face on. */
  readonly onTurnOnPhone: () => void;
};

type Said = SecurityDone | 'biometricOff' | 'failed';

const SAID = {
  pin: 'security.pinChanged',
  biometricOn: 'security.biometricOn',
  biometricOff: 'security.biometricOff',
  failed: 'security.failed',
} as const;

const FIXED = ['fixedDatabase', 'fixedNotifications', 'fixedBackup', 'fixedPermissions'] as const;

/** A PC opens with its passphrase, keeps its history in the browser, and cannot block screenshots (#250). */
const WEB = Platform.OS === 'web';
const WEB_FIXED = ['web.fixedEncrypted', 'web.fixedKey', 'web.fixedServer'] as const;

/** The lock's choices on this phone, and the protections that stay on. */
export function Security({ storage, done, doneAt, onChangePin, onTurnOnPhone }: SecurityProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const settings = useLockSettings();
  const [status, setStatus] = useState<LockStatus | null>(null);
  const [here, setHere] = useState<Said | null>(done ?? null);
  const [seen, setSeen] = useState(doneAt);
  if (doneAt !== seen) {
    setSeen(doneAt);
    if (done !== undefined && doneAt !== undefined) setHere(done);
  }
  const [busy, setBusy] = useState(false);
  const say = (what: Said) => setHere(what);
  const said = here;

  const refresh = useCallback(() => {
    let live = true;
    storage.lockStatus().then(
      (next) => {
        if (live) setStatus(next);
      },
      (error: unknown) => {
        if (__DEV__) console.warn('The lock status did not read', errorCode(error));
      },
    );
    return () => {
      live = false;
    };
  }, [storage]);
  useFocusEffect(refresh);

  const failed = (error: unknown) => {
    if (__DEV__) console.warn('A lock setting did not save', errorCode(error));
    say('failed');
  };

  const chooseOpening = (value: 'phone' | 'pin') => {
    if (status === null || (value === 'phone') === status.biometric) return;
    if (value === 'phone') {
      onTurnOnPhone();
      return;
    }
    setBusy(true);
    storage
      .disableBiometrics()
      .then(() => say('biometricOff'), failed)
      .finally(() => {
        setBusy(false);
        refresh();
      });
  };

  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      {said !== null && (
        <Notice
          testID="security-said"
          icon={controlIcon(said === 'failed' ? 'info' : 'check')}
          message={t(WEB && said === 'pin' ? 'security.web.changed' : SAID[said])}
        />
      )}
      {status !== null && (status.biometricAvailable || status.biometric) ? (
        <RadioCardGroup
          testID="security-open"
          label={t('security.open')}
          selected={status.biometric ? 'phone' : 'pin'}
          disabled={busy}
          onSelect={chooseOpening}
          choices={[
            { value: 'phone', label: t('security.withPhone'), description: t('security.withPhoneLine') },
            { value: 'pin', label: t('security.pinOnly'), description: t('security.pinOnlyLine') },
          ]}
        />
      ) : (
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('security.open')}</Text>
          {status !== null && (
            <Text style={[styles.body, align]}>{t(WEB ? 'security.web.open' : 'security.noBiometric')}</Text>
          )}
        </View>
      )}
      <Button
        testID="security-change-pin"
        variant="line"
        label={t(WEB ? 'security.web.change' : 'security.changePin')}
        onPress={onChangePin}
      />
      <SegmentedControl
        testID="security-delay"
        label={t('security.delay')}
        selected={String(settings.delayMinutes) as '1' | '5' | '15'}
        onSelect={(value) => {
          setLockDelay(Number(value)).catch(failed);
        }}
        choices={[
          { value: '1', label: t('security.minutes', { count: 1 }) },
          { value: '5', label: t('security.minutes', { count: 5 }) },
          { value: '15', label: t('security.minutes', { count: 15 }) },
        ]}
      />
      {!WEB && (
        <Switch
          testID="security-screenshots"
          label={t('security.screenshots')}
          description={t('security.screenshotsLine')}
          value={settings.screenshots}
          onValueChange={(allowed) => {
            allowScreenshots(allowed).catch(failed);
          }}
        />
      )}
      <View style={styles.group}>
        <Text accessibilityRole="header" style={[styles.label, align]}>
          {t('security.fixed')}
        </Text>
        <Facts
          keptLabel={t('security.fixedLabel')}
          notKeptLabel={t('security.notFixed')}
          kept={(WEB ? WEB_FIXED : FIXED).map((id) => ({ id, text: t(`security.${id}`), kept: true }))}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-20'], paddingTop: spacing['space-16'] },
  group: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
});
