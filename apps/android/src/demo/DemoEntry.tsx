// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo worlds' entry (#560 and #561, answers 572, 573 and 575), on the lock
// pages' board and paper side, from the existing components until #515's boards
// are exported, the board saying the page connects to the demo server alone and
// only while a world is open: what a world is, the warning that anyone with its
// code acts in it, then, on a PC, starting a world of either kind, and typing a
// code and entering it. The phone only enters. While the world's keys are
// worked out, which takes about a second on a PC and a few on a phone, the page
// says so and takes no other choice; a refusal shows where the lock's wrong
// passphrase does, and is read out.

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RowLink } from '../components/RowLink';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { WebLockPage } from '../lock/web/WebLockPage';
import { useDeviceText } from '../text/device-text';
import type { WorldKind } from '@minhajna/core';

export type DemoEntryProps = {
  /** True while a world is being started or entered. */
  readonly busy: boolean;
  /** What went wrong, as the catalogue says it. */
  readonly problem: string | null;
  /** Starts a world of a kind; none where worlds are only entered, as on the phone. */
  readonly onStart?: (kind: WorldKind) => void;
  readonly onJoin: (code: string) => void;
  readonly onBack: () => void;
};

/** Starts a demo world of either kind, or enters one by its code. */
export function DemoEntry({ busy, problem, onStart, onJoin, onBack }: DemoEntryProps) {
  const t = useDeviceText();
  const [code, setCode] = useState('');
  const join = () => {
    if (!busy && code.trim() !== '') onJoin(code);
  };
  return (
    <WebLockPage
      title={t('demo.entry.title')}
      message={problem ?? undefined}
      facts={[t('demo.entry.line')]}
      boardLine={t('demo.entry.board')}
      warning={
        <Notice
          testID="demo-warning"
          variant="notice"
          badge={t('demo.band')}
          title={t('demo.entry.warningTitle')}
          message={t('demo.entry.warning')}
        />
      }
    >
      {onStart !== undefined && (
        <>
          <RowLink
            testID="demo-start-national"
            icon={controlIcon('globe')}
            title={t('demo.entry.national')}
            description={t('demo.entry.nationalLine')}
            disabled={busy}
            onPress={() => onStart('national')}
          />
          <RowLink
            testID="demo-start-teachers"
            icon={controlIcon('pupils')}
            title={t('demo.entry.teachers')}
            description={t('demo.entry.teachersLine')}
            disabled={busy}
            onPress={() => onStart('teachers')}
          />
        </>
      )}
      <TextField
        testID="demo-code"
        label={t('demo.entry.code')}
        placeholder=""
        value={code}
        onChangeText={setCode}
        onSubmitEditing={join}
        autoCapitalize="characters"
        autoComplete="off"
        textDirection="ltr"
        editable={!busy}
      />
      <Button testID="demo-join" label={t('demo.entry.join')} onPress={join} disabled={busy || code.trim() === ''} />
      {busy && (
        <View style={styles.working} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.workingText}>{t('demo.entry.working')}</Text>
        </View>
      )}
      <Button testID="demo-back" variant="plain" label={t('demo.entry.back')} onPress={onBack} disabled={busy} />
    </WebLockPage>
  );
}

const styles = StyleSheet.create({
  working: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  workingText: { ...typography.small, color: colors.ink2, flex: 1, textAlign: 'start' },
});
