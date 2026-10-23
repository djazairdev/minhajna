// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The end of an entry (#239, Marks-test, Marks-exam, answers 440 and 447):
// «أُدخلت النقاط», how many marks and absences, the three checks, no mark above
// the maximum, the empty cells, and every mark's pupil on the list, or each one
// who is not with «ليس في قائمة القسم يومها» and a button to clear it, since it
// stays out of the averages until cleared. A test says its marks stay with the
// teacher, and a component counts no absences; a mark above a component's
// points since lowered is counted (answer 452). Every mark is already recorded,
// so «تم» only goes back; «مراجعة من البداية» goes back to the first pupil.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Icon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

export type EntrySummaryProps = {
  readonly max: number;
  /** Marks above the maximum, given before it was lowered. */
  readonly over: number;
  /** What was entered: a test's marks stay with the teacher; a component has no absences. */
  readonly kind: 'test' | 'exam' | 'component';
  readonly entered: number;
  readonly absent: number;
  readonly empty: number;
  /** Pupils with a mark or «غائب» who are not on the list, by name. */
  readonly notOnList: readonly { readonly id: string; readonly name: string }[];
  readonly onClear: (pupilId: string) => void;
  readonly onDone: () => void;
  readonly onRestart: () => void;
};

export function EntrySummary({
  max,
  over,
  kind,
  entered,
  absent,
  empty,
  notOnList,
  onClear,
  onDone,
  onRestart,
}: EntrySummaryProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const check = (testID: string, text: string, kept: boolean) => (
    <View testID={testID} accessible style={styles.check}>
      <Icon name={kept ? 'check' : 'info'} size={18} color={kept ? colors['ok-ink'] : colors['warn-ink']} />
      <Text style={[styles.body, styles.grow, align]}>{text}</Text>
    </View>
  );
  return (
    <View testID="entry-summary" style={styles.summary}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('marks.entry.summary')}
      </Text>
      <Text testID="entry-counts" style={[styles.body, align]}>
        {kind === 'component'
          ? t('marks.componentMarks.counts', { entered })
          : t('marks.entry.counts', { entered, absent })}
      </Text>
      <View style={styles.checks}>
        {check(
          'entry-check-over',
          over === 0 ? t('marks.entry.noneOver', { max }) : t('marks.entry.overCells', { max, count: over }),
          over === 0,
        )}
        {check(
          'entry-check-empty',
          empty === 0 ? t('marks.entry.noEmpty') : t('marks.entry.emptyCells', { count: empty }),
          empty === 0,
        )}
        {notOnList.length === 0 && check('entry-check-list', t('marks.entry.allListed'), true)}
      </View>
      {notOnList.length > 0 && (
        <View testID="entry-not-listed" style={styles.checks}>
          <Text style={[styles.note, align]}>{t('marks.entry.notListedNote')}</Text>
          {notOnList.map((pupil) => (
            <View key={pupil.id} style={styles.row}>
              <View accessible style={styles.grow}>
                <Text style={[styles.body, align]}>{pupil.name}</Text>
                <Text style={[styles.note, align]}>{t('marks.entry.notListed')}</Text>
              </View>
              <Button
                testID={`entry-clear-${pupil.id}`}
                variant="line"
                label={t('marks.entry.erase')}
                accessibilityHint={t('marks.entry.clear', { name: isolate(pupil.name) })}
                onPress={() => onClear(pupil.id)}
              />
            </View>
          ))}
        </View>
      )}
      {kind === 'test' && <Text style={[styles.note, align]}>{t('marks.entry.stays')}</Text>}
      <Button testID="entry-done" label={t('marks.entry.done')} onPress={onDone} />
      <Button testID="entry-restart" variant="line" label={t('marks.entry.restart')} onPress={onRestart} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing['space-12'] },
  checks: { gap: spacing['space-6'] },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1 },
  title: { ...typography.h3, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
