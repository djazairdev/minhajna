// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Term-send's marks (#591, R-3.7-09, answer 619): the checks before signing,
// each a line with its tick, or a cross when it fails, the marks complete with
// the parts' names, pupils with a mark or an absence for every part of how
// many, the averages by the official formula, named by its ID, with the
// assessment data's release, or continuous assessment alone without one, and
// the list as the sector's system gives it with its count; then the first rows
// in the official list's order, each pupil one element, its name in the page's
// language, its marks as the book shows them or absent, and its average, with
// how many more pupils follow; then the comparison of the export about to be
// signed with the marks shown, how many of how many match, a mismatch said as
// stopping the signature.

import { shownMark, type SentMark } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Facts } from '../components/Facts';
import { colors, radius, spacing, typography } from '../design/tokens';
import { personName } from '../director/dashboard-text';
import { partName } from '../marks/export-rules';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { termComplete, type TermSheet } from './term-send-session';

/** How many rows are shown before the line saying how many more follow. */
const SHOWN = 3;

export type TermSendMarksProps = {
  readonly sheet: Extract<TermSheet, { kind: 'marks' }>;
  readonly matches: { readonly matched: number; readonly total: number };
};

/** The checks, the first rows and the comparison before signing. */
export function TermSendMarks({ sheet, matches }: TermSendMarksProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { marks, room, formula, release } = sheet;
  const value = (one: SentMark | undefined) =>
    one === undefined ? '—' : one === 'absent' ? t('marks.export.absent') : shownMark(one);
  const done = termComplete(marks);
  const parts = marks.parts.map((part) => partName(t, part)).join(t('marks.export.and'));
  const pupils = t('demo.termSend.pupils', { count: marks.rows.length });
  const names = new Map(
    room.pupils.map((one) => [one.id, personName({ ...one, latinName: one.latinName ?? one.name })]),
  );
  const facts = [
    { text: t('demo.termSend.complete', { parts, done, total: marks.rows.length }), kept: done === marks.rows.length },
    {
      text:
        formula === null
          ? t('marks.export.noAverage')
          : t('demo.termSend.formula', { formula: isolate(formula.id), release: isolate(release) }),
      kept: true,
    },
    { text: t('demo.termSend.list', { pupils }), kept: true },
  ];
  const matched = matches.matched === matches.total;
  return (
    <View style={styles.list}>
      <Facts
        kept={facts.map((fact, at) => ({ id: String(at), ...fact }))}
        keptLabel={t('demo.termSend.checked')}
        notKeptLabel={t('demo.termSend.unchecked')}
      />
      <View testID="term-send-rows" style={styles.card}>
        <Text style={[styles.small, align]}>{t('demo.termSend.order')}</Text>
        {marks.rows.slice(0, SHOWN).map((row) => {
          const cells = [
            ...marks.parts.map((part) => `${partName(t, part)} ${value(row.values[part])}`),
            ...(formula === null ? [] : [`${t('demo.termSend.average')} ${value(row.average ?? undefined)}`]),
          ];
          const name = isolate(names.get(row.pupilId) ?? row.registration);
          return (
            <View
              key={row.pupilId}
              testID={`term-send-row-${row.registration}`}
              accessible
              accessibilityLabel={[name, ...cells].join(t('marks.book.comma'))}
              style={styles.row}
            >
              <Text style={[styles.body, align]}>{name}</Text>
              <Text style={[styles.small, align]}>{cells.join(' · ')}</Text>
            </View>
          );
        })}
        {marks.rows.length > SHOWN && (
          <Text style={[styles.small, align]}>{t('demo.termSend.others', { count: marks.rows.length - SHOWN })}</Text>
        )}
      </View>
      <View testID="term-send-compare" style={styles.card}>
        <Text style={[styles.head, align]}>{t('demo.termSend.compare')}</Text>
        <Text style={[styles.body, align]}>{t('demo.termSend.matches', matches)}</Text>
        {!matched && <Text style={[styles.problem, align]}>{t('demo.termSend.mismatch')}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing['space-12'] },
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
