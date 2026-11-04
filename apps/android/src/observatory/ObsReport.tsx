// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's Reports page, Obs-Report (#627, §1.6, §8.4, answer 680):
// the latest term the world's date has reached, from use-term-figures.ts.
// Before any has, it says so; while the term's collection is open on another
// device, and while its figures are formed, it says so, in one live region with
// reading and every other such word, with a way to read again from any term,
// which stays in place so a press keeps its focus. It lists the term's packs as
// the server gives them, never one it left out, chosen by grade, subject and
// release, its ID added where two would read alike, and shows one at a time:
// the counts of classes, teachers, schools and wilayas shown, and that the
// sample chose itself and describes the plan; how many classes were set aside,
// when any were; and the cards (ObsReportCards.tsx). A wilaya the server hides
// is not named or counted, and the page says only that such wilayas are not
// shown. A problem is said as an alert.

import type { CountryProfile, PlanPack, SchoolYear } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { termName } from '../director/dashboard-text';
import { subjectName } from '../extra/extra-rules';
import { worldRequest } from '../network/world-network';
import { gradeName } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { formatFigure } from '../text/figures';
import { currentLanguage } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { PackHeading } from './figures-read';
import { obsStyles as styles } from './obs-styles';
import { ChangedCard, MedianCard, ReachedCard } from './ObsReportCards';
import { reportRows } from './report-figures';
import { useTermFigures } from './use-term-figures';

export type ObsReportProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date' | 'starter'>;
  /** The world's school year, whose terms its date is read against. */
  readonly year: SchoolYear;
  /** The reference data, which names grades and subjects and holds the packs the app has. */
  readonly reference: { readonly profile: CountryProfile; readonly packs: readonly PlanPack[] };
  readonly send?: Send;
};

/** The observatory's report on the latest ended term, one pack at a time. */
export function ObsReport({ world, year, reference, send = worldRequest }: ObsReportProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const report = useTermFigures(world, year, send);
  const { term, state, packs, at, figures, problem } = report;
  const count = (value: number) => formatFigure(value, currentLanguage());
  const heading = ({ grade, subject, release }: PackHeading) =>
    `${gradeName(reference.profile, grade)} · ${subjectName(reference.profile, subject)} · ${isolate(release)}`;
  const label = (pack: PackHeading) => {
    const alike = packs.filter((one) => heading(one) === heading(pack)).length > 1;
    return alike ? `${heading(pack)} · ${isolate(pack.pack)}` : heading(pack);
  };
  const nation = figures?.nation ?? null;
  const held = figures && reference.packs.find((one) => one.id === figures.pack && one.release === figures.release);
  const rows = nation === null ? [] : reportRows(nation, held);
  const reading = state === 'reading' || (state === 'ready' && figures === undefined && problem === null);
  const status = reading
    ? 'reading'
    : state === 'none' || state === 'waiting' || state === 'forming' || state === 'empty'
      ? state
      : figures !== undefined && nation === null
        ? 'noNation'
        : null;
  return (
    <View testID="obs-report" style={styles.page}>
      {term !== null && (
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.obsReport.heading', { term: termName(t, term.term) })}
        </Text>
      )}
      <Text
        testID="obs-report-status"
        accessibilityLiveRegion="polite"
        role="status"
        style={[styles.body, status === null && styles.quiet, align]}
      >
        {status === null ? '' : t(`demo.obsReport.${status}`)}
      </Text>
      {state === 'ready' && (
        <ChipGroup
          testID="obs-report-pack"
          label={t('demo.obsReport.pack')}
          choices={packs.map((pack, place) => ({ value: String(place), label: label(pack) }))}
          selected={String(at)}
          onSelect={(place) => report.choose(Number(place))}
        />
      )}
      {problem !== null && (
        <Text testID="obs-report-problem" accessibilityRole="alert" style={[styles.problem, align]}>
          {t(problem)}
        </Text>
      )}
      {term !== null && (
        <Button testID="obs-report-again" variant="line" label={t('demo.obsReport.again')} onPress={report.again} />
      )}
      {figures !== undefined && nation !== null && (
        <View testID="obs-report-figures" style={styles.page}>
          <Text testID="obs-report-counts" style={[styles.body, align]}>
            {t('demo.obsReport.counts', {
              classes: count(nation.classes),
              teachers: count(nation.teachers),
              schools: count(nation.schools),
              wilayas: count(figures.wilayas.length),
            })}
          </Text>
          <Text style={[styles.small, align]}>{t('demo.obsReport.chosen')}</Text>
          <Text style={[styles.small, align]}>{t('demo.obsReport.hidden')}</Text>
          {figures.setAside !== null && figures.setAside > 0 && (
            <Text testID="obs-report-aside" style={[styles.small, align]}>
              {t('demo.obsReport.setAside', { classes: count(figures.setAside) })}
            </Text>
          )}
          <MedianCard rows={rows} />
          <ChangedCard rows={rows} />
          <ReachedCard figure={nation} />
        </View>
      )}
    </View>
  );
}
