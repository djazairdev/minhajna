// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A chart's life on the page (#600, answer 574): made once in its box, it
// follows the box's size, takes each new set of figures in place of the last
// without being made again, draws them once more when the page's fonts have
// loaded, since a canvas never redraws by itself, and is disposed with its
// box, after its size stops being watched. ECharts itself is given, so this
// runs in tests without a page.

/** What the page needs of an ECharts instance. */
export interface ChartLike {
  setOption(option: Record<string, unknown>, notMerge: boolean): void;
  resize(): void;
  dispose(): void;
  isDisposed(): boolean;
}

/** What the page needs of a ResizeObserver. */
export interface SizeWatch {
  observe(element: Element): void;
  disconnect(): void;
}

export interface ChartPage<E extends Element> {
  readonly make: (element: E) => ChartLike;
  readonly watch: (resized: () => void) => SizeWatch;
  /** Settles once the chart's fonts have loaded, or failed to. */
  readonly fonts: Promise<unknown>;
}

export interface MountedChart {
  /** Draws a set of figures; the function returned forgets it once a newer one comes. */
  draw(option: Record<string, unknown>): () => void;
  end(): void;
}

/** Makes a chart in its box, watching the box's size. */
export function mountChart<E extends Element>(element: E, page: ChartPage<E>): MountedChart {
  const chart = page.make(element);
  const watch = page.watch(() => chart.resize());
  watch.observe(element);
  return {
    draw(option) {
      let latest = true;
      chart.setOption(option, true);
      void page.fonts.then(() => {
        if (latest && !chart.isDisposed()) chart.setOption(option, true);
      });
      return () => {
        latest = false;
      };
    },
    end() {
      watch.disconnect();
      chart.dispose();
    },
  };
}
