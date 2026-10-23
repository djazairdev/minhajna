// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصحيح بعد الفصل» (#243, Export-fix, R-3.7-10, answer 468): once a term's
// last day has passed, its marks change here only. The window is the
// administration's to announce, which the screen says. Choose a pupil in list
// order, then one of the term's marks with its day and recorded value, type
// what it becomes or «غائب», and give a reason, with a detail for the report
// if wished; the effect on the averages shows before «تسجيل التصحيح». The
// term's corrections follow, each with its report, then «تحديث الملف».

import {
  correctMark,
  FIX_NOTE_LIMIT,
  gradeBook,
  MARK_FIX_REASONS,
  termEnded,
  termFixes,
  targetKey,
  type MarkEntry,
  type MarkFixReason,
  type MarkTarget,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { OptionRow } from '../components/OptionRow';
import { RadioCardGroup } from '../components/RadioCard';
import { RowLink } from '../components/RowLink';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { FixEffectView } from './FixEffect';
import { FixList } from './FixList';
import { fixName, fixTargets, recordedValue, typedMark, valueWord, type FixTarget } from './fix-rules';
import { assessmentData, termWord } from './marks-rules';

export type MarksFixProps = {
  readonly courseId: string;
  readonly term: number;
  readonly onAppreciations: () => void;
  /** Opens the file screen, to make the sheet again. */
  readonly onFile: () => void;
  readonly onSignature: () => void;
};

export function MarksFix({ courseId, term, onAppreciations, onFile, onSignature }: MarksFixProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, today, record } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const data = assessmentData(profile);
  const book = useMemo(
    () => (data === null ? null : gradeBook(context, data, courseId, term)),
    [context, data, courseId, term],
  );
  const targets = useMemo(
    () => (data === null ? [] : fixTargets(context, data, courseId, term)),
    [context, data, courseId, term],
  );
  const [pupilId, setPupilId] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [how, setHow] = useState<'mark' | 'absent'>('mark');
  const [text, setText] = useState('');
  const [reason, setReason] = useState<MarkFixReason | null>(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const target = targets.find((one) => one.key === key);
  const before =
    pupilId === null || target === undefined ? null : recordedValue(state, courseId, term, target.target, pupilId);
  const typed =
    target === undefined ? null : how === 'absent' ? { value: 'absent' as const } : typedMark(text, target.max);
  const value = typed !== null && 'value' in typed ? typed.value : null;
  const mark = useMemo<MarkEntry | null>(
    () =>
      pupilId === null || target === undefined || value === null
        ? null
        : { courseId, term, target: target.target, pupilId, value },
    [courseId, term, pupilId, target, value],
  );
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (data === null || book === null) {
    return <Text style={[styles.body, styles.empty, align]}>{t('marks.fix.unavailable')}</Text>;
  }
  const ended = termEnded(year, term, today());
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  const label = courseLabel(t, state, profile, courseId, true);
  const nameOf = (one: MarkTarget) =>
    fixName(
      t,
      profile.months,
      targets.find((each) => each.key === targetKey(one)),
      one,
      term,
    );
  const choiceLine = (one: FixTarget, pupil: string) => {
    const recorded = t('marks.fix.recorded', {
      value: valueWord(t, recordedValue(state, courseId, term, one.target, pupil)),
    });
    return one.day === null ? recorded : `${dayName(t, one.day, currentLanguage(), profile)} · ${recorded}`;
  };
  const numberOf = (id: string) => book.rows.find((row) => row.pupilId === id)?.number;
  const pupilName = (id: string) => state.pupils.get(id)?.name ?? '';
  const row = book.rows.find((one) => one.pupilId === pupilId);
  const same = value !== null && value === before;
  const reset = () => {
    setKey(null);
    setHow('mark');
    setText('');
    setReason(null);
    setNote('');
    setTried(false);
  };
  const keep = () => {
    setTried(true);
    if (pupilId === null || target === undefined || value === null || same || reason === null) return;
    record(correctMark({ courseId, term, target: target.target, pupilId }, before, value, target.max, reason, note));
    reset();
    setSaved(true);
  };
  const changed =
    <T,>(set: (one: T) => void) =>
    (one: T) => {
      set(one);
      setSaved(false);
    };
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <Text testID="fix-line" style={[styles.title, align]}>{`${label} · ${termWord(t, term)}`}</Text>
      <Text style={[styles.note, align]}>{t('marks.fix.window')}</Text>
      {!ended && (
        <Notice testID="fix-open" variant="notice" badge={t('marks.fix.openBadge')} message={t('marks.fix.open')} />
      )}
      {ended && row === undefined && (
        <View testID="fix-pupils" style={styles.rows}>
          <Text style={[styles.title, align]}>{t('marks.fix.pupil')}</Text>
          {book.rows.map((one) => {
            const registration = state.pupils.get(one.pupilId)?.registration;
            return (
              <OptionRow
                key={one.pupilId}
                testID={`fix-pupil-${one.pupilId}`}
                label={`${one.number} · ${isolate(pupilName(one.pupilId))}`}
                sub={registration === undefined ? undefined : t('marks.fix.registration', { number: registration })}
                onPress={() => changed(setPupilId)(one.pupilId)}
              />
            );
          })}
        </View>
      )}
      {ended && row !== undefined && (
        <>
          <View style={styles.chosen}>
            <Text testID="fix-chosen" style={[styles.title, styles.grow, align]}>
              {`${row.number} · ${isolate(pupilName(row.pupilId))}`}
            </Text>
            <Button
              testID="fix-change"
              variant="plain"
              label={t('marks.fix.changePupil')}
              onPress={() => {
                setPupilId(null);
                reset();
              }}
            />
          </View>
          <RadioCardGroup
            testID="fix-target"
            label={t('marks.fix.target')}
            selected={key}
            onSelect={changed(setKey)}
            choices={targets.map((one) => ({
              value: one.key,
              label: nameOf(one.target),
              description: choiceLine(one, row.pupilId),
            }))}
          />
          {target !== undefined && (
            <>
              <SegmentedControl
                testID="fix-how"
                label={t('marks.fix.becomes')}
                choices={[
                  { value: 'mark', label: t('marks.fix.aMark') },
                  { value: 'absent', label: t('marks.export.absent') },
                ]}
                selected={how}
                onSelect={changed(setHow)}
              />
              {how === 'mark' && (
                <TextField
                  testID="fix-value"
                  label={t('marks.fix.becomesOut', { max: target.max })}
                  placeholder={t('marks.fix.valueExample')}
                  value={text}
                  onChangeText={changed(setText)}
                  keyboardType="decimal-pad"
                  textDirection="ltr"
                  maxLength={5}
                  error={tried && value === null ? t('marks.fix.valueRule', { max: target.max }) : undefined}
                />
              )}
              {same && <Text style={[styles.danger, align]}>{t('marks.fix.same')}</Text>}
              <RadioCardGroup
                testID="fix-reason"
                label={t('marks.fix.reason')}
                selected={reason}
                onSelect={changed(setReason)}
                choices={MARK_FIX_REASONS.map((one) => ({
                  value: one,
                  label: t(`marks.fix.reasons.${one}`),
                  description: t(`marks.fix.reasonNotes.${one}`),
                }))}
              />
              {tried && reason === null && <Text style={[styles.danger, align]}>{t('marks.fix.reasonRule')}</Text>}
              <TextField
                testID="fix-note"
                label={t('marks.fix.note')}
                placeholder={t('marks.fix.noteExample')}
                optionalLabel={t('marks.fix.optional')}
                value={note}
                onChangeText={changed(setNote)}
                multiline
                maxLength={FIX_NOTE_LIMIT}
              />
              {mark !== null && !same && (
                <FixEffectView context={context} data={data} mark={mark} onAppreciations={onAppreciations} />
              )}
              <Button testID="fix-keep" label={t('marks.fix.keep')} onPress={keep} />
            </>
          )}
        </>
      )}
      {saved && <Notice testID="fix-saved" icon={controlIcon('check')} message={t('marks.fix.saved')} />}
      <FixList
        fixes={termFixes(state, courseId, term)}
        term={term}
        label={label}
        signable={room?.level === 'cem'}
        targets={targets}
        nameOf={nameOf}
        numberOf={numberOf}
        pupilName={pupilName}
        onSignature={onSignature}
      />
      <RowLink
        testID="fix-file"
        icon={controlIcon('lock')}
        title={t('marks.fix.file')}
        description={t('marks.fix.fileLine')}
        onPress={onFile}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  rows: { gap: spacing['space-4'] },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1 },
  empty: { padding: spacing['space-16'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  danger: { ...typography.caption, color: colors.danger },
});
