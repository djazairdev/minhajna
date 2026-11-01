// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's drawing kit (#600, §5.2, answer 574): Apache ECharts for charts
// and React Flow for read-only maps, which only the PC web app bundles, so
// the Android app never carries them. The PC's start hands the kit to the app
// through this context; where there is none, as on the phone, a screen shows
// the table of the same figures alone, since every chart has one beside it,
// as every map has its links written out, which is also what a screen reader
// reads; and the phone draws its charts with react-native-svg. ChartFigure.tsx
// sets the table under its chart. The shapes below are the app's own, so no
// screen imports either library.

import { createContext, useContext, type ComponentType } from 'react';

/** One line of figures in a chart, such as a class's progress. */
export interface ChartSeries {
  readonly name: string;
  /** Null for a figure held back below the floor (floors.ts), which the chart leaves out and the table says. */
  readonly values: readonly (number | null)[];
}

/** A chart's figures, in the order the categories are read. */
export interface ChartSpec {
  readonly kind: 'bar' | 'line';
  /** What the chart shows, said first by a screen reader. */
  readonly label: string;
  readonly categories: readonly string[];
  readonly series: readonly ChartSeries[];
  /** Mirrors the axes, since ECharts has no right-to-left mode. */
  readonly rightToLeft: boolean;
}

/** A box on a map, where it stands. */
export interface MapNode {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

/** A line from one box to another, with what it carries. */
export interface MapLink {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  /** Whether it passes only on a condition, drawn dashed. */
  readonly conditional?: boolean;
  /** Whether it does not pass now, drawn faint and dotted, with no arrowhead and its label struck through. */
  readonly idle?: boolean;
}

/** A read-only map: who holds what, and what goes where. */
export interface MapSpec {
  readonly label: string;
  readonly nodes: readonly MapNode[];
  readonly links: readonly MapLink[];
}

export interface DrawingKit {
  readonly Chart: ComponentType<{ readonly spec: ChartSpec; readonly testID?: string }>;
  readonly Map: ComponentType<{ readonly spec: MapSpec; readonly testID?: string }>;
}

/** The drawing kit, or null where the app draws neither. */
export const Drawing = createContext<DrawingKit | null>(null);

/** The drawing kit, or null where the app draws neither. */
export function useDrawing(): DrawingKit | null {
  return useContext(Drawing);
}
