// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Totals, the directorate's totals page in a national demo world (#598, §7.9,
// R-7.9-05 to R-7.9-08, answer 629), in the frame it shares with N-Totals
// (TotalsFrame.tsx): its header names the directorate, its wilaya, the day
// chosen and its term; what the system owes teachers is a row for each subject
// the directorate holds and one over every subject (OwedTable.tsx), with where
// the sessions lost come from; and the curriculum report (CurriculumReport.tsx)
// names its items by the packs the directorate's seeded classes pin in the
// bundled reference data, which their shares are worked out from. The last
// words say the server shows only figures above the floors, though in the demo
// it sees each share.

import type { Day, DemoSchool, SchoolCalendar } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { termName } from '../director/dashboard-text';
import { seededWorld } from '../director/director-world';
import { colors, typography } from '../design/tokens';
import type { ReferenceResult } from '../reference';
import { useDeviceText } from '../text/device-text';
import { CurriculumReport } from './CurriculumReport';
import { itemNames } from './item-names';
import { OwedTable, subjectRows } from './OwedTable';
import { TotalsFrame } from './TotalsFrame';
import { useDirectorateTotals } from './use-totals';

export type DirectorateTotalsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  /** The school whose directorate this is, as the world seeds it. */
  readonly school: Pick<DemoSchool, 'directorateId'>;
  /** The wilaya's name in the interface's language. */
  readonly wilaya: string;
  /** The world's calendar and the bundled one, whose announced days the shares are sent for. */
  readonly calendars: readonly SchoolCalendar[];
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** A subject's name in the interface's language. */
  readonly subjectName: (code: string) => string;
  /** The bundled reference data, whose packs the seeded classes pin and name the report's items. */
  readonly bundled: Extract<ReferenceResult, { ok: true }>;
};

/** The directorate's totals for the announced days the world's date reached. */
export function DirectorateTotals(props: DirectorateTotalsProps) {
  const { world, school, wilaya, calendars, send, dayText, subjectName, bundled } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const directorate = school.directorateId;
  const view = useDirectorateTotals(world, calendars, directorate, send);
  const names = useMemo(() => {
    const schools = seededWorld(world.world, bundled).schools.filter((one) => one.directorateId === directorate);
    return itemNames(schools, bundled.packs);
  }, [world.world, bundled, directorate]);
  return (
    <TotalsFrame
      testID="directorate-totals"
      view={view}
      lead={t('demo.totals.lead')}
      header={({ day, term }) =>
        t('demo.totals.header', {
          wilaya,
          day: dayText(day),
          term: termName(t, term.number),
          from: dayText(term.from),
          to: dayText(term.to),
        })
      }
      never={t('demo.totals.never')}
      dayText={dayText}
      owed={(figures) => (
        <>
          <Text style={[styles.body, align]}>{t('demo.totals.owedLead')}</Text>
          <OwedTable
            rows={subjectRows(figures, subjectName, t('demo.totals.all'))}
            first={t('demo.totals.column.subject')}
            testID="owed-row"
          />
          <Text style={[styles.body, align]}>{t('demo.totals.closures')}</Text>
        </>
      )}
      report={(figures) => (
        <>
          <Text style={[styles.body, align]}>{t('demo.totals.reportLead')}</Text>
          <CurriculumReport figures={figures} subject={subjectName} names={names} />
        </>
      )}
    />
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.ink2 },
});
