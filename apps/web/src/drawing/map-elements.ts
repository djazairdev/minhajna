// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What React Flow draws for a map (#600, answer 574, the design's
// charts-and-maps.md): boxes on the sheet with a rule border, links in the
// map-link colour with their labels, and nothing to drag, join or pick, since
// maps are for reading and change only through buttons. A link to a box the
// map does not hold is refused. Nothing in the drawing takes the keyboard's
// focus, from the first render, as React Flow applies its settings only after
// it, or speaks React Flow's words, which are English and about editing; a
// link is named by its boxes' labels and its own. React Flow's attribution is
// drawn by the map, outside the picture. Nothing here touches the page.

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

export interface FlowEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly label?: string;
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
  const edges = spec.links.map((link, index): FlowEdge => {
    const from = labels.get(link.from);
    const to = labels.get(link.to);
    if (from === undefined || to === undefined) throw new RangeError('A link names a box the map does not hold');
    return {
      id: `link-${index}`,
      source: link.from,
      target: link.to,
      ...(link.label === undefined ? {} : { label: link.label }),
      ariaLabel: [from, to, link.label].filter((part) => part !== undefined).join(' – '),
      selectable: false,
      focusable: false,
      style: { stroke: ink.link, strokeWidth: 2 },
      labelStyle: { fill: ink.ink, fontFamily: ink.font, fontSize: 12 },
      labelBgStyle: { fill: ink.sheet, stroke: ink.line, strokeWidth: 1 },
    };
  });
  return { nodes, edges };
}
