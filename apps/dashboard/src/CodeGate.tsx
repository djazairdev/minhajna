// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The edit-code gate of a dashboard page (answer 809), as N-Reference draws it:
// the first visitor sets the code, typed twice; after that it is entered. The
// page opens only once the server has read what the code opens. The page holds
// the code in memory and nothing keeps it. A refused code says so; a code set
// by someone else meanwhile turns the gate into the one that asks for it, and
// says so; a code set whose page did not then read asks for it too, saying what
// went wrong.

import { useLocale } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../android/src/components/Button';
import { TextField } from '../../android/src/components/TextField';
import { controlIcon } from '../../android/src/design/Icon';
import { colors, radius, spacing, typography } from '../../android/src/design/tokens';
import { isEditCode, type DirectoryOptions } from '../../android/src/network/directory-network';
import { useDashboardText } from './text';
import { DirectoryStatus } from './DirectoryStatus';
import { useDirectoryCall } from './use-directory-call';

export type CodeGateProps<T> = {
  readonly title: string;
  readonly claimed: (options: DirectoryOptions) => Promise<boolean>;
  readonly claim: (code: string, options: DirectoryOptions) => Promise<unknown>;
  /** Reads what the code opens; a refused code rejects. */
  readonly read: (code: string, options: DirectoryOptions) => Promise<T>;
  readonly onOpen: (code: string, value: T) => void;
};

/** The page's gate: setting its code or entering it. */
export function CodeGate<T>({ title, claimed, claim, read, onOpen }: CodeGateProps<T>) {
  const t = useDashboardText();
  const { direction } = useLocale();
  const call = useDirectoryCall();
  const { run } = call;
  const [taken, setTaken] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [again, setAgain] = useState('');
  const [wrong, setWrong] = useState<string | null>(null);
  const check = useCallback(() => {
    void run(claimed).then((known) => {
      if (known !== undefined) setTaken(known);
    });
  }, [run, claimed]);
  useEffect(check, [check]);
  const enter = async () => {
    const value = await run((options) => read(code, options));
    if (value !== undefined) onOpen(code, value);
  };
  const set = async () => {
    const step = { claimed: false };
    const done = await run(async (options) => {
      await claim(code, options);
      step.claimed = true;
      return read(code, options);
    });
    if (done !== undefined) {
      onOpen(code, done);
      return;
    }
    if (step.claimed) {
      setTaken(true);
      return;
    }
    const now = await claimed({}).catch(() => null);
    if (now === true) {
      call.clear();
      setTaken(true);
      setWrong(t('dashboard.gate.taken'));
    }
  };
  const submit = () => {
    if (call.busy) return;
    const fresh = taken === false;
    if (!isEditCode(code)) setWrong(t('dashboard.gate.badCode'));
    else if (fresh && code !== again) setWrong(t('dashboard.gate.different'));
    else {
      setWrong(null);
      void (fresh ? set() : enter());
    }
  };
  return (
    <View style={[styles.gate, { direction }]}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction, textAlign: 'start' }]}>
          {title}
        </Text>
        <DirectoryStatus
          call={call}
          retry={taken === null ? { label: t('dashboard.tryAgain'), onPress: check } : undefined}
        />
        {taken !== null && (
          <>
            <TextField
              testID="gate-code"
              label={t('dashboard.gate.code')}
              value={code}
              onChangeText={setCode}
              secureTextEntry
              textDirection="ltr"
              autoCapitalize="none"
              autoCorrect={false}
              error={wrong ?? undefined}
              onSubmitEditing={submit}
            />
            {!taken && (
              <TextField
                testID="gate-again"
                label={t('dashboard.gate.again')}
                value={again}
                onChangeText={setAgain}
                secureTextEntry
                textDirection="ltr"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submit}
              />
            )}
            <Button
              testID="gate-open"
              icon={controlIcon('lock')}
              label={t(taken ? 'dashboard.gate.open' : 'dashboard.gate.set')}
              disabled={call.busy || code === ''}
              onPress={submit}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { alignItems: 'center', paddingVertical: spacing['space-20'] },
  card: {
    width: 400,
    maxWidth: '100%',
    gap: spacing['space-12'],
    padding: spacing['space-20'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  title: { ...typography.h3, color: colors.ink },
});
