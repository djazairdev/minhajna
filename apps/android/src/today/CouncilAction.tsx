// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «انعقد المجلس» on a council's card on Today (#224, Today-council, answer
// 334): it records that the council was held, so the journal's seminars page
// writes it; once held, the card says where it went.

import { setCalendarEntry, type CalendarEntry } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SaveProblem } from '../calendar/SaveProblem';
import { useCalendarSave } from '../calendar/useCalendarSave';
import { Button } from '../components/Button';
import { colors, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';

export function CouncilAction({ entry }: { entry: CalendarEntry }) {
  const t = useText();
  const data = useAppData();
  const writer = useCalendarSave();
  const { direction } = useLocale();
  const [refused, setRefused] = useState(false);
  const council = entry.council;
  if (council === undefined) return null;
  if (council.held === true)
    return (
      <Text
        testID={`special-kept-${entry.id}`}
        style={[styles.kept, { writingDirection: direction, textAlign: 'start' }]}
      >
        {t('special.kept')}
      </Text>
    );
  const hold = () => {
    let event;
    try {
      event = setCalendarEntry(coreContext(data), { ...entry, council: { ...council, held: true } });
    } catch {
      setRefused(true);
      return;
    }
    setRefused(false);
    void writer.save(event, data.state);
  };
  return (
    <>
      <Button
        testID={`special-held-${entry.id}`}
        label={t('special.held')}
        variant="soft"
        disabled={writer.busy}
        onPress={hold}
      />
      <SaveProblem testID={`special-failed-${entry.id}`} problem={refused ? 'failed' : writer.problem} />
    </>
  );
}

const styles = StyleSheet.create({
  kept: { ...typography.caption, color: colors.ink2 },
});
