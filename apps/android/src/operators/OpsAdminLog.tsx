// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' admin log page in a national demo world (#619, §6.7, R-6.7-09,
// answer 656): what it is, by day and never a clock time or a name, since the
// demo's operator is a role, while a real deployment logs each action under its
// named, two-factor administrator, administered from Algeria only (choice D11);
// that it keeps 12 months at most with a database and is lost when the server
// stops with the worlds in memory, and shows the newest 200 lines; and the
// lines under their heading, newest first, each its day and what was done: the
// server started with its version and the changes it applied to the database,
// worlds erased on their 7th day, counted, a problem report marked fixed, by
// the start of its ID, a restore test of the backups passed or the step that
// failed, or an action this app does not read.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { readAdminLog, type AdminLine } from './ops-logs';
import { OpsReading } from './OpsReading';
import { opsStyles as styles } from './ops-styles';
import { useOpsRead } from './use-ops-read';

export type OpsAdminLogProps = {
  readonly world: Pick<OpenWorld, 'world'>;
  readonly send?: Send;
  /** A day written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

/** The admin log of the demo server. */
export function OpsAdminLog({ world, send = worldRequest, dayText }: OpsAdminLogProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const page = useOpsRead(() => readAdminLog(world.world, send));
  const said = (line: AdminLine) => {
    if (line.action === 'server.started')
      return line.migrations.length === 0
        ? t('demo.ops.admin.started', { version: isolate(line.version) })
        : t('demo.ops.admin.startedMigrations', {
            version: isolate(line.version),
            migrations: line.migrations.map(isolate).join(t('demo.ops.admin.joiner')),
          });
    if (line.action === 'worlds.erased') return t('demo.ops.admin.erased', { count: line.count });
    if (line.action === 'problem.fixed') return t('demo.ops.admin.fixed', { id: isolate(line.problem.slice(0, 8)) });
    if (line.action === 'restore.tested') return t(`demo.ops.admin.restore.${line.outcome}`);
    return t('demo.ops.admin.other');
  };
  return (
    <View testID="ops-admin" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.ops.admin.lead')}</Text>
      <Text style={[styles.small, align]}>{t('demo.ops.admin.named')}</Text>
      <Text style={[styles.small, align]}>{t('demo.ops.admin.kept')}</Text>
      <OpsReading reading={page.reading} problem={page.problem} onAgain={page.reload} testID="ops-admin" />
      {page.value !== null && (
        <View testID="ops-admin-lines" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.ops.admin.lines')}
          </Text>
          {page.value.length === 0 && <Text style={[styles.value, align]}>{t('demo.ops.admin.none')}</Text>}
          {page.value.map((line, index) => (
            <View key={index} style={styles.row}>
              <Text style={[styles.body, align]}>{said(line)}</Text>
              <Text style={[styles.value, align]}>{dayText(line.day)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
