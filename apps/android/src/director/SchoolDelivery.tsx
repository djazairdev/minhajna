// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's delivery report page in a demo world (#589, D-Report, §7.5,
// §7.7, R-7.5-08, R-7.6-11, R-7.7-02, R-7.7-07, answer 617): the term chips
// when several terms have begun, the one holding the world's date first;
// whether the term closed or counts to the world's date; the level chips when
// the school has several levels, in the words of the school's level and in
// order of their numbers, a class whose name starts with no number under other
// classes; each course a row with its figures, named by its class and subject,
// and by its teacher too when another teacher's course has the same class and
// subject, opening the course (DeliveryDetail.tsx); and the lines that each
// class has its own figures with no total or ranking, that «other» gathers what
// the calendar does not hold with no reasons, that the report never evaluates
// anyone nor sets pay, and that a world prints none of it. The school's
// calendar is always the world's; a problem reading is shown, said and read
// again once however quickly pressed twice.

import { compareDays, type Day, type DemoSchool, type SchoolYear, type TimetablePart } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import type { MineCalendar } from '../week/school-mine-session';
import {
  levelOf,
  readDelivery,
  termFirst,
  termReport,
  termsBegun,
  type CourseReport,
  type DeliveryDesk,
} from './delivery-session';
import { DeliveryDetail } from './DeliveryDetail';

export type SchoolDeliveryProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly year: SchoolYear;
  /** The school's calendar, the world's own. */
  readonly mine: MineCalendar;
  /** The bells of the school's level, which split each day into its half-days. */
  readonly bells: TimetablePart['bells'];
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
};

const FOOT = ['classes', 'other', 'never', 'print'] as const;
const OTHER = 'other';

/** A row's level chip: the number its class's name starts with, or other classes. */
const levelKey = (name: string) => String(levelOf(name) ?? OTHER);

/** The levels in order of their numbers, other classes last. */
const byLevel = (a: string, b: string) =>
  (a === OTHER ? Infinity : Number(a)) - (b === OTHER ? Infinity : Number(b)) || a.localeCompare(b);

/** The school's term report: each teacher's course, its sessions confirmed, held and not held, by level. */
export function SchoolDelivery({ world, school, year, mine, bells, kit, send, dayText }: SchoolDeliveryProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [desk, setDesk] = useState<DeliveryDesk | null>(null);
  const [reading, setReading] = useState(true);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [said, setSaid] = useState('');
  const [termNumber, setTerm] = useState<number | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const mounted = useRef(true);
  const working = useRef(false);
  const read = () =>
    readDelivery(world, school, kit, send).then(
      (found) => {
        if (!mounted.current) return;
        working.current = false;
        setDesk(found);
        setReading(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        working.current = false;
        setProblem(problemOf(error));
        setReading(false);
        if (onPc()) setSaid(t(problemOf(error)));
        else AccessibilityInfo.announceForAccessibility(t(problemOf(error)));
      },
    );
  const first = useEffectEvent(() => {
    working.current = true;
    void read();
  });
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const again = () => {
    if (working.current) return;
    working.current = true;
    setReading(true);
    setProblem(null);
    setSaid('');
    void read();
  };
  const terms = termsBegun(year, world.date);
  const term = terms.find((one) => one.number === termNumber) ?? termFirst(terms, world.date);
  const rows = desk === null || term === null ? [] : termReport(desk, mine, term, world.date, bells);
  const levels = [...new Set(rows.map((one) => levelKey(one.class)))].sort(byLevel);
  const shownLevel = level !== null && levels.includes(level) ? level : (levels[0] ?? null);
  const shown = levels.length > 1 ? rows.filter((one) => levelKey(one.class) === shownLevel) : rows;
  const levelLabel = (one: string) =>
    one === OTHER ? t('demo.delivery.otherLevel') : t(`demo.delivery.level.${school.level}`, { level: one });
  const named = (one: CourseReport) => `${isolate(one.class)} · ${isolate(one.subject)}`;
  const shared = (one: CourseReport) => rows.filter((each) => named(each) === named(one)).length > 1;
  const label = (one: CourseReport) => (shared(one) ? `${named(one)} · ${isolate(one.teacher)}` : named(one));
  const closed = term !== null && compareDays(term.to, world.date) < 0;
  return (
    <View testID="delivery" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.delivery.lead')}</Text>
      <Text testID="delivery-said" accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {reading ? t('demo.weekSign.steps.reading') : said}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          <Button testID="delivery-again" variant="line" label={t('demo.weekSign.again')} onPress={again} />
        </View>
      )}
      {term === null && <Text style={[styles.body, align]}>{t('demo.delivery.noTerm')}</Text>}
      {terms.length > 1 && (
        <ChipGroup
          testID="delivery-term"
          label={t('demo.delivery.terms')}
          choices={terms.map((one) => ({
            value: String(one.number),
            label: t('demo.delivery.term', { number: one.number }),
          }))}
          selected={term === null ? null : String(term.number)}
          onSelect={(value) => {
            setTerm(Number(value));
            setOpened(null);
          }}
        />
      )}
      {term !== null && desk !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.delivery.title', { number: term.number })}
          </Text>
          <Text style={[styles.small, align]}>
            {t(closed ? 'demo.delivery.closed' : 'demo.delivery.soFar', {
              day: dayText(closed ? term.to : world.date),
            })}
          </Text>
          {levels.length > 1 && (
            <ChipGroup
              testID="delivery-level"
              label={t('demo.delivery.levels')}
              choices={levels.map((one) => ({ value: one, label: levelLabel(one) }))}
              selected={shownLevel}
              onSelect={setLevel}
            />
          )}
          {rows.length === 0 && <Text style={[styles.body, align]}>{t('demo.delivery.none')}</Text>}
          {shown.map((one) => (
            <View key={one.key} testID="delivery-row" style={styles.row}>
              <Button
                testID={`delivery-open-${one.key.replace(/\n/g, '-')}`}
                variant="plain"
                label={label(one)}
                onPress={() => setOpened(opened === one.key ? null : one.key)}
              />
              <Text style={[styles.small, align]}>
                {t('demo.delivery.figures', {
                  confirmed: one.held + one.calendar + one.other,
                  held: one.held,
                  calendar: one.calendar,
                  other: one.other,
                })}
              </Text>
              {opened === one.key && <DeliveryDetail one={one} dayText={dayText} />}
            </View>
          ))}
        </View>
      )}
      {FOOT.map((key) => (
        <Text key={key} style={[styles.small, align]}>
          {t(`demo.delivery.foot.${key}`)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  row: { gap: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
