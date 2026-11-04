// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An advisory comparison of saved source releases. Its only input beyond
// the packs is the curator's double entry of the source's weekly horizon.

import {
  checkPackReleaseReview,
  newIds,
  oldIds,
  sourceNumber,
  type PackReleaseComparison,
  type PlanPack,
  type WeekPackFinding,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { TextField } from '../components/TextField';
import { changeRows } from '../plan/release-rules';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { editorStyles as s } from './editor-styles';

const key = 'editorItem.releaseReview' as const;
const ids = (values: readonly string[]) => values.map(isolate).join(' · ');
const column = { flexBasis: 320, flexGrow: 1, flexShrink: 1 };

function Comparison({ result }: { result: PackReleaseComparison }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (result.status === 'not-checked') return <Text style={s.body}>{t(`${key}.${result.reason}`)}</Text>;
  if (result.status === 'first-release') return <Text style={s.body}>{t(`${key}.firstRelease`)}</Text>;
  if (result.status === 'invalid-migration')
    return (
      <Text style={s.error}>
        {t(`${key}.migrationProblems.${result.problem}`, { release: isolate(result.release) })}
      </Text>
    );
  const rows = changeRows(t, result.changes);
  return (
    <>
      <Text style={s.body}>{t(`${key}.previous`, { release: isolate(result.previous.release) })}</Text>
      {rows.length === 0 && <Text style={s.body}>{t(`${key}.noChanges`)}</Text>}
      {rows.map((row, index) => (
        <View key={index} style={s.card} testID="review-change">
          <Text style={s.body}>{row.kind}</Text>
          <Text style={[s.body, align]}>{row.text}</Text>
        </View>
      ))}
      <Text accessibilityRole="header" style={s.title}>
        {t(`${key}.migration`)}
      </Text>
      {result.migrations.length === 0 && <Text style={s.body}>{t(`${key}.noMigration`)}</Text>}
      {result.migrations.map((entry, index) => (
        <Text key={index} style={s.body} testID="review-migration">
          {t(`${key}.entries.${entry.kind}`, { from: ids(oldIds(entry)), to: ids(newIds(entry)) })}
        </Text>
      ))}
    </>
  );
}

function WeekFinding({ finding }: { finding: WeekPackFinding }) {
  const t = useDeviceText();
  const values = finding.kind === 'activity-sessions' ? { ...finding, activity: isolate(finding.activity) } : finding;
  return (
    <Text style={s.error} testID="review-week-finding">
      {t(`${key}.weeks.${finding.kind}`, { ...values, items: ids(finding.items) })}
    </Text>
  );
}

export function ReleaseReview({ pack, history }: { pack: PlanPack; history: readonly PlanPack[] | null }) {
  const t = useDeviceText();
  const [weeks, setWeeks] = useState('');
  const [again, setAgain] = useState('');
  const number = sourceNumber(weeks, true);
  const horizon = number === sourceNumber(again, true) ? number : null;
  const result = useMemo(() => checkPackReleaseReview(pack, history, horizon), [pack, history, horizon]);
  return (
    <View style={[s.row, { alignItems: 'flex-start' }]} testID="release-review">
      <View style={[s.page, column]} testID="review-comparison">
        <Text accessibilityRole="header" style={s.title}>
          {t(`${key}.comparison`)}
        </Text>
        <Comparison result={result.comparison} />
      </View>
      <View style={[s.page, column]} testID="review-checks">
        <Text accessibilityRole="header" style={s.title}>
          {t(`${key}.checks`)}
        </Text>
        {result.source.length === 0 && <Text style={s.body}>{t(`${key}.sourcePagesOk`)}</Text>}
        {result.source.map((finding) =>
          finding.kind === 'invalid-pack' ? (
            <View key={finding.kind} style={s.card}>
              <Text style={s.error}>{t(`${key}.invalid-pack`)}</Text>
              {finding.problems.map(({ path, problem }, index) => (
                <Text key={index} style={s.error}>
                  {t(`${key}.fields.${problem}`, { field: isolate(path) })}
                </Text>
              ))}
            </View>
          ) : (
            <Text key={finding.kind} style={s.error} testID="review-source-finding">
              {t(`${key}.${finding.kind}`, { items: ids(finding.items) })}
            </Text>
          ),
        )}
        {pack.anchor.kind === 'weeks' ? (
          <>
            <TextField
              testID="review-weeks"
              label={t(`${key}.horizon`)}
              placeholder=""
              value={weeks}
              textDirection="ltr"
              keyboardType="number-pad"
              onChangeText={(text) => {
                setWeeks(text);
                setAgain('');
              }}
            />
            <TextField
              testID="review-weeks-again"
              label={t(`${key}.horizonAgain`)}
              placeholder=""
              value={again}
              error={again !== '' && horizon === null ? t(`${key}.horizonMismatch`) : undefined}
              textDirection="ltr"
              keyboardType="number-pad"
              onChangeText={setAgain}
            />
            <View accessibilityLiveRegion="polite">
              {result.weeks.status === 'checked' ? (
                result.weeks.findings.length === 0 ? (
                  <Text style={s.body}>{t(`${key}.weeksOk`)}</Text>
                ) : (
                  result.weeks.findings.map((finding, index) => <WeekFinding key={index} finding={finding} />)
                )
              ) : (
                <Text style={s.body}>{t(`${key}.weeksUnchecked`)}</Text>
              )}
            </View>
          </>
        ) : (
          <Text style={s.body}>{t(`${key}.budgetUnchecked`)}</Text>
        )}
      </View>
    </View>
  );
}
