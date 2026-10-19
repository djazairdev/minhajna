// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «فرض جديد» (#221, Test-schedule, answers 268 and 269): the test's name,
// its day on a month's grid where only the class's open session days can
// be chosen, from today to the year's end, then that day's sessions as
// chips, and the «مشترك» mark. What the test changes shows before saving:
// the sessions left for lessons or TD, the item whose session it takes,
// which moves on with its followers, and any item it would push past the
// exams, which the warning then keeps showing until the teacher decides.
// The form saves once: a second tap waits for it to close.

import { type Context, type Day, type ScheduledTest, type Session } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { sessionLabel } from '../extra/AddSessionsChanges';
import { monthOf } from '../extra/extra-rules';
import { MonthDays } from '../extra/MonthDays';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { openSessions, testEffect, testOn } from './test-rules';

export type AddTestProps = {
  readonly context: Context;
  readonly courseId: string;
  readonly className: string;
  readonly onCancel: () => void;
  readonly onSave: (test: Omit<ScheduledTest, 'id'>) => void;
};

export function AddTest({ context, courseId, className, onCancel, onSave }: AddTestProps) {
  const t = useText();
  const { direction } = useLocale();
  const data = useAppData();
  const { profile, year, today } = data;
  const language = currentLanguage();
  const day0 = today();
  const first = day0 > year.from ? day0 : year.from;
  const open = useMemo(() => openSessions(context, courseId, first, year.to), [context, courseId, first, year.to]);
  const days = useMemo(() => new Set(open.map((session) => session.day)), [open]);
  const [day, setDay] = useState<Day | null>(open[0]?.day ?? null);
  const [month, setMonth] = useState(monthOf(day ?? first));
  const [key, setKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [common, setCommon] = useState(false);
  const [tried, setTried] = useState(false);
  const saved = useRef(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;

  const onDay = useMemo(() => open.filter((one) => one.day === day), [open, day]);
  const session = useMemo<Session | undefined>(() => onDay.find((one) => one.key === key) ?? onDay[0], [onDay, key]);
  const draft = session === undefined ? null : testOn(session, title, common);
  const effect = useMemo(
    () =>
      session === undefined
        ? null
        : testEffect(context, session, { ...testOn(session, 'preview', false), id: 'preview' }, day0),
    [context, session, day0],
  );

  const lines: string[] = [];
  if (effect !== null) {
    if (effect.queue === 'none') lines.push(t('tests.takesOther'));
    else if (effect.left !== null) {
      lines.push(
        effect.queue === 'td'
          ? t('tests.takesTd', { after: effect.left.td.after, before: effect.left.td.before })
          : t('tests.takesLesson', { after: effect.left.lessons.after, before: effect.left.lessons.before }),
      );
    }
    lines.push(
      effect.moves === null ? t('tests.movesNothing') : t('tests.moves', { item: isolate(effect.moves.title) }),
    );
    if (effect.past.length > 0 && effect.examsFrom !== null) {
      lines.push(
        t('tests.past', {
          items: effect.past
            .map((item) => t('tests.quoted', { title: isolate(item.title) }))
            .join(language === 'ar' ? '، ' : ', '),
          day: dayName(t, effect.examsFrom, language, profile),
        }),
      );
    }
  }

  const save = () => {
    setTried(true);
    if (draft === null || draft.title === '' || saved.current) return;
    saved.current = true;
    onSave(draft);
  };

  return (
    <View testID="tests-add" style={styles.box}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('tests.newTitle', { class: className })}
      </Text>
      <TextField
        testID="tests-name"
        label={t('tests.name')}
        placeholder={t('tests.namePlaceholder')}
        value={title}
        onChangeText={setTitle}
        {...(tried && title.trim() === '' && { error: t('tests.nameMissing') })}
      />
      {open.length === 0 ? (
        <Text testID="tests-no-day" style={[styles.body, align]}>
          {t('tests.noDay')}
        </Text>
      ) : (
        <>
          <Text style={[styles.label, align]}>{t('tests.when')}</Text>
          <MonthDays
            month={month}
            selected={day}
            first={first}
            last={year.to}
            profile={profile}
            allows={(one) => days.has(one)}
            onMonth={setMonth}
            onSelect={(one) => {
              setDay(one);
              setKey(null);
            }}
          />
          {session !== undefined && (
            <ChipGroup
              testID="tests-session"
              label={dayName(t, session.day, language, profile)}
              selected={session.key}
              onSelect={setKey}
              choices={onDay.map((one) => ({ value: one.key, label: sessionLabel(t, data, one, one.day) }))}
            />
          )}
        </>
      )}
      <CheckRow testID="tests-common" label={t('tests.commonTick')} checked={common} onCheckedChange={setCommon} />
      {lines.length > 0 && (
        <View testID="tests-effect" accessible style={styles.effect}>
          {lines.map((line) => (
            <Text key={line} style={[styles.body, align]}>
              {line}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.buttons}>
        <Button testID="tests-cancel" variant="line" label={t('tests.cancel')} onPress={onCancel} />
        <Button
          testID="tests-save"
          label={effect?.moves == null ? t('tests.save') : t('tests.saveAndMove')}
          disabled={session === undefined}
          onPress={save}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing['space-12'] },
  effect: {
    gap: spacing['space-6'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  buttons: { gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
