// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A clash between two schools on Week-slot (#232, answer 400): its two
// sessions, each with its class and school; «الإبقاء على الاثنين», after which
// Today shows both to confirm the one held, or «إعادة فتح التعارض»; kept
// against the recorded week, once a drawing's changes are saved;
// and «تغيير يوم واحد»: one of the next days that slot is taught, then one
// session's free time that day at its school, «مدرسة الرياض · 15:15», saved as
// a move for that day only, never a change to the drawn week. Moves from today
// on are listed, each taken back with «إلغاء النقل» while not recorded.

import {
  keepClash,
  keptClashAt,
  moveSession,
  reopenClash,
  slotKey,
  unmoveSession,
  type Day,
  type Slot,
  type TimetableVersion,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { colors, radius, spacing, typography } from '../design/tokens';
import { meetsByBells } from '../plan/catch-up-add-rules';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { sessionTime } from '../times/times-rules';
import { dayName } from '../today/DayMark';
import {
  clashDays,
  clashMoves,
  clashSessions,
  moveChoices,
  moveRecorded,
  schoolsClash,
  type ClashSession,
} from './clash-rules';
import { isolate, markedVersion, slotSpoken } from './grid-labels';
import type { Cell } from './week-rules';

/** The panel, shown only when the drawn week has a clash of two schools at the cell. */
export function ClashPanel({ version, cell }: { version: TimetableVersion; cell: Cell }) {
  const t = useText();
  const { direction } = useLocale();
  const data = useAppData();
  const { state, record, today, newId, profile } = data;
  const context = useMemo(() => coreContext(data), [data]);
  const [moving, setMoving] = useState(false);
  const [day, setDay] = useState<Day | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const marked = markedVersion(state, version);
  const clash = schoolsClash(marked ?? version, data, cell);
  if (clash === undefined) return null;
  const sessions = clashSessions(data, clash);
  const kept = marked === null ? undefined : keptClashAt(state, marked.id, cell.weekday, cell.slot);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const named = (one: ClashSession) =>
    t('clash.session', { class: isolate(one.schoolClass.name), school: isolate(one.school.name) });
  const timeOf = (one: ClashSession, slot: Slot, on: Day) =>
    sessionTime(data, one.school, slot, on)?.from ?? slotSpoken(t, slot);
  const days = clashDays(context, sessions, cell, today());
  const choices = day === null ? [] : moveChoices(context, data, sessions, cell, day, today());
  const chosen = choices.find((one) => `${one.session.entry.id}/${slotKey(one.move.to)}` === choice);
  const moves = clashMoves(data, sessions, cell, today());
  const language = currentLanguage();
  const save = () => {
    if (chosen === undefined) return;
    record(moveSession(context, { id: newId(), ...chosen.move }, today(), meetsByBells(data)));
    setMoving(false);
    setDay(null);
    setChoice(null);
  };

  return (
    <View testID="clash-panel" style={styles.panel}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('clash.title')}
      </Text>
      {sessions.map((one) => (
        <Text key={one.entry.id} style={[styles.line, align]}>
          {named(one)}
        </Text>
      ))}
      {kept !== undefined ? (
        <>
          <Text testID="clash-kept" style={[styles.note, align]}>
            {t('clash.keptNote')}
          </Text>
          <Button
            testID="clash-reopen"
            variant="line"
            label={t('clash.reopen')}
            onPress={() => record(reopenClash(state, kept.id))}
          />
        </>
      ) : marked === null ? (
        <Text testID="clash-save-first" style={[styles.note, align]}>
          {t('clash.saveFirst')}
        </Text>
      ) : (
        <Button
          testID="clash-keep"
          variant="line"
          label={t('clash.keep')}
          onPress={() => record(keepClash(state, marked, cell, newId()))}
        />
      )}
      {moving ? (
        <View style={styles.form}>
          <ChipGroup
            testID="clash-day"
            label={t('clash.day')}
            choices={days.map((one) => ({ value: one, label: dayName(t, one, language, profile) }))}
            selected={day}
            onSelect={(value) => {
              setDay(value);
              setChoice(null);
            }}
          />
          {day !== null && (
            <ChipGroup
              testID="clash-to"
              label={t('clash.to')}
              hint={choices.length === 0 ? t('clash.none') : t('clash.agree')}
              choices={choices.map((one) => ({
                value: `${one.session.entry.id}/${slotKey(one.move.to)}`,
                label: t('clash.toOption', {
                  school: isolate(one.session.school.name),
                  time: timeOf(one.session, one.move.to, day),
                }),
              }))}
              selected={choice}
              onSelect={setChoice}
            />
          )}
          <Button testID="clash-save" label={t('clash.save')} disabled={chosen === undefined} onPress={save} />
        </View>
      ) : (
        <Button testID="clash-move" variant="line" label={t('clash.move')} onPress={() => setMoving(true)} />
      )}
      {moves.map((move) => {
        const one = sessions.find((session) => session.entry.courseId === move.courseId);
        if (one === undefined) return null;
        return (
          <View key={move.id} style={styles.move}>
            <Text style={[styles.line, align]}>
              {t('clash.moved', {
                class: isolate(one.schoolClass.name),
                day: dayName(t, move.day, language, profile),
                from: timeOf(one, move.from, move.day),
                to: timeOf(one, move.to, move.day),
              })}
            </Text>
            {moveRecorded(state, move) ? (
              <Text style={[styles.note, align]}>{t('clash.recorded')}</Text>
            ) : (
              <Button
                testID={`clash-unmove-${move.id}`}
                variant="plain"
                label={t('clash.unmove')}
                onPress={() => record(unmoveSession(state, move.id))}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors['notice-line'],
    borderRadius: radius['radius-card'],
  },
  title: { ...typography.label, color: colors.ink },
  line: { ...typography.body, color: colors.ink },
  note: { ...typography.small, color: colors.ink2 },
  form: { gap: spacing['space-12'] },
  move: { gap: spacing['space-4'] },
});
