// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A chart on a PC (#600, answer 574): Apache ECharts' modular build with the
// bar and line charts, the grid, legend, tooltip and aria parts and the canvas
// renderer. Its tooltip is drawn on the canvas too, as ECharts' HTML one
// writes style attributes the page's policy refuses. It is made once in its
// box and lives there as chart-life.ts says. Its text is set in the Arabic
// face, then the Latin one for French, English and Latin letters.

import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { init, use as register } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { ChartSpec } from '../../../android/src/drawing/drawing-kit';
import { colors } from '../../../android/src/design/tokens';
import { mountChart, type MountedChart } from './chart-life.ts';
import { chartOption, type ChartInk } from './chart-option.ts';
import { FONT, fontsLoaded } from './font.ts';

register([BarChart, LineChart, AriaComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

const INK: ChartInk = {
  ink: colors.ink,
  ink2: colors.ink2,
  line: colors.line,
  sheet: colors.sheet,
  hover: colors.hover,
  series: [colors.board, colors.pencil, colors.hatch],
  font: FONT,
};

/** Draws a chart's figures; its table is the screen's to show beside it. */
export function Chart({ spec, testID }: { readonly spec: ChartSpec; readonly testID?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedChart | null>(null);
  useEffect(() => {
    if (box.current === null) return;
    const chart = mountChart(box.current, {
      make: (element) => init(element, null, { renderer: 'canvas' }),
      watch: (resized) => new ResizeObserver(resized),
      fonts: fontsLoaded(document.fonts),
    });
    mounted.current = chart;
    return () => {
      mounted.current = null;
      chart.end();
    };
  }, []);
  useEffect(() => mounted.current?.draw(chartOption(spec, INK)), [spec]);
  return <div ref={box} data-testid={testID} style={{ width: '100%', height: 280 }} />;
}
