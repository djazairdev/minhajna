// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspectors' access on the director's access page (#593, D-Substitute,
// §5.10, §7.8, R-7.5-15, answer 621): that access is granted by the supervising
// authority, never the director, then the directorate's requests addressed to
// this device (grant-access.ts), each with the inspector as the request labels
// them, the subject and classes, the signed weeks' range and the day the grant
// would end, and a way to review it (GrantApprove.tsx), or, once past its end,
// that it lapsed; then the grants made, as D-Substitute shows them: the
// inspector, what they open to the last working day, the classes, by whom and
// until when, its last access that checks, by date without a clock time, or
// that none is recorded yet, ended after that day, and, while the inspector's
// phone has not been reached, a way to finish sending. With neither, it says
// so; access is granted only at the directorate's request and never extended
// here. A problem is said as an alert, announced on the phone since a PC reads
// the alert, and a grant made or sent is announced on both.

import { compareDays, type Day, type DemoSchool, type Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { useSaid } from '../week/useSaid';
import { weekEnd } from '../week/week-sign-session';
import { useGrantAccess } from './grant-access';
import type { AskedGrant, GrantWorld } from './grant-session';
import { GrantApprove } from './GrantApprove';

export type GrantAccessProps = {
  readonly world: GrantWorld;
  readonly school: Pick<DemoSchool, 'id' | 'name' | 'teachers' | 'directorateId'>;
  readonly subjectName: (code: string) => string;
  readonly workingDays: readonly Weekday[];
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** How many times the page was read again, which reads the requests again too. */
  readonly round: number;
};

/** The days a grant's signed weeks span: from its first week's first day to its last week's last working day. */
function span(weeks: readonly { readonly week: Day }[], workingDays: readonly Weekday[]) {
  const days = weeks.map((one) => one.week).sort(compareDays);
  return { from: days[0], to: weekEnd(days[days.length - 1], workingDays) };
}

/** The directorate's requests to this device and the grants made for them. */
export function GrantAccess(props: GrantAccessProps) {
  const { world, school, subjectName, workingDays, kit, send, dayText, round } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const access = useGrantAccess(world, school, kit, send, round);
  const [open, setOpen] = useState<string | null>(null);
  const { say, region } = useSaid('', 'grant-access-said');
  const problem = access.problem === null ? null : t(access.problem);
  const announce = useEffectEvent((words: string | null) => {
    if (words !== null) say(words);
  });
  useEffect(() => {
    announce(problem !== null && !onPc() ? problem : null);
  }, [problem]);
  const done = useEffectEvent((made: boolean) => say(t(made ? 'demo.access.approved' : 'demo.access.finished')));
  useEffect(() => {
    if (access.done !== null) done(access.done.made);
  }, [access.done]);
  const asked = access.asked ?? [];
  const line = (one: AskedGrant) =>
    t('demo.access.row', {
      label: isolate(one.request.label),
      subject: isolate(subjectName(one.request.subject)),
      classes: one.request.classes.map(isolate).join(' · '),
    });
  const waiting = asked.filter((one) => one.made === null);
  const made = asked.flatMap((one) => (one.made === null ? [] : [{ one, made: one.made }]));
  return (
    <View testID="substitute-grants" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.substitute.grants')}
      </Text>
      <Text style={[styles.small, align]}>{t('demo.substitute.grantsLead')}</Text>
      {problem !== null && (
        <Text accessibilityRole="alert" style={[styles.problem, align]}>
          {problem}
        </Text>
      )}
      {waiting.length > 0 && (
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.access.requests')}
        </Text>
      )}
      {waiting.map((one) => (
        <View key={one.request.id} testID={`grant-request-${one.request.id}`} style={styles.row}>
          <Text style={[styles.body, align]}>{line(one)}</Text>
          <Text style={[styles.small, align]}>
            {t('demo.access.range', {
              from: dayText(one.request.weeks.from),
              to: dayText(one.request.weeks.to),
              until: dayText(one.request.until),
            })}
          </Text>
          {one.lapsed ? (
            <Text style={[styles.small, align]}>{t('demo.access.lapsed', { until: dayText(one.request.until) })}</Text>
          ) : open === one.request.id ? (
            <GrantApprove
              one={one}
              dayText={dayText}
              busy={access.busy}
              working={access.working}
              onApprove={(fingerprint) => access.approve(one.request.id, fingerprint)}
              onClose={() => setOpen(null)}
            />
          ) : (
            <Button
              testID={`grant-review-${one.request.id}`}
              variant="line"
              label={t('demo.access.review')}
              name={t('demo.access.reviewName', { label: one.request.label })}
              disabled={access.busy}
              onPress={() => setOpen(one.request.id)}
            />
          )}
        </View>
      ))}
      {made.length > 0 && (
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.access.made')}
        </Text>
      )}
      {made.map(({ one, made: { label, grant } }) => {
        const { from, to } = span(grant.weeks, workingDays);
        const ended = compareDays(world.date, grant.until) > 0;
        return (
          <View key={grant.id} testID={`grant-made-${grant.id}`} style={styles.row}>
            <Text style={[styles.body, align]}>{isolate(label)}</Text>
            <Text style={[styles.small, align]}>
              {t('demo.access.accessLine', {
                subject: isolate(subjectName(one.request.subject)),
                from: dayText(from),
                to: dayText(to),
              })}
            </Text>
            {one.opens.length > 0 && <Text style={[styles.small, align]}>{one.opens.map(isolate).join(' · ')}</Text>}
            <Text style={[styles.small, align]}>{t('demo.access.by')}</Text>
            <Text style={[styles.small, align]}>{t('demo.access.until', { until: dayText(grant.until) })}</Text>
            <Text testID={`grant-last-${grant.id}`} style={[styles.small, align]}>
              {one.lastUse === null ? t('demo.access.noUse') : t('demo.access.lastUse', { day: dayText(one.lastUse) })}
            </Text>
            {ended && (
              <Text style={[styles.small, align]}>{t('demo.access.ended', { until: dayText(grant.until) })}</Text>
            )}
            {!ended && !one.relayed && (
              <>
                <Text style={[styles.small, align]}>{t('demo.access.notRelayed')}</Text>
                <Button
                  testID={`grant-finish-${one.request.id}`}
                  variant="line"
                  label={t('demo.access.finish')}
                  name={t('demo.access.finishName', { label })}
                  disabled={access.busy}
                  onPress={() => access.finish(one.request.id)}
                />
              </>
            )}
          </View>
        );
      })}
      {access.asked !== null && asked.length === 0 && (
        <Text style={[styles.body, align]}>{t('demo.substitute.noGrant')}</Text>
      )}
      <Text style={[styles.small, align]}>{t('demo.substitute.grantsHere')}</Text>
      {region}
    </View>
  );
}

const styles = StyleSheet.create({
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
