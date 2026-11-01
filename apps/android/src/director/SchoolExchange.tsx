// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Exchange, what the school exchanges, in a national demo world (#592, §7.5,
// §7.11, R-3.4-05, R-7.5-18, R-7.12-02, answer 620), under the workspace's
// title: the school, the world's date and what the page shows; that everything
// leaving the school is on the map and nothing else, and how many lines pass
// between the school and outside; on the PC, the legend, a solid line passing
// always, a dashed one on a condition and a faint dotted one not passing now,
// and React Flow's read-only map (exchange-map.ts); on every device its boxes
// and lines written out, each a button that opens its panel beside them, the
// school's space at first, said as it changes as D-Keys' is, and from the
// school's space a link to the keys page; that the map is read and its one
// choice is sending absences; and the choice itself, a switch off until the
// director turns it on, kept under the school's space and so waiting for the
// school key on this device, with what it means and that it goes into the
// school's log by its date, never the time (use-exchange-page.ts); turning it
// opens the absences line's panel, and a choice not kept is said under it.
// Reading the stand-in's receipts is said, a problem in the world's words with
// a way to read again.

import type { Day, DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { Switch } from '../components/Switch';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDrawing } from '../drawing/drawing-kit';
import { onPc, useDeviceText } from '../text/device-text';
import { personName } from './dashboard-text';
import { exchangeMap, type ExchangeId, type ExchangeItem } from './exchange-map';
import { useExchangePage } from './use-exchange-page';

export type SchoolExchangeProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly send?: Send;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  /** Opens the keys page, which says who holds the school key. */
  readonly onKeys?: () => void;
};

/** The director's map of what enters and leaves the school. */
export function SchoolExchange({ world, school, send, dayText, onKeys }: SchoolExchangeProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const drawing = useDrawing();
  const page = useExchangePage(world, dayText, send);
  const [chosen, setChosen] = useState<ExchangeId>('space');
  const map = exchangeMap(
    t,
    { teachers: school.teachers.length, absences: page.absences, received: page.received },
    direction === 'rtl',
  );
  const items = [...map.boxes, ...map.lines];
  const shown = items.find((one) => one.id === chosen) ?? items.find((one) => one.id === 'space')!;
  const group = (id: 'boxes' | 'lines', list: readonly ExchangeItem[]) => (
    <View testID={`exchange-group-${id}`} style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t(`demo.exchange.${id}`)}
      </Text>
      {list.map((one) => (
        <Pressable
          key={one.id}
          testID={`exchange-item-${one.id}`}
          accessibilityRole="button"
          {...(onPc()
            ? ({ 'aria-current': shown.id === one.id ? 'true' : undefined } as object)
            : { accessibilityState: { selected: shown.id === one.id } })}
          onPress={() => setChosen(one.id)}
          style={[styles.box, shown.id === one.id && styles.chosen]}
        >
          <Text style={[styles.label, align]}>{one.label}</Text>
          {one.sub !== undefined && <Text style={[styles.value, align]}>{one.sub}</Text>}
        </Pressable>
      ))}
    </View>
  );
  return (
    <View testID="school-exchange" style={styles.page}>
      <Text style={[styles.small, align]}>
        {t('demo.exchange.lead', { school: personName(school), date: dayText(world.date) })}
      </Text>
      <Text style={[styles.body, align]}>{t('demo.exchange.only')}</Text>
      <Text testID="exchange-count" style={[styles.small, align]}>
        {t('demo.exchange.count', { count: map.crossing })}
      </Text>
      {drawing !== null && (
        <View testID="exchange-legend" style={styles.legend}>
          <View style={styles.key}>
            <View style={[styles.stroke, styles.solid]} />
            <Text style={[styles.small, align]}>{t('demo.exchange.always')}</Text>
          </View>
          <View style={styles.key}>
            <View style={[styles.stroke, styles.dashed]} />
            <Text style={[styles.small, align]}>{t('demo.exchange.conditional')}</Text>
          </View>
          <View style={styles.key}>
            <View style={[styles.stroke, styles.dotted]} />
            <Text style={[styles.small, align]}>{t('demo.exchange.idle')}</Text>
          </View>
        </View>
      )}
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {page.reading ? t('demo.exchange.opening') : ''}
      </Text>
      {page.problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(page.problem)}
          </Text>
          <Button testID="exchange-again" variant="line" label={t('demo.exchange.again')} onPress={page.reload} />
        </View>
      )}
      <View style={onPc() ? styles.columns : styles.page}>
        <View style={onPc() ? styles.main : styles.page}>
          {drawing !== null && <drawing.Map testID="exchange-map" spec={map.spec} />}
          <Text style={[styles.small, align]}>{t('demo.exchange.readOnly')}</Text>
          {group('boxes', map.boxes)}
          {group('lines', map.lines)}
        </View>
        <View testID="exchange-panel" accessibilityLiveRegion="polite" style={[styles.card, onPc() && styles.side]}>
          <Text style={[styles.small, align]}>{t('demo.exchange.chosen')}</Text>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {shown.label}
          </Text>
          {shown.rows.map((row) => (
            <View key={row.label} style={styles.fact}>
              <Text style={[styles.factLabel, align]}>{row.label}</Text>
              <Text style={[styles.value, styles.factValue, align]}>{row.value}</Text>
            </View>
          ))}
          <Text style={[styles.small, align]}>{shown.note}</Text>
          {shown.id === 'space' && onKeys !== undefined && (
            <RowLink
              testID="exchange-keys"
              icon={controlIcon('lock')}
              title={t('demo.exchange.keysLink')}
              onPress={onKeys}
            />
          )}
        </View>
      </View>
      <View testID="exchange-choice" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.exchange.choice')}
        </Text>
        <Switch
          testID="exchange-absences"
          label={t('demo.exchange.absences')}
          value={page.absences}
          disabled={page.school === null}
          onValueChange={(on) => {
            setChosen('absences');
            page.choose(on);
          }}
        />
        <Text accessibilityLiveRegion="polite" style={[styles.value, align]}>
          {t(
            page.school === null
              ? 'demo.exchange.noKey'
              : page.absences
                ? 'demo.exchange.absencesOn'
                : 'demo.exchange.absencesOff',
          )}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.exchange.absencesRule')}</Text>
        {page.failed !== null && (
          <Text testID="exchange-not-kept" accessibilityRole="alert" style={[styles.problem, align]}>
            {t(page.failed)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  columns: { flexDirection: 'row', gap: spacing['space-16'], alignItems: 'flex-start' },
  main: { flex: 2, minWidth: 0, gap: spacing['space-12'] },
  side: { flex: 1, minWidth: 0 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-16'] },
  key: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  stroke: { width: 28, borderTopWidth: 2, borderColor: colors.ink2 },
  solid: { borderStyle: 'solid' },
  dashed: { borderStyle: 'dashed' },
  dotted: { borderStyle: 'dotted', borderColor: colors.line },
  fact: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  factLabel: { ...typography.small, color: colors.ink, minWidth: 72, flexShrink: 0 },
  factValue: { flexGrow: 1, flexBasis: 160 },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-4'],
  },
  box: {
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-8'],
    borderRadius: radius['radius-card'],
  },
  chosen: { backgroundColor: colors.well, borderStartWidth: 4, borderStartColor: colors.ink },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  value: { ...typography.small, color: colors.ink2 },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
