// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Right after the first PIN, on a phone that can match a strong fingerprint
// or face (#210): one question, whether to open with it too. «نعم» shows the
// phone's own prompt once, which the Keystore needs to make the key; «الرمز
// وحده» goes on. Either way setup goes on; «القفل والأمان» changes it later.

import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { WelcomeHero } from '../components/WelcomeHero';
import { colors, spacing, typography } from '../design/tokens';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { useText } from '../text/i18n';
import { errorCode } from './lock-rules';

export type BiometricAskProps = {
  readonly storage: Storage;
  /** The PIN just chosen, which the native module checks once more before making the key. */
  readonly pin: string;
  readonly onDone: () => void;
};

/** Offers the phone's fingerprint or face prompt, and calls `onDone` once answered. */
export function BiometricAsk({ storage, pin, onDone }: BiometricAskProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const turnOn = () => {
    setBusy(true);
    setFailed(false);
    storage.enableBiometrics(pin, t('lock.biometricAsk.promptTitle'), '', t('lock.biometricAsk.cancel')).then(
      (result) => {
        if (!mounted.current) return;
        if (result.opened) {
          onDone();
          return;
        }
        setBusy(false);
        setFailed(true);
      },
      (error: unknown) => {
        if (__DEV__) console.warn('Turning the fingerprint on failed', errorCode(error));
        if (!mounted.current) return;
        setBusy(false);
        setFailed(true);
      },
    );
  };

  const side = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { direction, paddingBottom: insets.bottom + spacing['space-16'] }]}
    >
      <WelcomeHero mark title={t('name')} tagline={t('tagline')} />
      <View style={[styles.body, side]}>
        <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction }]}>
          {t('lock.biometricAsk.title')}
        </Text>
        <Text style={[styles.line, { writingDirection: direction }]}>{t('lock.biometricAsk.line')}</Text>
        {failed && (
          <Text accessibilityLiveRegion="polite" style={[styles.line, { writingDirection: direction }]}>
            {t('lock.biometricAsk.failed')}
          </Text>
        )}
      </View>
      <View style={[styles.foot, side]}>
        <Button testID="biometric-yes" label={t('lock.biometricAsk.yes')} disabled={busy} onPress={turnOn} />
        <Button
          testID="biometric-no"
          variant="line"
          label={t('lock.biometricAsk.no')}
          disabled={busy}
          onPress={onDone}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1 },
  body: { gap: spacing['space-12'], paddingTop: spacing['space-24'] },
  title: { ...typography.h3, color: colors.ink, textAlign: 'start' },
  line: { ...typography.body, color: colors.ink, textAlign: 'start' },
  foot: { marginTop: 'auto', gap: spacing['space-10'], paddingTop: spacing['space-24'] },
});
