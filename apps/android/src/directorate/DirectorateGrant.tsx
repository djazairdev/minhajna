// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Grant, the directorate's grants page in a national demo world (#593,
// §5.10, §7.9, answer 621): it says the directorate holds no school's key and
// opens no named record, then the request form over the directorate's seeded
// schools (GrantForm.tsx) and the requests made and how each stands
// (GrantRequests.tsx). A problem is said as an alert, announced on the phone
// since a PC reads the alert, and a request sent is announced on both, the
// form then emptied so a second press makes no second request.

import type { Day, DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { seededWorld } from '../director/director-world';
import { colors, spacing, typography } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import type { ReferenceResult } from '../reference';
import { onPc, useDeviceText } from '../text/device-text';
import { useSaid } from '../week/useSaid';
import { useGrantDesk } from './grant-desk';
import { GrantForm } from './GrantForm';
import { GrantRequests } from './GrantRequests';

export type DirectorateGrantProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  /** The school whose directorate this is, as the world seeds it. */
  readonly school: Pick<DemoSchool, 'directorateId'>;
  readonly reference: Extract<ReferenceResult, { ok: true }>;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
};

/** The directorate's requests for inspectors' grants. */
export function DirectorateGrant({ world, school, reference, kit, send, dayText }: DirectorateGrantProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const directorate = school.directorateId;
  const schools = useMemo(
    () => seededWorld(world.world, reference).schools.filter((one) => one.directorateId === directorate),
    [world.world, reference, directorate],
  );
  const desk = useGrantDesk(world, directorate, kit, send);
  const { say, region } = useSaid('', 'grant-said');
  const problem = desk.problem === null ? null : t(desk.problem);
  const announce = useEffectEvent((words: string | null) => {
    if (words !== null) say(words);
  });
  useEffect(() => {
    announce(problem !== null && !onPc() ? problem : null);
  }, [problem]);
  const sent = useEffectEvent(() => say(t('demo.grant.sent')));
  useEffect(() => {
    if (desk.sent > 0) sent();
  }, [desk.sent]);
  return (
    <View testID="directorate-grant" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.grant.lead')}</Text>
      <GrantForm
        key={`form-${desk.sent}`}
        schools={schools}
        date={world.date}
        workingDays={reference.profile.workingDays}
        dayText={dayText}
        subjectName={(code) => subjectName(reference.profile, code)}
        busy={desk.busy}
        sending={desk.sending}
        onRequest={desk.request}
      />
      {problem !== null && (
        <Text accessibilityRole="alert" style={[styles.problem, align]}>
          {problem}
        </Text>
      )}
      {desk.rows !== null && (
        <GrantRequests
          rows={desk.rows}
          schools={schools}
          dayText={dayText}
          busy={desk.busy}
          onAgain={(row) => desk.again(row.request)}
        />
      )}
      {region}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  body: { ...typography.body, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
