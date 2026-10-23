// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التقديرات» for a class, subject and term (#241, Apprec, Apprec-conduct,
// answer 465): the line and how many pupils have a phrase, «اقتراح العبارة حسب»
// «المعدل وحده» or «المعدل والسلوك والمواظبة», the screen's for the visit and
// never recorded, then one pupil at a time in list order: their average, in
// full too when it shows at a band's bound it does not reach; with conduct, the
// term's counts, never their details; the phrase their band suggests, in
// pencil, and «تأكيد المقترح»; «عبارات أخرى من القائمة», or the whole list for
// a pupil with no average; the list's note and release; and «لا تعبئة جماعية».
// A phrase chosen is recorded at once, shown, can be cleared, and moves on to
// the next pupil without one, or the next pupil once each had one; a phrase
// that only restates the mark stays on the pupil, with a warning. Once each has
// one, «اكتملت التقديرات», with «إلى التصدير الفصلي». The teacher picks only
// from the list. A class archived after the reshaping shows its phrases but
// takes no new ones.

import { setAppreciation, type AppreciationPhrase } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { OptionRow } from '../components/OptionRow';
import { Proposal } from '../components/Proposal';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radius, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import {
  appreciationList,
  appreciationSheet,
  averageLine,
  countsLine,
  listNote,
  progressLine,
  pupilSuggestion,
  type SuggestBy,
} from './appreciation-rules';
import { assessmentData, termWord } from './marks-rules';

export type MarksAppreciationsProps = {
  readonly courseId: string;
  readonly term: number;
  /** Opens the term's export once each pupil has a phrase. */
  readonly onExport?: () => void;
};

export function MarksAppreciations({ courseId, term, onExport }: MarksAppreciationsProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, record } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const data = assessmentData(profile);
  const list = appreciationList(profile);
  const sheet = data === null || list === null ? null : appreciationSheet(context, data, courseId, term);
  const [by, setBy] = useState<SuggestBy>('average');
  const [whole, setWhole] = useState(false);
  const [complete, setComplete] = useState(false);
  const [index, setIndex] = useState(() => {
    const first = sheet?.rows.findIndex((row) => row.pupilId === sheet.gaps[0]) ?? -1;
    return Math.max(first, 0);
  });
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  if (list === null || sheet === null || room === undefined) {
    return <Text style={[styles.body, styles.empty, align]}>{t('marks.appreciations.unavailable')}</Text>;
  }
  const archived = room.archivedFrom !== undefined;
  const { rows } = sheet;
  const row = rows[Math.min(index, rows.length - 1)];
  const go = (to: number) => {
    setIndex((to + rows.length) % rows.length);
    setWhole(false);
    setComplete(false);
  };
  const choose = (phrase: AppreciationPhrase | null) => {
    if (row === undefined) return;
    record(setAppreciation({ courseId, term, pupilId: row.pupilId }, list, phrase));
    if (phrase === null || phrase.restates === true) return;
    if (sheet.gaps.length === 0) return go(index + 1);
    const pending = new Set(sheet.gaps.filter((pupilId) => pupilId !== row.pupilId));
    const after = rows.map((_, step) => (index + 1 + step) % rows.length).find((at) => pending.has(rows[at].pupilId));
    if (after === undefined) setComplete(true);
    else go(after);
  };
  const chosen = row === undefined ? undefined : sheet.chosen.get(row.pupilId);
  const restates = list.phrases.find((phrase) => phrase.id === chosen?.id)?.restates === true;
  const offer = row === undefined ? null : pupilSuggestion(context, list, sheet, { courseId, term }, row, by);
  const others = offer === null ? [] : whole ? list.phrases.filter((one) => one !== offer.suggested) : offer.others;
  return (
    <ScrollView
      style={styles.screen}
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
      <View accessible style={styles.head}>
        <Text testID="apprec-line" style={[styles.title, align]}>
          {t('marks.appreciations.line', {
            class: courseLabel(t, state, profile, courseId, true),
            term: termWord(t, term),
          })}
        </Text>
        <Text testID="apprec-progress" style={[styles.note, align]}>
          {progressLine(t, sheet)}
        </Text>
      </View>
      {archived && <Text style={[styles.note, align]}>{t('marks.appreciations.archived')}</Text>}
      {rows.length === 0 && <Text style={[styles.body, align]}>{t('marks.appreciations.noPupils')}</Text>}
      {complete && (
        <View testID="apprec-complete" style={styles.card}>
          <Text style={[styles.title, align]}>{t('marks.appreciations.complete')}</Text>
          <Text style={[styles.body, align]}>{t('marks.appreciations.completeBody')}</Text>
          {onExport !== undefined && (
            <Button testID="apprec-export" label={t('marks.export.toExport')} onPress={onExport} />
          )}
          <Button testID="apprec-review" variant="line" label={t('marks.appreciations.review')} onPress={() => go(0)} />
        </View>
      )}
      {!complete && row !== undefined && offer !== null && (
        <>
          {!archived && (
            <SegmentedControl
              testID="apprec-by"
              label={t('marks.appreciations.by')}
              selected={by}
              onSelect={setBy}
              choices={[
                { value: 'average', label: t('marks.appreciations.byAverage') },
                { value: 'conduct', label: t('marks.appreciations.byConduct') },
              ]}
            />
          )}
          {by === 'conduct' && <Text style={[styles.note, align]}>{t('marks.appreciations.countsNote')}</Text>}
          <View testID="apprec-pupil" accessible style={styles.head}>
            <Text style={[styles.title, align]}>
              {`${row.number}. ${isolate(state.pupils.get(row.pupilId)?.name ?? row.pupilId)}`}
            </Text>
            <Text style={[styles.body, align]}>
              {row.average === null ? t('marks.appreciations.noAverage') : averageLine(t, list, sheet, row.average)}
            </Text>
            {offer.counts !== null && <Text style={[styles.note, align]}>{countsLine(t, offer.counts)}</Text>}
          </View>
          {chosen !== undefined && (
            <View testID="apprec-chosen" accessible style={styles.chosen}>
              <Text style={[styles.body, align]}>
                {t('marks.appreciations.chosen', { text: isolate(chosen.text) })}
              </Text>
              {restates && <Text style={[styles.warning, align]}>{t('marks.appreciations.restates')}</Text>}
            </View>
          )}
          {chosen !== undefined && !archived && (
            <Button
              testID="apprec-clear"
              variant="plain"
              label={t('marks.appreciations.clear')}
              onPress={() => choose(null)}
            />
          )}
          {offer.suggested !== null && !archived && (
            <>
              <Proposal
                testID="apprec-suggested"
                tag={t(by === 'conduct' ? 'marks.appreciations.tagConduct' : 'marks.appreciations.tagAverage')}
                lines={[{ text: offer.suggested.text['ar'] ?? '' }]}
              />
              <Button
                testID="apprec-confirm"
                label={t('marks.appreciations.confirm')}
                onPress={() => choose(offer.suggested)}
              />
            </>
          )}
          {!archived && (
            <View style={styles.rows}>
              <Text style={[styles.title, align]}>{t('marks.appreciations.others')}</Text>
              {others.map((phrase) => (
                <OptionRow
                  key={phrase.id}
                  testID={`apprec-use-${phrase.id}`}
                  label={phrase.text['ar'] ?? ''}
                  sub={t('marks.appreciations.use')}
                  selected={chosen?.id === phrase.id}
                  onPress={() => choose(phrase)}
                />
              ))}
              {offer.suggested !== null && (
                <Button
                  testID="apprec-whole"
                  variant="plain"
                  label={t(whole ? 'marks.appreciations.bandOnly' : 'marks.appreciations.whole')}
                  onPress={() => setWhole(!whole)}
                />
              )}
            </View>
          )}
          <Text style={[styles.note, align]}>{listNote(t, list)}</Text>
          <Text style={[styles.note, align]}>{t('marks.appreciations.oneByOne')}</Text>
          <View style={styles.steps}>
            <Button
              testID="apprec-previous"
              variant="line"
              label={t('marks.appreciations.previous')}
              onPress={() => go(index - 1)}
            />
            <Button
              testID="apprec-next"
              variant="line"
              label={t('marks.appreciations.next')}
              onPress={() => go(index + 1)}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  head: { gap: spacing['space-2'] },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  chosen: { gap: spacing['space-4'] },
  rows: { gap: spacing['space-8'] },
  steps: { flexDirection: 'row', gap: spacing['space-8'] },
  empty: { padding: spacing['space-16'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  warning: { ...typography.label, color: colors['warn-ink'] },
});
