// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What ECharts draws for a chart's figures (#600, answer 574, the design's
// charts-and-maps.md): the latest series as a solid line in the board's
// colour, earlier ones dashed, then dotted, never a colour that grades; the
// axes mirrored for right to left, since ECharts has none; and the chart's
// label as its description for screen readers, the table beside it giving the
// figures; and its tooltip drawn on the canvas, as the HTML one writes style
// attributes the page's policy refuses. Nothing here touches the page.

import type { ChartSpec } from '../../../android/src/drawing/drawing-kit';

/** The design's colours and type a chart takes. */
export interface ChartInk {
  readonly ink: string;
  readonly ink2: string;
  readonly line: string;
  readonly sheet: string;
  readonly hover: string;
  /** The latest series first, then earlier ones. */
  readonly series: readonly string[];
  readonly font: string;
}

const LINES = ['solid', 'dashed', 'dotted'] as const;

/** The ECharts option for a chart's figures. */
export function chartOption(spec: ChartSpec, ink: ChartInk): Record<string, unknown> {
  const count = spec.categories.length;
  if (spec.series.some((one) => one.values.length !== count)) throw new RangeError('A series misses a category');
  const side = spec.rightToLeft ? 'right' : 'left';
  const text = { color: ink.ink2, fontFamily: ink.font, fontSize: 12 };
  return {
    animation: false,
    aria: { enabled: true, label: { description: spec.label } },
    textStyle: { fontFamily: ink.font },
    grid: { containLabel: true, left: 8, right: 8, top: spec.series.length > 1 ? 36 : 12, bottom: 8 },
    legend: spec.series.length > 1 ? { top: 0, [side]: 0, textStyle: text, itemWidth: 18, itemHeight: 8 } : undefined,
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      backgroundColor: ink.sheet,
      borderColor: ink.line,
      textStyle: { ...text, color: ink.ink },
      axisPointer: { type: 'shadow', shadowStyle: { color: ink.hover } },
    },
    xAxis: {
      type: 'category',
      inverse: spec.rightToLeft,
      data: [...spec.categories],
      axisLabel: text,
      axisLine: { lineStyle: { color: ink.line } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      position: side,
      axisLabel: text,
      splitLine: { lineStyle: { color: ink.line } },
    },
    series: spec.series.map((one, index) => {
      const color = ink.series[Math.min(index, ink.series.length - 1)];
      const kind = LINES[Math.min(index, LINES.length - 1)];
      return spec.kind === 'line'
        ? {
            type: 'line',
            name: one.name,
            data: [...one.values],
            symbol: 'none',
            lineStyle: { color, type: kind, width: index === 0 ? 2.5 : 2 },
            itemStyle: { color },
          }
        : { type: 'bar', name: one.name, data: [...one.values], itemStyle: { color }, barMaxWidth: 28 };
    }),
  };
}
