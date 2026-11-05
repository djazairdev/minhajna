// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release's automated checks (#614, answer 768): a line for each, in words
// as well as a mark, with the items at fault, and the figures the week and
// budget checks need typed under them. A budget overrun says it goes to the
// IGP, and holds nothing back.

import { Text, View } from 'react-native';
import { TextField } from '../components/TextField';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { editorStyles as s } from './editor-styles';
import type { BudgetFigures, ReviewLine } from './release-checks';

const MARK = { pass: '✓', fail: '✗', advisory: '!', 'not-checked': '–' } as const;

export function ReleaseChecks(props: {
  readonly lines: readonly ReviewLine[];
  readonly weeks: string;
  readonly onWeeks: (value: string) => void;
  readonly figures: BudgetFigures;
  readonly onFigures: (value: BudgetFigures) => void;
}) {
  const t = useDeviceText();
  const { lines, figures, onFigures } = props;
  const field = (key: keyof BudgetFigures, numeric = true) => (
    <TextField
      testID={`release-budget-${key}`}
      label={t(`editorDesk.release.budget.${key}`)}
      placeholder=""
      value={figures[key]}
      {...(numeric ? { keyboardType: 'number-pad' as const, textDirection: 'ltr' as const } : {})}
      onChangeText={(value) => onFigures({ ...figures, [key]: value })}
    />
  );
  return (
    <View testID="release-checks" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.release.checksTitle')}
      </Text>
      {lines.map((line) => (
        <View key={line.id} testID={`release-line-${line.id}`} style={s.row}>
          <Text importantForAccessibility="no" style={line.state === 'fail' ? s.error : s.body}>
            {MARK[line.state]}
          </Text>
          <Text style={line.state === 'fail' ? s.error : s.body}>
            {t(`editorDesk.release.line.${line.id}.${line.state}` as never)}
          </Text>
          {line.items.length > 0 && <Text style={s.body}>{line.items.map((item) => isolate(item)).join(' · ')}</Text>}
        </View>
      ))}
      {lines.some((line) => line.id === 'weeks') && (
        <TextField
          testID="release-weeks"
          label={t('editorDesk.release.weeks')}
          placeholder=""
          value={props.weeks}
          keyboardType="number-pad"
          textDirection="ltr"
          onChangeText={props.onWeeks}
        />
      )}
      {lines.some((line) => line.id === 'budget') && (
        <>
          {field('main')}
          {field('td')}
          {field('minutes')}
          {field('source', false)}
        </>
      )}
    </View>
  );
}
