// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// My log on the PC workspaces of the director and the preparer in a national
// demo world (#573, §7.8, R-7.8-09, answer 603): a dated row for each action
// this device took in the world, worked out from its history and the key it
// holds as the page opens, in the history's order and never with a clock time:
// the school key started or this device added to it, devices added to or
// removed from it, its recovery made or renewed, each change of the school's
// choice to send absences (#592), and each joining code or security key issued,
// its teacher named from the school's staff list by the line's school and
// assignment, or as a teacher of the school when none matches. The rows show
// once the names are worked out, and a failure to work them out is said. The
// preparer's actions are not kept in a world yet, so its page says so, and the
// director's lines never show there. Under the rows: each member of the
// administration sees their own actions alone, the teacher every reading of
// their records, and days only, signing in never listed.

import {
  assignmentId,
  latestHeld,
  staffLog,
  type Day,
  type DemoSchool,
  type Entry,
  type StaffLine,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { worldKeyCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import type { WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { personName } from './dashboard-text';
import { PUBLIC_KEY_BYTES } from './school-desk';

export type OwnLogProps = {
  readonly world: Pick<OpenWorld, 'book'>;
  readonly school: DemoSchool;
  readonly role: 'director' | 'preparer';
  readonly kit: WorldKit;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

type Words = ReturnType<typeof useDeviceText>;
type Log = { readonly lines: readonly StaffLine[]; readonly names: ReadonlyMap<string, string> };

/** This device's own lines in the world, and its teachers' names by school and assignment. */
async function workedOut(entries: readonly Entry[], school: DemoSchool, kit: WorldKit): Promise<Log> {
  const held = latestHeld(entries, PUBLIC_KEY_BYTES);
  if (held === null) return { lines: [], names: new Map() };
  const lines = await staffLog(entries, worldKeyCrypto(kit, { publicKey: held.publicKey, pkcs8: held.pkcs8 }));
  const names = new Map<string, string>();
  for (const space of new Set(lines.map((line) => line.school))) {
    for (const one of school.teachers)
      names.set(`${space}:${await assignmentId(space, one.id, kit.mac)}`, personName(one));
  }
  return { lines, names };
}

function lineText(t: Words, line: StaffLine, names: ReadonlyMap<string, string>): string {
  const of = 'assignment' in line ? names.get(`${line.school}:${line.assignment}`) : undefined;
  const name = 'assignment' in line ? isolate(of ?? t('demo.ownLog.someone')) : '';
  switch (line.kind) {
    case 'key-started':
      return t('demo.ownLog.line.keyStarted');
    case 'key-taken':
      return t('demo.ownLog.line.keyTaken');
    case 'key-admitted':
      return t('demo.ownLog.line.keyAdmitted');
    case 'recovery-made':
      return t('demo.ownLog.line.recoveryMade');
    case 'recovery-renewed':
      return t('demo.ownLog.line.recoveryRenewed');
    case 'absences-on':
      return t('demo.ownLog.line.absencesOn');
    case 'absences-off':
      return t('demo.ownLog.line.absencesOff');
    case 'holders-added':
      return t('demo.ownLog.line.holdersAdded', { number: line.count });
    case 'holders-removed':
      return t('demo.ownLog.line.holdersRemoved', { number: line.count });
    case 'code-issued':
      return t('demo.ownLog.line.codeIssued', { name });
    case 'code-replaced':
      return t('demo.ownLog.line.codeReplaced', { name });
    case 'code-reissued':
      return t('demo.ownLog.line.codeReissued', { name });
    case 'key-issued':
      return t('demo.ownLog.line.keyIssued', { name, number: line.number });
    case 'key-replaced':
      return t('demo.ownLog.line.keyReplaced', { name, number: line.number });
  }
}

/** The role's own log in the world. */
export function OwnLog({ world, school, role, kit, dayText }: OwnLogProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const entries = world.book.entries;
  const [log, setLog] = useState<Log | 'failed' | null>(null);
  useEffect(() => {
    if (role !== 'director') return;
    let open = true;
    workedOut(entries, school, kit).then(
      (one) => open && setLog(one),
      () => open && setLog('failed'),
    );
    return () => {
      open = false;
    };
  }, [role, entries, school, kit]);
  const { lines, names } = log === null || log === 'failed' ? { lines: [], names: new Map<string, string>() } : log;
  return (
    <View testID="own-log" style={styles.page}>
      <Text style={[styles.small, align]}>{t('demo.ownLog.lead')}</Text>
      <View accessibilityLiveRegion="polite" style={styles.page}>
        {role === 'director' && log === 'failed' ? (
          <Text testID="own-log-failed" accessibilityRole="alert" style={[styles.problem, align]}>
            {t('demo.problem.device')}
          </Text>
        ) : role === 'director' && log === null ? (
          <Text style={[styles.small, align]}>{t('demo.ownLog.opening')}</Text>
        ) : lines.length === 0 ? (
          <Text testID="own-log-none" style={[styles.small, align]}>
            {t(role === 'director' ? 'demo.ownLog.none' : 'demo.ownLog.preparer')}
          </Text>
        ) : (
          <View style={styles.rows}>
            {lines.map((line, at) => (
              <Text key={at} testID={`own-log-row-${at}`} style={[styles.row, align]}>
                {`${dayText(line.day)} · ${lineText(t, line, names)}`}
              </Text>
            ))}
          </View>
        )}
      </View>
      <Text style={[styles.small, align]}>{t('demo.ownLog.rule')}</Text>
      <Text style={[styles.small, align]}>{t('demo.ownLog.days')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  rows: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  row: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
