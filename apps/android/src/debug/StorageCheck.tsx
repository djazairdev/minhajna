// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The storage check's screen (#19), in debug builds only, opened from React
// Native's developer menu. It runs the core's shared storage checks on the
// phone as it opens, and again on request, and lists each result. The summary
// also goes to the log, so a script can read it with adb logcat. Below them
// are the crash check and the demo year (HistoryTools). Like the developer
// menu, it is in English: teachers never see it.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamilies, sizes, spacing, typography } from '../design/tokens';
import storage from '../native/NativeMinhajnaStorage';
import check from '../native/NativeMinhajnaStorageCheck';
import { HistoryTools } from './HistoryTools';
import { LOG_PREFIX, runStorageChecks, type CheckResult } from './storage-check';

/** Each result, then a summary, in the log. */
function log(results: readonly CheckResult[]) {
  for (const result of results) {
    console.log(`${LOG_PREFIX} ${result.passed ? 'PASS' : 'FAIL'} ${result.name} (${result.milliseconds} ms)`);
    if (result.error) console.log(`${LOG_PREFIX}   ${result.error}`);
  }
  const failed = results.filter((result) => !result.passed).length;
  console.log(`${LOG_PREFIX} done: ${results.length - failed} passed, ${failed} failed`);
}

export default function StorageCheck() {
  const insets = useSafeAreaInsets();
  const [results, setResults] = useState<readonly CheckResult[]>([]);
  const [running, setRunning] = useState(check !== null);
  const execute = useCallback(async () => {
    if (!check) return;
    try {
      const all = await runStorageChecks(storage, check, (result) => setResults((done) => [...done, result]));
      log(all);
    } finally {
      setRunning(false);
    }
  }, []);
  useEffect(() => {
    void execute();
  }, [execute]);
  const again = () => {
    setRunning(true);
    setResults([]);
    void execute();
  };
  const failed = results.filter((result) => !result.passed).length;
  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingBottom: spacing['space-20'] + insets.bottom }]}
      testID="storage-check"
    >
      <Text style={styles.note}>
        {check
          ? 'The core’s shared storage checks, on this phone’s SQLCipher and Keystore, each in a throwaway history.'
          : 'This build has no storage check module.'}
      </Text>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.summary} testID="storage-summary">
        {running ? `Running… ${results.length} done` : `${results.length - failed} passed, ${failed} failed`}
      </Text>
      {results.map((result) => (
        <View key={result.name} style={styles.result}>
          <Text style={[styles.name, !result.passed && styles.failed]}>
            {result.passed ? '✓' : '✗'} {result.name} · {result.milliseconds} ms
          </Text>
          {result.error && <Text style={styles.error}>{result.error}</Text>}
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        disabled={running || !check}
        onPress={again}
        style={[styles.button, (running || !check) && styles.disabled]}
        testID="storage-run"
      >
        <Text style={styles.buttonLabel}>Run again</Text>
      </Pressable>
      {check && <HistoryTools check={check} />}
    </ScrollView>
  );
}

const latin = { fontFamily: fontFamilies.latin, writingDirection: 'ltr' } as const;

const styles = StyleSheet.create({
  page: { padding: spacing['space-16'], gap: spacing['space-12'], direction: 'ltr' },
  note: { ...typography.body, ...latin, color: colors.ink2 },
  summary: { ...typography.h3, ...latin, color: colors.ink },
  result: { gap: spacing['space-4'] },
  name: { ...typography.body, ...latin, color: colors.ink },
  failed: { color: colors.due },
  error: { ...typography.fact, ...latin, color: colors.ink2 },
  button: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['space-16'],
    backgroundColor: colors.ink,
  },
  disabled: { opacity: 0.5 },
  buttonLabel: { ...typography.button, ...latin, color: colors.sheet },
});
