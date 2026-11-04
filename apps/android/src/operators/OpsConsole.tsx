// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ops-Console's system map, the operators' first page in a national demo
// world (#618, §6.7, answer 655), under the workspace's title: the demo
// server, the world's date and what the map shows, and that it is drawn only
// from what the server says of itself; on the PC, the legend, a solid line
// passing and a faint struck one closed, with no key in any box, and React
// Flow's read-only map (ops-map.ts); on every device its boxes and lines
// written out, each a button that opens its panel beside them, the batch store
// at first; and the system's state: the server's version against the one
// published with this app, the fingerprint of its built code, whether the
// database answers or the worlds are in memory, whether backups are kept, and
// while they are, whether archiving works and the last restore test, that
// installing with no internet waits for a real deployment, and the 7 days for
// security fixes. Reading is said, and a problem in the world's words with a
// way to read again.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDrawing } from '../drawing/drawing-kit';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { opsMap, type OpsId, type OpsItem } from './ops-map';
import { OpsReading } from './OpsReading';
import { opsStyles } from './ops-styles';
import { fingerprintText, SERVER_RELEASE, type SystemView } from './ops-system';
import { useOpsSystem } from './use-ops-system';

type StateLine =
  | 'memory'
  | 'failing'
  | 'archiveUnknown'
  | 'answering'
  | 'archiveOn'
  | 'archiveOff'
  | 'archivingOk'
  | 'archivingFailing'
  | 'archivingWaiting'
  | 'restorePassed'
  | 'restoreFailed'
  | 'restoreNone'
  | 'offline'
  | 'fixes';

export type OpsConsoleProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly send?: Send;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

const ARCHIVING = { ok: 'archivingOk', failing: 'archivingFailing', waiting: 'archivingWaiting' } as const;
const RESTORE = { passed: 'restorePassed', failed: 'restoreFailed' } as const;

/** What the server says of its backups' archiving and restore tests; an older server says neither. */
function backupLines(view: Extract<SystemView, { archive: 'on' }>): readonly StateLine[] {
  const { archiving, restore } = view;
  return [
    ...(archiving === undefined ? [] : [ARCHIVING[archiving]]),
    ...(restore === undefined ? [] : [restore === null ? ('restoreNone' as const) : RESTORE[restore.result]]),
  ];
}

/** The state's lines about storage and backups, in the catalogue's keys, then the two that always show. */
function stateLines(view: SystemView): readonly StateLine[] {
  const storage: readonly StateLine[] =
    view.storage === 'memory'
      ? ['memory']
      : view.database === 'failing'
        ? ['failing', 'archiveUnknown']
        : view.archive === 'on'
          ? ['answering', 'archiveOn', ...backupLines(view)]
          : ['answering', 'archiveOff'];
  return [...storage, 'offline', 'fixes'];
}

/** The last restore test's day, written out, for the lines that say it. */
const restoreDay = (view: SystemView, dayText: (day: Day) => string) => {
  const restore =
    view.storage === 'postgresql' && view.database === 'ok' && view.archive === 'on' ? view.restore : null;
  return restore === null || restore === undefined ? '' : isolate(dayText(restore.day));
};

/** The operators' map of the demo server and its state. */
export function OpsConsole({ world, send, dayText }: OpsConsoleProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const drawing = useDrawing();
  const page = useOpsSystem(world, send);
  const [chosen, setChosen] = useState<OpsId>('relay');
  const view = page.view;
  const map = view === null ? null : opsMap(t, view, direction === 'rtl');
  const items = map === null ? [] : [...map.boxes, ...map.lines];
  const shown = items.find((one) => one.id === chosen) ?? items[0];
  const group = (id: 'boxes' | 'lines', list: readonly OpsItem[]) => (
    <View testID={`ops-group-${id}`} style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t(`demo.ops.${id}`)}
      </Text>
      {list.map((one) => (
        <Pressable
          key={one.id}
          testID={`ops-item-${one.id}`}
          accessibilityRole="button"
          {...(onPc()
            ? ({ 'aria-current': shown?.id === one.id ? 'true' : undefined } as object)
            : { accessibilityState: { selected: shown?.id === one.id } })}
          onPress={() => setChosen(one.id)}
          style={[styles.box, shown?.id === one.id && styles.chosen]}
        >
          <Text style={[styles.label, align]}>{one.label}</Text>
          {one.sub !== undefined && <Text style={[styles.value, align]}>{one.sub}</Text>}
        </Pressable>
      ))}
    </View>
  );
  return (
    <View testID="ops-console" style={styles.page}>
      <Text style={[styles.small, align]}>{t('demo.ops.lead', { date: dayText(world.date) })}</Text>
      <Text style={[styles.body, align]}>{t('demo.ops.only')}</Text>
      {drawing !== null && (
        <View testID="ops-legend" style={styles.legend}>
          <View style={styles.key}>
            <View style={[styles.stroke, styles.solid]} />
            <Text style={[styles.small, align]}>{t('demo.ops.passes')}</Text>
          </View>
          <View style={styles.key}>
            <View style={[styles.stroke, styles.dotted]} />
            <Text style={[styles.small, align]}>{t('demo.ops.closed')}</Text>
          </View>
          <Text style={[styles.small, align]}>{t('demo.ops.noKey')}</Text>
        </View>
      )}
      <OpsReading reading={page.reading} problem={page.problem} onAgain={page.reload} testID="ops" />
      {map !== null && view !== null && shown !== undefined && (
        <View style={onPc() ? styles.columns : styles.page}>
          <View style={onPc() ? styles.main : styles.page}>
            {drawing !== null && <drawing.Map testID="ops-map" spec={map.spec} />}
            {group('boxes', map.boxes)}
            {group('lines', map.lines)}
          </View>
          <View style={[styles.page, onPc() && styles.side]}>
            <View testID="ops-panel" accessibilityLiveRegion="polite" style={styles.card}>
              <Text style={[styles.small, align]}>{t('demo.ops.chosen')}</Text>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {shown.label}
              </Text>
              {shown.rows.map((row) => (
                <View key={row.key} style={styles.fact}>
                  <Text style={[styles.factLabel, align]}>{row.label}</Text>
                  <Text style={[styles.value, styles.factValue, align]}>{row.value}</Text>
                </View>
              ))}
              {shown.note !== undefined && <Text style={[styles.small, align]}>{shown.note}</Text>}
            </View>
            <View testID="ops-state" style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t('demo.ops.state.title')}
              </Text>
              <Text style={[styles.label, align]}>
                {t('demo.ops.state.version', { version: isolate(view.version) })}
              </Text>
              <Text testID="ops-release" style={[styles.value, align]}>
                {view.version === SERVER_RELEASE
                  ? t('demo.ops.state.matches')
                  : t('demo.ops.state.differs', { release: isolate(SERVER_RELEASE) })}
              </Text>
              <Text style={[styles.value, align]}>
                {view.fingerprint === null ? t('demo.ops.state.noFingerprint') : t('demo.ops.state.fingerprint')}
              </Text>
              {view.fingerprint !== null && (
                <Text testID="ops-fingerprint" selectable style={[styles.code, styles.ltr]}>
                  {fingerprintText(view.fingerprint)}
                </Text>
              )}
              {stateLines(view).map((line) => (
                <Text key={line} testID={`ops-state-${line}`} style={[styles.value, align]}>
                  {t(`demo.ops.state.${line}`, { day: restoreDay(view, dayText) })}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const own = StyleSheet.create({
  columns: { flexDirection: 'row', gap: spacing['space-16'], alignItems: 'flex-start' },
  main: { flex: 2, minWidth: 0, gap: spacing['space-12'] },
  side: { flex: 1, minWidth: 0 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-16'] },
  key: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  stroke: { width: 28, borderTopWidth: 2, borderColor: colors.ink2 },
  solid: { borderStyle: 'solid' },
  dotted: { borderStyle: 'dotted', borderColor: colors.line },
  fact: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  factLabel: { ...typography.small, color: colors.ink, minWidth: 72, flexShrink: 0 },
  factValue: { flexGrow: 1, flexBasis: 160 },
  box: {
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-8'],
    borderRadius: radius['radius-card'],
  },
  chosen: { backgroundColor: colors.well, borderStartWidth: 4, borderStartColor: colors.ink },
  label: { ...typography.label, color: colors.ink },
  code: { ...typography['body-latin'], color: colors.ink },
  ltr: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' },
});
const styles = { ...opsStyles, ...own };
