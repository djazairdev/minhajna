// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إضافة حراسة أو اختبار» (#221, Today-exams, answers 268 and 270): the
// teacher types an invigilation or a class exam from the school's paper.
// The kind; the day on a month's grid, where only days an exam window of
// the teacher's classes covers can be chosen; the times as on paper; the
// room, when typed; and for a class exam, the classes sitting it, among
// those whose own exams cover the day. It opens on the asked day, else the
// next exam day, else the last one. The day's entries follow, each
// removable. A save or a removal can be taken back
// with «تراجع», and a second tap waits for the first.

import {
  dutiesOn,
  examCourses,
  setDuty,
  type Day,
  type DutyKind,
  type ExamDuty,
  type RecordEvent,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { SegmentedControl } from '../components/SegmentedControl';
import { Snackbar } from '../components/Snackbar';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { monthOf } from '../extra/extra-rules';
import { MonthDays } from '../extra/MonthDays';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { readSpan } from '../times/times-rules';
import { dayName } from '../today/DayMark';
import { courseLabel } from './course-label';
import { DutyCards } from './DutyCards';
import { examDays } from './duty-rules';

type Said = { readonly message: string; readonly undo: readonly RecordEvent[] } | 'failed' | null;

export function DutyEntry({ day: asked }: { readonly day?: Day }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, today, record, newId } = useAppData();
  const language = currentLanguage();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const days = useMemo(() => examDays(context), [context]);
  const sorted = [...days].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const start = (asked !== undefined && days.has(asked) ? asked : sorted.find((one) => one >= today())) ?? last;
  const [day, setDay] = useState<Day | undefined>(start);
  const [month, setMonth] = useState(monthOf(start ?? today()));
  const [kind, setKind] = useState<DutyKind>('invigilation');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [room, setRoom] = useState('');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const savedFrom = useRef<typeof state | null>(null);
  const undone = useRef<Said>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const times = readSpan(from, to);

  if (day === undefined || first === undefined || last === undefined) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Notice testID="duty-closed" icon={controlIcon('info')} message={t('duties.noExams')} />
      </View>
    );
  }

  const once = (events: readonly RecordEvent[], next: Said) => {
    if (savedFrom.current === state) return;
    savedFrom.current = state;
    for (const event of events) record(event);
    setSaid(next);
  };
  const sitting = examCourses(context, day);
  const chosen = courseIds.filter((id) => sitting.includes(id));
  const save = () => {
    setTried(true);
    if (times === null || (kind === 'exam' && chosen.length === 0)) return;
    const duty: ExamDuty = { id: newId(), kind, day, ...times, room, ...(kind === 'exam' && { courseIds: chosen }) };
    let event: RecordEvent;
    try {
      event = setDuty(context, duty);
    } catch (error: unknown) {
      if (__DEV__) console.warn('An exam-week entry was refused', error);
      setSaid('failed');
      return;
    }
    const message = t('duties.saved', {
      kind: t(`duties.kinds.${kind}`),
      day: dayName(t, day, language, profile),
    });
    once([event], { message, undo: [{ kind: 'duty.removed', id: duty.id }] });
    setFrom('');
    setTo('');
    setRoom('');
    setTried(false);
  };
  const remove = (duty: ExamDuty) =>
    once([{ kind: 'duty.removed', id: duty.id }], {
      message: t('duties.removed', { kind: t(`duties.kinds.${duty.kind}`) }),
      undo: [{ kind: 'duty.set', duty }],
    });
  const undo = () => {
    if (said === null || said === 'failed' || undone.current === said) return;
    undone.current = said;
    for (const event of said.undo) record(event);
    setSaid(null);
  };
  const entries = dutiesOn(state, day);

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingBottom: insets.bottom + (said === null || said === 'failed' ? spacing['space-24'] : 96),
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
          },
        ]}
      >
        <Text style={[styles.body, align]}>{t('duties.intro')}</Text>
        <SegmentedControl
          testID="duty-kind"
          label={t('duties.kind')}
          choices={[
            { value: 'invigilation', label: t('duties.kinds.invigilation') },
            { value: 'exam', label: t('duties.kinds.exam') },
          ]}
          selected={kind}
          onSelect={setKind}
        />
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('duties.date')}</Text>
          <MonthDays
            month={month}
            selected={day}
            first={first}
            last={last}
            profile={profile}
            allows={(one) => days.has(one)}
            onMonth={setMonth}
            onSelect={setDay}
          />
          <Text testID="duty-day" style={[styles.body, align]}>
            {dayName(t, day, language, profile)}
          </Text>
        </View>
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('duties.time')}</Text>
          <View style={styles.pair}>
            {(['from', 'to'] as const).map((end) => (
              <View key={end} style={styles.half}>
                <TextField
                  testID={`duty-${end}`}
                  label={t(`duties.${end}`)}
                  placeholder={t('duties.clockExample')}
                  value={end === 'from' ? from : to}
                  onChangeText={end === 'from' ? setFrom : setTo}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  textDirection="ltr"
                  {...(tried && times === null && { error: t('duties.timeWrong') })}
                />
              </View>
            ))}
          </View>
        </View>
        <TextField
          testID="duty-room"
          label={t('duties.room')}
          placeholder={t('duties.roomExample')}
          optionalLabel={t('duties.optional')}
          value={room}
          onChangeText={setRoom}
          maxLength={40}
        />
        {kind === 'exam' && (
          <ChipGroup
            testID="duty-classes"
            label={t('duties.classes')}
            multiple
            selected={chosen}
            onSelect={setCourseIds}
            choices={sitting.map((id) => ({ value: id, label: courseLabel(t, state, profile, id) }))}
            {...(tried && chosen.length === 0 && { hint: t('duties.classesMissing') })}
          />
        )}
        <Button testID="duty-save" label={t('duties.save')} onPress={save} />
        {said === 'failed' && <Notice testID="duty-failed" icon={controlIcon('info')} message={t('duties.failed')} />}
        {entries.length > 0 && (
          <View style={styles.group}>
            <Text accessibilityRole="header" style={[styles.label, align]}>
              {t('duties.dayList', { day: dayName(t, day, language, profile) })}
            </Text>
            <DutyCards context={context} duties={entries} onRemove={remove} />
          </View>
        )}
      </ScrollView>
      {said !== null && said !== 'failed' && (
        <Snackbar
          testID="duty-said"
          message={said.message}
          undoLabel={t('duties.undo')}
          onUndo={undo}
          bottomOffset={insets.bottom}
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
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
