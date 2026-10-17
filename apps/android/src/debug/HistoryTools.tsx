// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The storage check screen's tools for #19, in debug builds only: the crash
// check's writer and verifier, the demo year for the start-up check, and
// October's PDFs for the Arabic PDF check (#44). Each result goes to the log
// too, for the scripts that run the checks over adb.

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamilies, sizes, spacing, typography } from '../design/tokens';
import storage from '../native/NativeMinhajnaStorage';
import type { Spec as CheckSpec } from '../native/NativeMinhajnaStorageCheck';
import { CRASH_HISTORY, verifyCrashHistory, writeUntilStopped } from './crash-check';
import pdf from '../native/NativeMinhajnaPdf';
import { nativeDeps } from '../storage/history';
import { useText } from '../text/i18n';
import { fillWithDemoYear } from './demo-history';
import { makeDemoPdfs } from './pdf-check';
import { LOG_PREFIX } from './storage-check';

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function Tool({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export function HistoryTools({ check }: { check: CheckSpec }) {
  const t = useText();
  const [status, setStatus] = useState('');
  const [writing, setWriting] = useState(false);
  const stopped = useRef(false);
  useEffect(
    () => () => {
      stopped.current = true;
    },
    [],
  );
  const report = (line: string) => {
    console.log(`${LOG_PREFIX} ${line}`);
    setStatus(line);
  };
  const attempt = (task: () => Promise<string>) => {
    task().then(report, (error: unknown) => report(`failed: ${errorText(error)}`));
  };
  const write = () => {
    stopped.current = false;
    setWriting(true);
    attempt(async () => {
      try {
        const count = await writeUntilStopped(
          storage,
          check,
          () => stopped.current,
          (seq) => console.log(`${LOG_PREFIX} confirmed ${seq}`),
        );
        return `crash history stopped at ${count} entries`;
      } finally {
        setWriting(false);
      }
    });
  };
  return (
    <View style={styles.tools}>
      <Text accessibilityRole="header" style={styles.heading}>
        Crash check
      </Text>
      {writing ? (
        <Tool
          label="Stop writing"
          onPress={() => {
            stopped.current = true;
          }}
        />
      ) : (
        <Tool label="Write until stopped" onPress={write} />
      )}
      <Tool
        label="Verify the crash history"
        disabled={writing}
        onPress={() =>
          attempt(async () => `crash history verifies: ${await verifyCrashHistory(storage, check)} entries`)
        }
      />
      <Tool
        label="Delete the crash history"
        disabled={writing}
        onPress={() =>
          attempt(async () => {
            await check.deleteHistory(CRASH_HISTORY);
            return 'crash history deleted';
          })
        }
      />
      <Text accessibilityRole="header" style={styles.heading}>
        Demo year in the app’s own history
      </Text>
      {(['cem', 'primary'] as const).map((level) => (
        <Tool
          key={level}
          label={`Fill with a demo year (${level})`}
          disabled={writing}
          onPress={() =>
            attempt(async () => {
              const times = await fillWithDemoYear(storage, level);
              return `demo year: ${times.entries} entries, opened in ${times.openMilliseconds} ms, Today in ${times.todayMilliseconds} ms`;
            })
          }
        />
      ))}
      <Text accessibilityRole="header" style={styles.heading}>
        Arabic PDFs, October of the demo year
      </Text>
      <Tool
        label="Make the journal and roll-call PDFs"
        disabled={writing}
        onPress={() =>
          attempt(async () => {
            const made = await makeDemoPdfs(t, nativeDeps(storage));
            const one = (file: typeof made.journal) =>
              `${file.name} ${file.pages} pages, ${file.bytes} bytes, ${file.milliseconds} ms`;
            return `pdf: html ${made.htmlMilliseconds} ms; ${one(made.journal)}; ${one(made.roll)}`;
          })
        }
      />
      {(['journal-2026-10', 'roll-2026-10'] as const).map((name) => (
        <Tool
          key={name}
          label={`Share ${name}.pdf`}
          onPress={() =>
            attempt(async () => {
              await pdf.sharePdf(name, name);
              return `shared ${name}`;
            })
          }
        />
      ))}
      {status !== '' && (
        <Text accessibilityLiveRegion="polite" style={styles.status} testID="history-tools-status">
          {status}
        </Text>
      )}
    </View>
  );
}

const latin = { fontFamily: fontFamilies.latin, writingDirection: 'ltr' } as const;

const styles = StyleSheet.create({
  tools: { gap: spacing['space-12'], marginTop: spacing['space-16'] },
  heading: { ...typography.h3, ...latin, color: colors.ink },
  button: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['space-16'],
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  disabled: { opacity: 0.5 },
  label: { ...typography.button, ...latin, color: colors.ink },
  status: { ...typography.body, ...latin, color: colors.ink2 },
});
