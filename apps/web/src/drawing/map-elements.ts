// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What React Flow draws for a map (#600, answer 574, the design's
// charts-and-maps.md): boxes on the sheet with a rule border, links in the
// map-link colour with their labels and an arrowhead, dashed when one passes
// only on a condition, and faint, dotted and struck through with no arrowhead
// when one does not pass now (#592); and nothing to drag, join or pick, since
// maps are for reading and change only through buttons. As the design draws
// them, links are straight, from the edge of one box facing the other to the
// edge of that box, and links between the same two boxes, either way, stand
// side by side, their labels staggered along them. A link to a box the map does
// not hold is refused. Nothing in the drawing takes the keyboard's focus, from
// the first render, as React Flow applies its settings only after it, or speaks
// React Flow's words, which are English and about editing; a link is named by
// its boxes' labels and its own. React Flow's attribution is drawn by the map,
// outside the picture. Nothing here touches the page.

import type { ReactFlowProps } from '@xyflow/react';
import type { MapSpec } from '../../../android/src/drawing/drawing-kit';

/** The design's colours and type a map takes. */
export interface MapInk {
  readonly ink: string;
  readonly sheet: string;
  readonly line: string;
  readonly rule: string;
  readonly link: string;
  readonly font: string;
}

export interface FlowNode {
  readonly id: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly data: { readonly label: string };
  readonly draggable: false;
  readonly connectable: false;
  readonly selectable: false;
  readonly focusable: false;
  readonly style: Readonly<Record<string, string | number>>;
}

/** Where a link stands beside the others between its two boxes, and where along it its label sits. */
export type Lane = {
  /** Across the link, in pixels from the boxes' middle. */
  readonly shift: number;
  /** Along the link, from 0 at its start to 1 at its end. */
  readonly at: number;
};

export interface FlowEdge {
  readonly id: string;
  readonly type: 'between';
  readonly source: string;
  readonly target: string;
  readonly data: Lane;
  readonly label?: string;
  readonly markerEnd?: {
    readonly type: 'arrowclosed';
    readonly color: string;
    readonly width: number;
    readonly height: number;
  };
  /** In the map's own words, in place of React Flow's English. */
  readonly ariaLabel: string;
  readonly selectable: false;
  readonly focusable: false;
  readonly style: Readonly<Record<string, string | number>>;
  readonly labelStyle: Readonly<Record<string, string | number>>;
  readonly labelBgStyle: Readonly<Record<string, string | number>>;
}

/** React Flow's settings for a map that is only read. */
export const READ_ONLY = {
  nodesDraggable: false,
  nodesConnectable: false,
  nodesFocusable: false,
  edgesFocusable: false,
  elementsSelectable: false,
  zoomOnScroll: false,
  preventScrolling: false,
  disableKeyboardA11y: true,
  proOptions: { hideAttribution: true },
  ariaLabelConfig: {
    'node.a11yDescription.default': '',
    'node.a11yDescription.keyboardDisabled': '',
    'edge.a11yDescription.default': '',
  },
} as const satisfies ReactFlowProps;

/** A box as React Flow has measured it. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const LANE = 64;
const STAGGER = 0.16;

/** A straight link from one box's edge facing the other to that box's edge, set across by its lane. */
export function betweenPath(from: Box, to: Box, { shift, at }: Lane) {
  const middle = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const [a, b] = [middle(from), middle(to)];
  const across = (size: number) => Math.max(-size / 2 + 6, Math.min(size / 2 - 6, shift));
  const upright =
    Math.abs(b.y - a.y) - (from.height + to.height) / 2 > Math.abs(b.x - a.x) - (from.width + to.width) / 2;
  const [start, end] = upright
    ? [
        { x: a.x + across(from.width), y: b.y > a.y ? from.y + from.height : from.y },
        { x: b.x + across(to.width), y: b.y > a.y ? to.y : to.y + to.height },
      ]
    : [
        { x: b.x > a.x ? from.x + from.width : from.x, y: a.y + across(from.height) },
        { x: b.x > a.x ? to.x : to.x + to.width, y: b.y + across(to.height) },
      ];
  return {
    path: `M${start.x},${start.y} L${end.x},${end.y}`,
    labelX: start.x + (end.x - start.x) * at,
    labelY: start.y + (end.y - start.y) * at,
  };
}

/** React Flow's boxes and links for a map, all read-only. */
export function mapElements(spec: MapSpec, ink: MapInk): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const labels = new Map(spec.nodes.map((node) => [node.id, node.label]));
  if (labels.size !== spec.nodes.length) throw new RangeError('Two boxes share an ID');
  const nodes = spec.nodes.map((node): FlowNode => ({
    id: node.id,
    position: { x: node.x, y: node.y },
    data: { label: node.label },
    draggable: false,
    connectable: false,
    selectable: false,
    focusable: false,
    style: {
      background: ink.sheet,
      border: `1.5px solid ${ink.rule}`,
      borderRadius: 10,
      color: ink.ink,
      fontFamily: ink.font,
      fontSize: 12.5,
    },
  }));
  const pair = (link: MapSpec['links'][number]) => [link.from, link.to].sort().join('\n');
  const pairs = new Map<string, MapSpec['links'][number][]>();
  for (const link of spec.links) pairs.set(pair(link), [...(pairs.get(pair(link)) ?? []), link]);
  const edges = spec.links.map((link, index): FlowEdge => {
    const from = labels.get(link.from);
    const to = labels.get(link.to);
    if (from === undefined || to === undefined) throw new RangeError('A link names a box the map does not hold');
    const beside = pairs.get(pair(link))!;
    const place = beside.indexOf(link) - (beside.length - 1) / 2;
    const idle = link.idle === true;
    const dash = idle ? '3 7' : link.conditional === true ? '6 6' : undefined;
    return {
      id: `link-${index}`,
      type: 'between',
      source: link.from,
      target: link.to,
      data: { shift: place * LANE, at: 0.5 + place * STAGGER },
      ...(link.label === undefined ? {} : { label: link.label }),
      ...(idle ? {} : { markerEnd: { type: 'arrowclosed', color: ink.link, width: 16, height: 16 } }),
      ariaLabel: [from, to, link.label].filter((part) => part !== undefined).join(' – '),
      selectable: false,
      focusable: false,
      style: {
        stroke: idle ? ink.line : ink.link,
        strokeWidth: 2,
        ...(dash === undefined ? {} : { strokeDasharray: dash }),
      },
      labelStyle: {
        fill: ink.ink,
        fontFamily: ink.font,
        fontSize: 12,
        ...(idle ? { textDecoration: 'line-through' } : {}),
      },
      labelBgStyle: { fill: ink.sheet, stroke: ink.line, strokeWidth: 1 },
    };
  });
  return { nodes, edges };
}
