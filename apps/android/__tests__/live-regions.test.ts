// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fabric flattens a View that only lays out its children, and TalkBack never
// hears a live region on a flattened View. A testID or collapsable={false}
// keeps the View, so every live-region View in the app must carry one.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = join(__dirname, '..', 'src');
const REGION = /<View\b[^>]*?accessibilityLiveRegion[^>]*>/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

test('every live-region View stays in the native tree', () => {
  const found = sourceFiles(SOURCE).flatMap((path) =>
    (readFileSync(path, 'utf8').match(REGION) ?? []).map((view) => ({ path, view })),
  );
  expect(found.length).toBeGreaterThan(0);
  const flattened = found.filter(({ view }) => !/\btestID=|collapsable=\{false\}/.test(view));
  expect(flattened).toEqual([]);
});
