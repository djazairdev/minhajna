// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «حصة خارج استعمال الزمن» (#219, Session-extra): support, catch-up,
// review or supervised study for one of the teacher's classes. The class,
// the kind, the day on a month's grid (in the school year, never after
// today), and the times typed as on paper; the tap time is never recorded
// (R-3.3-17). The row it takes on the texts book's page shows before saving
// (R-3.8-26). It does not move the plan (R-3.3-18). The topic is a private
// note on the teacher's own devices, never on the page. Saving keeps the class, the
// kind and the day for the next one, and «تراجع» removes it with the
// history kept. A second tap waits for the first save. A make-up, support
// or revision day the school sets opens «إضافة حصص» instead.

import {
  extraRemoval,
  formatTextsBookDay,
  logExtra,
  supervisedRows,
  type Day,
  type ExtraKind,
  type RecordEvent,
  EXTRA_KINDS,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { Snackbar } from '../components/Snackbar';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { readSpan } from '../times/times-rules';
import { dayName } from '../today/DayMark';
import { supportRows } from './add-sessions-rules';
import { classChoices, courseOfChoice, loggableDays, monthOf, rowNumber, subjectName } from './extra-rules';
import { ExtraPreview } from './ExtraPreview';
import { MonthDays } from './MonthDays';

type Said = { readonly id: string; readonly noted: boolean } | 'failed' | null;

export function ExtraSession({
  courseId: initial,
  onAddDay,
}: {
  readonly courseId?: string;
  /** Opens «إضافة حصص», for a make-up, support or revision day the school sets. */
  readonly onAddDay?: () => void;
}) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useAppData();
  const { state, profile, year, calendar, calendarRelease, packs, today, recordAll, newId, settled } = data;
  const dayRows = useMemo(
    () => supportRows(data, coreContext({ profile, year, calendar, calendarRelease, packs, state })),
    [data, profile, year, calendar, calendarRelease, packs, state],
  );
  const days = loggableDays(year, today());
  const choices = useMemo(
    () => classChoices(state, profile, year.id, (grade) => yearShort(t, grade)),
    [state, profile, year.id, t],
  );
  const [choiceId, setChoiceId] = useState<string | null>(
    choices.find((one) => one.courseId !== undefined && one.courseId === initial)?.value ??
      (choices.length === 1 ? (choices[0]?.value ?? null) : null),
  );
  const [kind, setKind] = useState<ExtraKind | null>(null);
  const [day, setDay] = useState<Day>(days.last);
  const [month, setMonth] = useState(monthOf(days.last));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [topic, setTopic] = useState('');
  const [tried, setTried] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const busy = useRef(false);
  const undone = useRef<string | null>(null);

  const choice = choices.find((one) => one.value === choiceId);
  const className = (choice && state.classes.get(choice.classId)?.name) ?? '';
  const times = readSpan(from, to);
  const align = { writingDirection: direction, textAlign: 'start' } as const;

  if (choices.length === 0 || !days.open) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Notice
          testID="extra-closed"
          icon={controlIcon('info')}
          message={t(choices.length === 0 ? 'extra.noClass' : 'extra.beforeYear')}
        />
      </View>
    );
  }

  const save = () => {
    if (busy.current) return;
    setTried(true);
    if (choice === undefined || kind === null || times === null) return;
    const id = newId();
    let noted: boolean;
    try {
      const { course, isNew } = courseOfChoice(state, choice, year.id, newId);
      const courses = new Map(state.courses).set(course.id, course);
      const context = coreContext({ profile, year, calendar, calendarRelease, packs, state: { ...state, courses } });
      const logged = logExtra(context, { id, courseId: course.id, kind, day, ...times }, today(), topic);
      const made: RecordEvent[] = isNew ? [{ kind: 'course.set', course }] : [];
      noted = logged.some((event) => event.kind === 'session.noted');
      busy.current = true;
      recordAll([...made, ...logged]);
      void settled().finally(() => {
        busy.current = false;
      });
    } catch (error: unknown) {
      if (__DEV__) console.warn('A session outside the timetable was refused', error);
      setSaid('failed');
      return;
    }
    setFrom('');
    setTo('');
    setTopic('');
    setTried(false);
    setSaid({ id, noted });
  };

  const undo = () => {
    if (said === null || said === 'failed' || undone.current === said.id) return;
    undone.current = said.id;
    setSaid(null);
    recordAll(extraRemoval(said.id, said.noted));
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingBottom: insets.bottom + (said === null ? spacing['space-24'] : 96),
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
          },
        ]}
      >
        <Text style={[styles.body, align]}>{t('extra.intro')}</Text>
        <ChipGroup
          testID="extra-class"
          label={t('extra.class')}
          choices={choices}
          selected={choiceId}
          onSelect={setChoiceId}
        />
        <ChipGroup
          testID="extra-kind"
          label={t('extra.kind')}
          choices={EXTRA_KINDS.map((value) => ({ value, label: t(`extra.kinds.${value}`) }))}
          selected={kind}
          onSelect={setKind}
        />
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('extra.date')}</Text>
          <MonthDays
            month={month}
            selected={day}
            first={days.first}
            last={days.last}
            profile={profile}
            onMonth={setMonth}
            onSelect={setDay}
          />
          <Text testID="extra-day" style={[styles.body, align]}>
            {dayName(t, day, currentLanguage(), profile)}
          </Text>
          <Text style={[styles.caption, align]}>{t('extra.dateNote')}</Text>
        </View>
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('extra.time')}</Text>
          <View style={styles.pair}>
            {(['from', 'to'] as const).map((end) => (
              <View key={end} style={styles.half}>
                <TextField
                  testID={`extra-${end}`}
                  label={t(`extra.${end}`)}
                  placeholder={t('extra.clockExample')}
                  value={end === 'from' ? from : to}
                  onChangeText={end === 'from' ? setFrom : setTo}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  textDirection="ltr"
                  {...(tried && times === null && { error: t('extra.timeWrong') })}
                />
              </View>
            ))}
          </View>
          <Text style={[styles.caption, align]}>{t('extra.timeNote')}</Text>
        </View>
        <TextField
          testID="extra-topic"
          label={t('extra.topic')}
          placeholder={t('extra.topicExample')}
          optionalLabel={t('extra.optional')}
          value={topic}
          onChangeText={setTopic}
          maxLength={200}
          multiline
        />
        <Text style={[styles.caption, align]}>{t('extra.topicPrivacy')}</Text>
        {choice !== undefined && (
          <ExtraPreview
            className={className}
            number={rowNumber(supervisedRows(state, choice.classId, year.id, dayRows), {
              day,
              from: times?.from ?? '23:59',
              to: times?.to ?? '23:59',
            })}
            subject={subjectName(profile, choice.subject)}
            kind={kind === null ? '—' : t(`extra.kinds.${kind}`)}
            day={formatTextsBookDay(day)}
            time={times === null ? '—' : span(times.from, times.to, direction)}
          />
        )}
        <Notice icon={controlIcon('check')} message={t('extra.noPlan', { class: className || '—' })} />
        <Notice icon={controlIcon('check')} message={t('extra.noTap')} />
        <Notice icon={controlIcon('info')} message={`${t('extra.makeUp')} ${t('extra.makeUpLine')}`} />
        {onAddDay !== undefined && (
          <Button testID="extra-add-day" variant="line" label={t('addSessions.open')} onPress={onAddDay} />
        )}
        {said === 'failed' && <Notice testID="extra-failed" icon={controlIcon('info')} message={t('extra.failed')} />}
        {tried && (choice === undefined || kind === null) && (
          <Notice testID="extra-choose" icon={controlIcon('info')} message={t('extra.choose')} />
        )}
        <Button testID="extra-save" label={t('extra.save')} onPress={save} />
      </ScrollView>
      {said !== null && said !== 'failed' && (
        <Snackbar
          testID="extra-snack"
          message={t('extra.saved')}
          undoLabel={t('extra.undo')}
          bottomOffset={insets.bottom}
          onUndo={undo}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  group: { gap: spacing['space-8'] },
  pair: { flexDirection: 'row', gap: spacing['space-12'] },
  half: { flex: 1 },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  caption: { ...typography.caption, color: colors.ink2 },
});
