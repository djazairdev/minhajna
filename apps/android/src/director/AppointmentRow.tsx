// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One appointment on the director's assignments and access page (#587, #588,
// answers 615 and 616): the substitute in place of the holder, with the
// decision, the first day and the classes, counted in the language's plural
// forms; whether the handover is all on the substitute's channel, received on a
// day, or not all there, with a way to send it again, and until the first day,
// while no receipt came, to bring it up to date; while it lasts, the return day
// among those offered, the first at first, and the way to end it at the
// holder's return; once ended, the day, whether the classes are all back on the
// holder's channel, and a way to send them back again when not, or that the
// holder has not joined, when the return cannot reach them.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { returnDays } from './substitute-end';
import type { Appointment } from './substitute-session';

export type AppointmentRowProps = {
  readonly one: Appointment;
  /** The days a version may start from. */
  readonly days: readonly Day[];
  readonly date: Day;
  readonly dayText: (day: Day) => string;
  readonly busy: boolean;
  /** Sends the handover again, whole or brought up to date. */
  readonly onResend: () => void;
  /** Ends the appointment at the holder's return on the day chosen. */
  readonly onEnd: (day: Day) => void;
  /** Sends the classes' return again, whole. */
  readonly onReturn: () => void;
};

/** One appointment on the list: who replaces whom, its handover, its end and the classes' return. */
export function AppointmentRow({ one, days, date, dayText, busy, onResend, onEnd, onReturn }: AppointmentRowProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const offered = returnDays(days, one);
  const [chosen, setChosen] = useState<Day | null>(null);
  const until = chosen ?? offered[0] ?? null;
  return (
    <View testID="substitute-appointment" style={styles.row}>
      <Text style={[styles.body, align]}>
        {t('demo.substitute.line', {
          substitute: isolate(one.substituteName),
          holder: isolate(one.holderName),
          decision: isolate(one.decision),
          from: dayText(one.from),
          classes: t('demo.substitute.classCount', { count: one.classes.length }),
        })}
      </Text>
      <Text style={[styles.small, align]}>{one.classes.map(isolate).join(' · ')}</Text>
      <Text style={[styles.small, align]}>
        {one.received !== null
          ? t('demo.substitute.received', { day: dayText(one.received) })
          : t(one.handedOver ? 'demo.substitute.handedOver' : 'demo.substitute.notHandedOver')}
      </Text>
      {one.ended === null && (!one.handedOver || (one.received === null && date < one.from)) && (
        <Button
          testID="substitute-resend"
          variant="line"
          label={t(one.handedOver ? 'demo.substitute.update' : 'demo.substitute.resend')}
          disabled={busy}
          onPress={onResend}
        />
      )}
      {one.ended === null && offered.length > 0 && (
        <>
          <ChipGroup
            testID="substitute-until"
            label={t('demo.substitute.untilDay')}
            choices={offered.map((day) => ({ value: day, label: dayText(day) }))}
            selected={until}
            onSelect={setChosen}
          />
          <Button
            testID="substitute-end"
            variant="line"
            label={t('demo.substitute.end')}
            disabled={busy || until === null}
            onPress={() => {
              if (until !== null) onEnd(until);
            }}
          />
        </>
      )}
      {one.ended !== null && (
        <>
          <Text style={[styles.body, align]}>{t('demo.substitute.ended', { day: dayText(one.ended) })}</Text>
          <Text style={[styles.small, align]}>
            {t(one.returned ? 'demo.substitute.returned' : 'demo.substitute.notReturned')}
          </Text>
          {!one.returned && !one.holderJoined && (
            <Text style={[styles.small, align]}>{t('demo.substitute.holderNotJoined')}</Text>
          )}
          {!one.returned && one.holderJoined && (
            <Button
              testID="substitute-return"
              variant="line"
              label={t('demo.substitute.resendReturn')}
              disabled={busy}
              onPress={onReturn}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing['space-4'] },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
