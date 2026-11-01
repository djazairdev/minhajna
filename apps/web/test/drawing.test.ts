// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's charts and maps (#600, answer 574): a chart's latest figures solid
// in the board's colour and earlier ones dashed, then dotted; its axes mirrored
// for right to left; its label as the screen reader's description; a map whose
// boxes and links are only read, a link on a condition dashed and one that does
// not pass now faint, dotted and struck through without an arrowhead, links
// straight between the boxes' facing edges and those between the same two boxes
// side by side, refusing a link to a box it does not hold; ECharts' notice
// carrying its NOTICE file and the d3 licence it embeds; a chart's tooltip on
// the canvas; a figure held back left out; React Flow given nothing to focus,
// edit or describe; and neither library anywhere in the Android app. The
// figures are made up.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { ChartSpec, MapSpec } from '../../android/src/drawing/drawing-kit.ts';
import { packageNotice } from '../scripts/licences.ts';
import { chartOption, type ChartInk } from '../src/drawing/chart-option.ts';
import { betweenPath, mapElements, READ_ONLY, type MapInk } from '../src/drawing/map-elements.ts';

const INK: ChartInk = {
  ink: '#111111',
  ink2: '#222222',
  line: '#333333',
  sheet: '#ffffff',
  hover: '#eeeeee',
  series: ['#000001', '#000002', '#000003'],
  font: 'Made-up Sans',
};
const MAP_INK: MapInk = {
  ink: '#111111',
  sheet: '#ffffff',
  line: '#333333',
  rule: '#444444',
  link: '#555555',
  font: 'X',
};

const PROGRESS: ChartSpec = {
  kind: 'line',
  label: 'How far the made-up classes got',
  categories: ['1AM1', '1AM2', '1AM3'],
  series: [
    { name: 'Now', values: [12, 15, 9] },
    { name: 'Term 2', values: [8, 10, 7] },
    { name: 'Term 1', values: [4, 5, 3] },
  ],
  rightToLeft: true,
};

type Option = {
  aria: { label: { description: string } };
  xAxis: { inverse: boolean; data: string[] };
  yAxis: { position: string };
  legend?: Record<string, unknown>;
  series: { type: string; data: (number | null)[]; lineStyle?: { type: string; width: number; color: string } }[];
  tooltip: { renderMode: string };
};

const option = (spec: ChartSpec) => chartOption(spec, INK) as unknown as Option;

describe('a chart', () => {
  it('mirrors its axes for right to left, and only then', () => {
    const rtl = option(PROGRESS);
    assert.equal(rtl.xAxis.inverse, true);
    assert.equal(rtl.yAxis.position, 'right');
    assert.equal(rtl.legend?.right, 0);
    const ltr = option({ ...PROGRESS, rightToLeft: false });
    assert.equal(ltr.xAxis.inverse, false);
    assert.equal(ltr.yAxis.position, 'left');
    assert.equal(ltr.legend?.left, 0);
    assert.deepEqual(rtl.xAxis.data, PROGRESS.categories);
  });

  it('draws the latest figures solid in the board colour, earlier ones dashed, then dotted', () => {
    const { series, aria } = option(PROGRESS);
    assert.deepEqual(
      series.map((one) => [one.lineStyle?.type, one.lineStyle?.width, one.lineStyle?.color]),
      [
        ['solid', 2.5, '#000001'],
        ['dashed', 2, '#000002'],
        ['dotted', 2, '#000003'],
      ],
    );
    assert.deepEqual(series[0]?.data, [12, 15, 9]);
    assert.equal(aria.label.description, PROGRESS.label);
    assert.deepEqual(
      option({ ...PROGRESS, kind: 'bar', series: [PROGRESS.series[0]] }).series.map((one) => one.type),
      ['bar'],
    );
    assert.equal(option({ ...PROGRESS, series: [PROGRESS.series[0]] }).legend, undefined);
  });

  it('draws its tooltip on the canvas, with no style attribute for the page to refuse', () => {
    assert.equal(option(PROGRESS).tooltip.renderMode, 'richText');
  });

  it('refuses a series that misses a category', () => {
    assert.throws(() => option({ ...PROGRESS, series: [{ name: 'Now', values: [1, 2] }] }), RangeError);
  });

  it('leaves a figure held back below the floor out, as a gap, never as a number', () => {
    const held = option({ ...PROGRESS, series: [{ name: 'Now', values: [12, null, 9] }] });
    assert.deepEqual(held.series[0]?.data, [12, null, 9]);
    const bars = option({ ...PROGRESS, kind: 'bar', series: [{ name: 'Now', values: [null, 15, 9] }] });
    assert.deepEqual(bars.series[0]?.data, [null, 15, 9]);
  });
});

describe('a map', () => {
  const KEYS: MapSpec = {
    label: 'Who holds the made-up school key',
    nodes: [
      { id: 'director', label: 'Director', x: 0, y: 0 },
      { id: 'deputy', label: 'Deputy', x: 200, y: 80 },
    ],
    links: [
      { from: 'director', to: 'deputy', label: 'school key' },
      { from: 'deputy', to: 'director' },
    ],
  };

  it('is only read: nothing to drag, join or pick', () => {
    const { nodes, edges } = mapElements(KEYS, MAP_INK);
    assert.deepEqual(
      nodes.map(({ id, data, draggable, connectable, selectable, focusable }) => [
        id,
        data.label,
        draggable,
        connectable,
        selectable,
        focusable,
      ]),
      [
        ['director', 'Director', false, false, false, false],
        ['deputy', 'Deputy', false, false, false, false],
      ],
    );
    assert.deepEqual(
      edges.map((edge) => [edge.source, edge.target, edge.label, edge.selectable, edge.focusable, edge.style.stroke]),
      [
        ['director', 'deputy', 'school key', false, false, '#555555'],
        ['deputy', 'director', undefined, false, false, '#555555'],
      ],
    );
    assert.equal(new Set(edges.map((edge) => edge.id)).size, edges.length);
    assert.deepEqual(
      edges.map((edge) => edge.ariaLabel),
      ['Director – Deputy – school key', 'Deputy – Director'],
    );
  });

  it('gives React Flow nothing to focus, edit or describe, and draws the attribution itself', () => {
    assert.deepEqual(
      Object.entries(READ_ONLY).filter(([, value]) => typeof value === 'boolean'),
      [
        ['nodesDraggable', false],
        ['nodesConnectable', false],
        ['nodesFocusable', false],
        ['edgesFocusable', false],
        ['elementsSelectable', false],
        ['zoomOnScroll', false],
        ['preventScrolling', false],
        ['disableKeyboardA11y', true],
      ],
    );
    assert.equal(READ_ONLY.proOptions.hideAttribution, true);
    assert.deepEqual(new Set(Object.values(READ_ONLY.ariaLabelConfig)), new Set(['']));
  });

  it('dashes a link that passes only on a condition, and fades one that does not pass now', () => {
    const links = [
      ...KEYS.links,
      { from: 'director', to: 'deputy', label: 'grant', conditional: true },
      { from: 'director', to: 'deputy', label: 'absences', conditional: true, idle: true },
    ];
    const { edges } = mapElements({ ...KEYS, links }, MAP_INK);
    assert.deepEqual(
      edges.map((edge) => [edge.style.strokeDasharray, edge.style.stroke, edge.markerEnd?.type]),
      [
        [undefined, '#555555', 'arrowclosed'],
        [undefined, '#555555', 'arrowclosed'],
        ['6 6', '#555555', 'arrowclosed'],
        ['3 7', MAP_INK.line, undefined],
      ],
    );
    assert.deepEqual(
      edges.map((edge) => edge.labelStyle.textDecoration),
      [undefined, undefined, undefined, 'line-through'],
    );
  });

  it('sets links between the same two boxes, either way, side by side, their labels staggered', () => {
    const third = { from: 'director', to: 'deputy', label: 'grant' };
    const { edges } = mapElements({ ...KEYS, links: [...KEYS.links, third] }, MAP_INK);
    assert.deepEqual(
      edges.map((edge) => [edge.type, edge.data.shift, Math.round(edge.data.at * 100)]),
      [
        ['between', -64, 34],
        ['between', 0, 50],
        ['between', 64, 66],
      ],
    );
    const alone = mapElements({ ...KEYS, links: [KEYS.links[0]] }, MAP_INK).edges[0];
    assert.deepEqual(alone.data, { shift: 0, at: 0.5 });
  });

  it('draws a link straight between the boxes’ facing edges, across by its lane', () => {
    const top = { x: 0, y: 0, width: 160, height: 40 };
    const below = { x: 0, y: 200, width: 160, height: 40 };
    assert.deepEqual(betweenPath(top, below, { shift: 0, at: 0.5 }), {
      path: 'M80,40 L80,200',
      labelX: 80,
      labelY: 120,
    });
    assert.deepEqual(betweenPath(below, top, { shift: 64, at: 0.25 }), {
      path: 'M144,200 L144,40',
      labelX: 144,
      labelY: 160,
    });
    const beside = { x: 300, y: 0, width: 160, height: 40 };
    assert.equal(betweenPath(top, beside, { shift: 64, at: 0.5 }).path, 'M160,34 L300,34');
    assert.equal(betweenPath(beside, top, { shift: 0, at: 0.5 }).path, 'M300,20 L160,20');
  });

  it('refuses a link to a box it does not hold, and two boxes with one ID', () => {
    assert.throws(() => mapElements({ ...KEYS, links: [{ from: 'director', to: 'nobody' }] }, MAP_INK), RangeError);
    assert.throws(() => mapElements({ ...KEYS, nodes: [KEYS.nodes[0], KEYS.nodes[0]] }, MAP_INK), RangeError);
  });
});

describe('the libraries', () => {
  const modules = new URL('../node_modules/', import.meta.url).pathname;

  it('credit ECharts with its licence, its NOTICE file and the d3 licence it embeds', () => {
    const { name, text } = packageNotice(`${modules}echarts/`, modules);
    assert.equal(name, 'echarts 6.1.0');
    assert.match(text, /Apache License/u);
    assert.match(text, /\n\nNOTICE\n\nApache ECharts\nCopyright/u);
    assert.match(text, /\n\nlicenses\/LICENSE-d3\n\n/u);
    assert.doesNotMatch(packageNotice(`${modules}@xyflow/react/`, modules).text, /NOTICE|licenses\//u);
  });

  it('are pinned in the PC web app alone, and nothing in the Android app imports them', () => {
    const web = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    assert.equal(web.dependencies.echarts, '6.1.0');
    assert.equal(web.dependencies['@xyflow/react'], '12.12.0');
    const android = readFileSync(new URL('../../android/package.json', import.meta.url), 'utf8');
    assert.doesNotMatch(android, /echarts|zrender|@xyflow/u);
    const source = new URL('../../android/src/', import.meta.url);
    const files = readdirSync(source, { recursive: true, encoding: 'utf8' }).filter((file) => /\.[jt]sx?$/u.test(file));
    for (const file of files) {
      assert.doesNotMatch(readFileSync(new URL(file, source), 'utf8'), /from '(?:echarts|zrender|@xyflow)/u, file);
    }
  });
});
