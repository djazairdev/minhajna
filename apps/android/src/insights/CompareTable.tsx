// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Insights-compare's table of sessions (#623, answer 700), a real table on a PC
// (ChartFigure.tsx): each row of its cells, a median over the plan bold and
// said so; on a phone, each row said whole as one, its heading left out. At
// large text or on a narrow screen, each title stands above its numbers. A dash
// stands for a median not shown or an item not taught, each said in words.

import type { CompareRow } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, useWindowDimensions, View } from 'react-native';
import { onPc, useDeviceText } from '../text/device-text';
import { formatFigure } from '../text/figures';
import { currentLanguage } from '../text/i18n';
import { compareStyles as local } from './compare-styles';
import { insightsStyles as styles } from './insights-styles';

export type CompareTableProps = {
  readonly className: string;
  readonly rows: readonly CompareRow[];
};

/** The sessions each item took: the plan's, the median and the class's. */
export function CompareTable({ className, rows }: CompareTableProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const web = onPc();
  const { width, fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.3 || width < 340;
  const rowStyle = stacked ? local.stacked : local.row;
  const titleStyle = stacked ? local.titleAbove : local.title;
  const language = currentLanguage();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const number = (value: number) => formatFigure(value, language, !Number.isInteger(value));
  const head = 'demo.insights.compare.sessions';
  return (
    <View role="table" accessibilityLabel={web ? t(`${head}.head`) : undefined} style={local.table}>
      <View
        role="row"
        style={[rowStyle, local.heading]}
        accessibilityElementsHidden={!web}
        importantForAccessibility={web ? 'auto' : 'no-hide-descendants'}
      >
        <Text role="columnheader" style={[titleStyle, styles.small, align]}>
          {t(`${head}.item`)}
        </Text>
        <Text role="columnheader" style={[local.count, styles.small]}>
          {t(`${head}.plan`)}
        </Text>
        <Text role="columnheader" style={[local.count, styles.small]}>
          {t(`${head}.median`)}
        </Text>
        <Text role="columnheader" style={[local.count, styles.small]}>
          {className}
        </Text>
      </View>
      {rows.map((row) => {
        const median = row.median === null ? t(`${head}.hiddenSaid`) : number(row.median);
        const mine = row.mine === null ? t(`${head}.noneSaid`) : number(row.mine);
        const over = row.over ? t(`${head}.overSaid`, { median }) : median;
        return (
          <View
            key={row.item}
            testID={`insights-compare-row-${row.item}`}
            role="row"
            accessible={!web}
            accessibilityLabel={
              web
                ? undefined
                : t(`${head}.row`, { class: className, item: row.title, plan: number(row.planned), median: over, mine })
            }
            style={rowStyle}
          >
            <Text role="rowheader" style={[titleStyle, styles.note, align]}>
              {row.title}
            </Text>
            <Text role="cell" style={[local.count, styles.note]}>
              {number(row.planned)}
            </Text>
            <Text
              testID={`insights-compare-median-${row.item}`}
              role="cell"
              accessibilityLabel={web ? over : undefined}
              style={[local.count, styles.note, row.over && local.over]}
            >
              {row.median === null ? t(`${head}.dash`) : number(row.median)}
            </Text>
            <Text role="cell" accessibilityLabel={web ? mine : undefined} style={[local.count, styles.note]}>
              {row.mine === null ? t(`${head}.dash`) : number(row.mine)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
