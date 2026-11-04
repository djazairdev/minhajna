// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' security logs page in a national demo world (#619, §6.7,
// R-6.7-10, answer 656): what was refused, counted by day; that they are kept
// apart from everything else, in memory alone and never in the database or its
// backups, for the days the server says and lost when it stops, while a real
// deployment keeps them for the shortest time the law allows; that they are
// counts only, with no address, world or time, so they never measure or judge a
// teacher; and each day, newest first, with each kind of refusal and its count,
// read as one on a phone, and the kinds this app does not know counted together
// when there are any, or that nothing was refused.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { onPc, useDeviceText } from '../text/device-text';
import { readSecurity, SECURITY_KINDS, type SecurityDay } from './ops-logs';
import { OpsReading } from './OpsReading';
import { opsStyles as styles } from './ops-styles';
import { useOpsRead } from './use-ops-read';

export type OpsSecurityProps = {
  readonly world: Pick<OpenWorld, 'world'>;
  readonly send?: Send;
  /** A day written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

/** The security logs of the demo server. */
export function OpsSecurity({ world, send = worldRequest, dayText }: OpsSecurityProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const page = useOpsRead(() => readSecurity(world.world, send));
  const rows = (day: SecurityDay): (readonly [string, string, number])[] => [
    ...SECURITY_KINDS.map((kind) => [kind, t(`demo.ops.security.kind.${kind}`), day.counts[kind]] as const),
    ...(day.others > 0 ? [['others', t('demo.ops.security.others'), day.others] as const] : []),
  ];
  return (
    <View testID="ops-security" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.ops.security.lead')}</Text>
      <Text style={[styles.small, align]}>{t('demo.ops.security.apart')}</Text>
      {page.value !== null && (
        <Text testID="ops-security-kept" style={[styles.small, align]}>
          {t('demo.ops.security.kept', { count: page.value.keptDays })}
        </Text>
      )}
      <Text style={[styles.small, align]}>{t('demo.ops.security.never')}</Text>
      <OpsReading reading={page.reading} problem={page.problem} onAgain={page.reload} testID="ops-security" />
      {page.value?.days.length === 0 && (
        <Text testID="ops-security-none" style={[styles.value, align]}>
          {t('demo.ops.security.none')}
        </Text>
      )}
      {page.value?.days.map((day) => (
        <View key={day.day} testID={`ops-security-${day.day}`} style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {dayText(day.day)}
          </Text>
          {rows(day).map(([key, label, count]) => (
            <View
              key={key}
              testID={`ops-security-${day.day}-${key}`}
              accessible={!onPc()}
              accessibilityLabel={onPc() ? undefined : t('demo.ops.security.row', { kind: label, count })}
              style={styles.row}
            >
              <Text style={[styles.value, align]}>{label}</Text>
              <Text style={styles.figure}>{count}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
