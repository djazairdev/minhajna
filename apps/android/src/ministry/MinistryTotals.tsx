// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Totals, the Ministry's totals page in a national demo world (#599, §7.9,
// answers 539, 549 and 630), in the frame it shares with M-Totals
// (TotalsFrame.tsx): its header names the Ministry, the day chosen and its
// term; what the system owes teachers shows every subject together, or one
// subject the nation's figure shows as chosen, another day without it going
// back to every subject, with a row for each wilaya by its code and name, in
// the official order and never sorted or coloured by a figure, and one for the
// nation (wilaya-rows.ts), every figure under the wilaya floor hidden by the
// server, with where the sessions lost come from; and the curriculum report is
// the nation's, with each subject's range across the wilayas when 8 show it
// (report-range.ts), its items named by the packs every seeded class pins. The
// last words say the totals never serve an exam threshold, a ranking of wilayas
// or a decision about a teacher.

import type { Day, SchoolCalendar, Zone } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { termName } from '../director/dashboard-text';
import { seededWorld } from '../director/director-world';
import { CurriculumReport } from '../directorate/CurriculumReport';
import { itemNames } from '../directorate/item-names';
import { OwedTable } from '../directorate/OwedTable';
import { TotalsFrame } from '../directorate/TotalsFrame';
import { useMinistryTotals } from '../directorate/use-totals';
import { colors, typography } from '../design/tokens';
import type { ReferenceResult } from '../reference';
import { localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { reportRange } from './report-range';
import { wilayaRows } from './wilaya-rows';

const EVERY = '*';

export type MinistryTotalsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  /** The world's calendar and the bundled one, whose announced days the shares are sent for. */
  readonly calendars: readonly SchoolCalendar[];
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** A subject's name in the interface's language. */
  readonly subjectName: (code: string) => string;
  /** The bundled reference data, whose seeded schools place each directorate in its wilaya. */
  readonly bundled: Extract<ReferenceResult, { ok: true }>;
};

/** The Ministry's totals for the announced days the world's date reached. */
export function MinistryTotals({ world, calendars, send, dayText, subjectName, bundled }: MinistryTotalsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const view = useMinistryTotals(world, calendars, send);
  const [subject, setSubject] = useState(EVERY);
  const schools = useMemo(() => seededWorld(world.world, bundled).schools, [world.world, bundled]);
  const names = useMemo(() => itemNames(schools, bundled.packs), [schools, bundled]);
  const zones = bundled.profile.zones ?? [];
  return (
    <TotalsFrame
      testID="ministry-totals"
      view={view}
      lead={t('demo.ministryTotals.lead')}
      header={({ day, term }) =>
        t('demo.ministryTotals.header', {
          day: dayText(day),
          term: termName(t, term.number),
          from: dayText(term.from),
          to: dayText(term.to),
        })
      }
      never={t('demo.ministryTotals.never')}
      dayText={dayText}
      owed={(figures) => {
        const held = figures.national.subjects.flatMap(([code, figure]) => (figure === null ? [] : [code]));
        const chosen = held.includes(subject) ? subject : EVERY;
        const names = { zone: (zone: Zone) => localized(zone.name), nation: t('demo.ministryTotals.nation') };
        const rows = wilayaRows(figures, schools, zones, names, chosen === EVERY ? null : chosen);
        return (
          <>
            <Text style={[styles.body, align]}>{t('demo.ministryTotals.owedLead')}</Text>
            <ChipGroup
              testID="totals-subject"
              label={t('demo.ministryTotals.subject')}
              choices={[
                { value: EVERY, label: t('demo.totals.all') },
                ...held.map((code) => ({ value: code, label: subjectName(code) })),
              ]}
              selected={chosen}
              onSelect={setSubject}
            />
            <OwedTable rows={rows} first={t('demo.ministryTotals.wilaya')} testID="wilaya-row" />
            <Text style={[styles.body, align]}>{t('demo.ministryTotals.closures')}</Text>
          </>
        );
      }}
      report={(figures) => (
        <>
          <Text style={[styles.body, align]}>{t('demo.ministryTotals.reportLead')}</Text>
          <CurriculumReport
            figures={figures.national}
            subject={subjectName}
            names={names}
            more={(code) => {
              const range = reportRange(figures, code);
              return range === null ? t('demo.ministryTotals.noRange') : t('demo.ministryTotals.range', { ...range });
            }}
          />
        </>
      )}
    />
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.ink2 },
});
