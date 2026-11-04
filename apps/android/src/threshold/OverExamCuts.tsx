// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The committee's cut on a teacher's list once an exam above the school is over
// (#606, R-3.3-39, R-7.10-04, answer 640): for each grade and subject of the
// teacher's classes in it (own-exams.ts), the exam, the level that set it, its
// first day and figures day, a move of its days, and, read on the phone from
// the committee's own stream with the world's keys (over-cuts.ts,
// useCommittee.ts), the cut adopted and its day, or that it decided no cut, or
// that none was adopted and the paper was set as usual, with the committee's
// words on how the cut shaped the exam, unchanged, or that none are written. It
// says the keys are not held on a phone without them, and a problem as an alert
// with a way to read again. It signs nothing, and the phone's figures do not
// leave it.

import { type Day, type ExamMove } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { Send, WorldKit } from '../demo/world-session';
import { seededWorld } from '../director/director-world';
import type { TermReference } from '../director/seeded-fill';
import { colors, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { CommitteeRead } from './committee-session';
import { overCuts } from './over-cuts';
import type { OwnExam } from './own-exams';
import { headText, itemNamer, movedLines } from './threshold-text';
import { thresholdStyles as styles } from './ThresholdFrame';
import { useCommittee } from './useCommittee';

export type OverExamCutsProps = {
  readonly world: string;
  readonly date: Day;
  /** The teacher's classes in the exams above the school that are over. */
  readonly over: readonly OwnExam[];
  /** The directorate of the school, whose committee sets its exams. */
  readonly directorate: string;
  /** The world's keys and sealing key, held while it is open. */
  readonly held: HeldWorld | null;
  /** The bundled reference, which seeds the schools the committees cover. */
  readonly bundled: TermReference;
  /** The world's reference, which names the subjects, grades and plan items. */
  readonly reference: TermReference;
  /** The moved exams, by ID. */
  readonly moves: ReadonlyMap<string, ExamMove>;
  /** Heads the section when no exam above the school is listed before these. */
  readonly heading: boolean;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
};

const problem = { ...typography.body, color: colors['error-ink'] } as const;

/** The committee's cut, as published, of each over exam the teacher's classes sat. */
export function OverExamCuts(props: OverExamCutsProps) {
  const { world, date, over, directorate, held, bundled, reference, moves, heading, kit, send, dayText } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const cuts = useMemo(() => {
    const seeded = seededWorld(world, bundled).schools;
    return overCuts(world, over, directorate, seeded, bundled.packs);
  }, [world, over, directorate, bundled]);
  const votes = useCommittee(
    date,
    held,
    cuts.map((one) => one.room),
    kit,
    send,
  );
  if (cuts.length === 0) return null;
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const standing = (read: CommitteeRead | undefined, item: (id: string | null) => string) => {
    if (held === null) return t('demo.thresholds.over.keys');
    const adopted = read?.state.adopted;
    if (adopted === undefined) return '';
    if (adopted === null) return t('demo.thresholds.over.none');
    if (adopted.item === null) return t('demo.thresholds.over.noCut', { day: dayText(adopted.day) });
    return t('demo.thresholds.over.cut', { item: item(adopted.item), day: dayText(adopted.day) });
  };
  return (
    <>
      {heading && <SectionHeader testID="thresholds-above" label={t('demo.thresholds.above')} />}
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {votes.reading ? t('demo.thresholds.over.reading') : ''}
      </Text>
      {votes.problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[problem, align]}>
            {t(votes.problem)}
          </Text>
          <Button
            testID="thresholds-over-again"
            variant="line"
            label={t('demo.weekSign.again')}
            onPress={votes.again}
          />
        </View>
      )}
      {cuts.map(({ exam, chart, plan }, at) => {
        const read = votes.reads?.[at];
        const item = itemNamer(t, plan, reference.packs);
        return (
          <View key={`${exam.id}\n${chart.subject}\n${chart.grade}`} testID="thresholds-over" style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {headText(t, chart, reference)}
            </Text>
            {small(t(`demo.thresholds.level.${exam.setBy}`))}
            {small(t('demo.thresholds.ownDays', { from: dayText(exam.from), figures: dayText(exam.figuresDay) }))}
            {movedLines(t, moves.get(exam.id), exam, dayText, { published: true }).map((line, place) =>
              small(line, `moved-${place}`),
            )}
            <Text style={[styles.body, align]}>{standing(read, item)}</Text>
            {read?.state.adopted?.item != null && (
              <>
                {small(t('demo.committee.words.title'))}
                <Text style={[styles.body, { writingDirection: 'auto', textAlign: 'start' }]}>
                  {read.words?.words ?? t('demo.committee.words.none')}
                </Text>
              </>
            )}
          </View>
        );
      })}
    </>
  );
}
