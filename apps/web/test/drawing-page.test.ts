// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's charts and maps on the page (#600, answer 574): a chart is made
// once in its box and follows its size; new figures replace the last without
// a new chart, and are drawn again once the fonts load unless newer ones came
// or the chart is gone; it stops watching its box before it is disposed. A
// map, bundled as the web build bundles it and rendered, is one picture named
// by its label, with nothing in it to focus from the first render, React
// Flow's English only in hidden text nothing points to, and React Flow's
// attribution as a link beside it. The figures are made up.

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { MapSpec } from '../../android/src/drawing/drawing-kit.ts';
import { resolvePlugin } from '../scripts/resolve.ts';
import { mountChart, type ChartLike } from '../src/drawing/chart-life.ts';

const out = join(tmpdir(), `minhajna-drawing-${process.pid}.mjs`);
after(() => rmSync(out, { force: true }));

function fakePage() {
  const said: string[] = [];
  let resized = () => {};
  let loaded = () => {};
  const chart: ChartLike = {
    setOption: (option) => void said.push(`option ${String(option.name)}`),
    resize: () => void said.push('resize'),
    dispose: () => void said.push('dispose'),
    isDisposed: () => said.includes('dispose'),
  };
  const page = {
    make: (element: Element) => (said.push(`make ${element.id}`), chart),
    watch: (then: () => void) => {
      resized = then;
      return {
        observe: (element: Element) => void said.push(`watch ${element.id}`),
        disconnect: () => void said.push('unwatch'),
      };
    },
    fonts: new Promise<void>((resolve) => (loaded = resolve)),
  };
  return { said, page, resize: () => resized(), load: () => (loaded(), page.fonts) };
}

describe('a chart on the page', () => {
  it('is made once, follows its box, takes new figures in place and redraws the latest with the fonts', async () => {
    const { said, page, resize, load } = fakePage();
    const chart = mountChart({ id: 'box' } as Element, page);
    const forget = chart.draw({ name: 'first' });
    forget();
    chart.draw({ name: 'second' });
    resize();
    await load();
    assert.deepEqual(said, ['make box', 'watch box', 'option first', 'option second', 'resize', 'option second']);
    chart.end();
    assert.deepEqual(said.slice(-2), ['unwatch', 'dispose']);
  });

  it('draws nothing more once disposed', async () => {
    const { said, page, load } = fakePage();
    const chart = mountChart({ id: 'box' } as Element, page);
    chart.draw({ name: 'only' });
    chart.end();
    await load();
    assert.deepEqual(said, ['make box', 'watch box', 'option only', 'unwatch', 'dispose']);
  });
});

describe('a map on the page', () => {
  const KEYS: MapSpec = {
    label: 'Who holds the made-up school key',
    nodes: [
      { id: 'director', label: 'Director', x: 0, y: 0 },
      { id: 'deputy', label: 'Deputy', x: 200, y: 80 },
    ],
    links: [{ from: 'director', to: 'deputy', label: 'school key' }],
  };

  it('is one picture named by its label, with nothing to focus, and the attribution as a link beside it', async () => {
    const drawing = fileURLToPath(new URL('../src/drawing/', import.meta.url));
    await build({
      stdin: {
        contents: `import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
          import { FlowMap } from './map.tsx';
          export const renderMap = (spec, testID) => renderToStaticMarkup(createElement(FlowMap, { spec, testID }));`,
        resolveDir: drawing,
        loader: 'ts',
      },
      outfile: out,
      bundle: true,
      format: 'esm',
      platform: 'node',
      jsx: 'automatic',
      loader: { '.js': 'jsx', '.css': 'empty', '.ttf': 'empty' },
      resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
      define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
      plugins: [resolvePlugin],
      banner: { js: `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);` },
      logLevel: 'error',
    });
    const { renderMap } = (await import(out)) as { renderMap: (spec: MapSpec, testID: string) => string };
    const page = renderMap(KEYS, 'keys');
    assert.match(page, /^<div data-testid="keys" class="minhajna-map" style="[^"]*">/u);
    assert.match(page, /<div role="img" aria-label="Who holds the made-up school key" class="minhajna-map-drawing">/u);
    assert.match(page, /class="minhajna-map-drawing"><div data-testid="rf__wrapper" aria-hidden="true"/u);
    assert.doesNotMatch(page, /tabindex|aria-describedby|role="group"/u);
    for (const words of page.match(/<div[^>]*>Press [^<]*<\/div>/gu) ?? [])
      assert.match(words, /style="display:none"/u);
    assert.equal(page.match(/react-flow__attribution/gu)?.length, 1);
    const link = '<a href="https://reactflow.dev" target="_blank" rel="noopener noreferrer">React Flow</a>';
    assert.ok(
      page.endsWith(
        `</div></div><div class="react-flow__panel react-flow__attribution bottom right">${link}</div></div>`,
      ),
    );
  });
});
