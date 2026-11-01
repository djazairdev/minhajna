// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A read-only map on a PC (#600, answer 574): React Flow with its base
// stylesheet, on the sheet dotted every 18px, fitted to its box, with React
// Flow's read-only settings (map-elements.ts) and no handles to join by
// (map.css). For a screen reader the drawing is one picture named by the
// map's label, React Flow's own tree hidden inside it, as its words are
// English and speak of editing; the screen shows the map's links as text
// beside it. React Flow's attribution stays, as the design draws it, outside
// the picture so it is still reached as a link.

import {
  BaseEdge,
  Background,
  BackgroundVariant,
  ReactFlow,
  useInternalNode,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import './map.css';
import { useMemo, type CSSProperties } from 'react';
import type { MapSpec } from '../../../android/src/drawing/drawing-kit';
import { colorRoles, colors } from '../../../android/src/design/tokens';
import { FONT } from './font.ts';
import { betweenPath, mapElements, READ_ONLY, type Lane, type MapInk } from './map-elements.ts';

const INK: MapInk = {
  ink: colors.ink,
  sheet: colors.sheet,
  line: colors.line,
  rule: colors.rule,
  link: colorRoles.mapLink,
  font: FONT,
};

const FRAME = {
  position: 'relative',
  width: '100%',
  height: 360,
  background: colors.sheet,
  border: `1px solid ${colors.line}`,
  borderRadius: 14,
  overflow: 'hidden',
  '--map-label-ground': colors['map-label-ground'],
  '--map-attribution': colorRoles.mapAttribution,
} as CSSProperties;

const measured = (node: InternalNode) => ({
  ...node.internals.positionAbsolute,
  width: node.measured.width ?? 0,
  height: node.measured.height ?? 0,
});

/** A link drawn straight from one box to the other, in its lane. */
function BetweenEdge({
  id,
  source,
  target,
  data,
  style,
  label,
  labelStyle,
  labelBgStyle,
  markerEnd,
}: EdgeProps<Edge<Lane>>) {
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  if (from === undefined || to === undefined || data === undefined) return null;
  const { path, labelX, labelY } = betweenPath(measured(from), measured(to), data);
  return (
    <BaseEdge
      id={id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      style={style}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      markerEnd={markerEnd}
    />
  );
}

const EDGE_TYPES = { between: BetweenEdge };

/** Draws a map that is read, never edited. */
export function FlowMap({ spec, testID }: { readonly spec: MapSpec; readonly testID?: string }) {
  const { nodes, edges } = useMemo(() => {
    const drawn = mapElements(spec, INK);
    return {
      nodes: drawn.nodes.map((node): Node => ({ ...node, style: { ...node.style } })),
      edges: drawn.edges.map((edge): Edge<Lane> => ({ ...edge, data: { ...edge.data } })),
    };
  }, [spec]);
  return (
    <div data-testid={testID} className="minhajna-map" style={FRAME}>
      <div role="img" aria-label={spec.label} className="minhajna-map-drawing">
        <ReactFlow aria-hidden nodes={nodes} edges={edges} edgeTypes={EDGE_TYPES} {...READ_ONLY} fitView>
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.1} color={colors['map-dots']} />
        </ReactFlow>
      </div>
      <div className="react-flow__panel react-flow__attribution bottom right">
        <a href="https://reactflow.dev" target="_blank" rel="noopener noreferrer">
          React Flow
        </a>
      </div>
    </div>
  );
}
