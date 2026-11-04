// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class against its peers in a teachers' world (#623, R-1.6-07, R-8.4-02 to
// R-8.4-04, answer 700), against a made-up demo server and its seeded sendings:
// no link before a term ends, a date moved across its end bringing it; opening
// one ends the term's collection and reads the wilaya's figures, with its
// counts, its rows against the plan, some in bold and said so, the changes in
// bands, the places and the self-selection note, nothing about the class sent;
// the nation's figure stands in for a hidden wilaya's; an unpublished pack, a
// term still forming, a device without the starter token and a failure each say
// so, a failure with a way to read again; and Android's back returns to the
// page. Every control is named in every language. Every world is made up.

import { addDays } from '@minhajna/core';
import { BackHandler, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import {
  all,
  asked,
  harness,
  host,
  joinedInsights,
  links,
  openInsights,
  openLink,
  press,
  reply,
  server,
  settle,
  turns,
} from '../jest/compare-world';
import { calendar } from '../jest/world-calendar';
import * as terms from '../src/insights/term-sendings';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const words = catalogues.en.demo.insights.compare;

test('before a term has ended, there is no class to compare', async () => {
  await joinedInsights(calendar.year.from);
  expect(host('insights-page')).toHaveLength(1);
  expect(links()).toHaveLength(0);
});

test('a date moved across a term’s end brings the class to compare', async () => {
  const from = calendar.year.terms[0].to;
  const rendered = await joinedInsights(addDays(from, -1));
  expect(links()).toHaveLength(0);
  await rendered(from);
  expect(links()).toHaveLength(1);
});

test('a device without the starter token waits for the one that has it', async () => {
  harness.override = (request) => (request.path.includes('/figures') ? reply(409) : reply(500));
  await joinedInsights(calendar.year.terms[0].to);
  await press(openLink());
  expect(host('insights-compare-waiting')).toHaveLength(1);
  expect(all()).toContain(words.waiting);
  expect(server.seen.filter((one) => one.path.endsWith('/closed'))).toEqual([]);
});

test('opening a comparison ends the term and reads the wilaya’s figures, sending nothing of the class', async () => {
  const id = await openInsights();
  const before = asked().length;
  await press(openLink());
  const reads = asked().slice(before);
  expect(reads.filter((one) => one.method === 'PUT')).toEqual([]);
  expect(reads.map((one) => one.body).filter((body) => body?.includes('sessions'))).toEqual([]);
  expect(reads.some((one) => one.path === `/worlds/${id}/insights/closed`)).toBe(true);
  expect(host('insights-compare-here')).toHaveLength(1);
  expect(JSON.stringify(all())).toContain('similar classes');
  const rows = harness.tree!.root.findAll(
    (node) => typeof node.type === 'string' && String(node.props.testID).startsWith('insights-compare-row-'),
  );
  expect(rows.length).toBeGreaterThan(2);
  expect(host('insights-compare-scaled')).toHaveLength(1);
  const median = (row: ReactTestRenderer.ReactTestInstance) =>
    host(`insights-compare-median-${String(row.props.testID).slice('insights-compare-row-'.length)}`)[0];
  const over = rows.filter((row) => String(median(row).props.accessibilityLabel).includes('more than the plan'));
  expect(over.length).toBeGreaterThan(0);
  expect(over.length).toBeLessThan(rows.length);
  for (const row of rows) {
    const style = StyleSheet.flatten(median(row).props.style as TextStyle);
    expect(style?.fontWeight === '700').toBe(over.includes(row));
  }
  expect(host('insights-compare-place')).toHaveLength(1);
  expect(host('insights-compare-note')).toHaveLength(1);
  expect(host('insights-compare-said')[0].props.children).toBe(words.ready);
});

test('the nation’s figure stands in for a hidden wilaya’s', async () => {
  await openInsights();
  harness.override = (request) => {
    if (!request.path.includes('&at=')) return null;
    return server.send(request).then((answer) => {
      const body = answer.body as { figures: { wilayas: unknown } };
      return { ...answer, body: { ...body, figures: { ...body.figures, wilayas: {} } } };
    });
  };
  await press(openLink());
  expect(JSON.stringify(all())).toContain('are not shown');
});

test.each([
  ['hidden', { status: 200, packs: [] }],
  ['forming', { status: 409, packs: [] }],
] as const)('a term with no figure to read says it is %s', async (state, { status, packs }) => {
  await openInsights();
  harness.override = (request) => {
    if (request.path.endsWith('/closed')) return reply(200, request.body);
    if (!request.path.includes('/figures')) return null;
    const { year, term } = { year: calendar.year.id, term: 1 };
    return reply(status, status === 200 ? { year, term, packs } : null);
  };
  await press(openLink());
  expect(host(`insights-compare-${state}`)).toHaveLength(1);
  expect(JSON.stringify(all())).toContain(words[state]);
});

test('a class whose sending cannot be worked out says so, not that too few took part', async () => {
  await openInsights();
  jest.spyOn(terms, 'termSendings').mockResolvedValue([]);
  await press(openLink());
  expect(host('insights-compare-unmade')).toHaveLength(1);
  expect(JSON.stringify(all())).toContain(catalogues.en.demo.insights.preview.failed);
  expect(JSON.stringify(all())).not.toContain(words.hidden);
});

test('a failure says so, and reading again finds the figures', async () => {
  await openInsights();
  harness.override = (request) => (request.path.includes('/figures') ? reply(500) : null);
  await press(openLink());
  expect(host('insights-compare-problem')).toHaveLength(1);
  harness.override = null;
  await press('insights-compare-again');
  expect(host('insights-compare-ready')).toHaveLength(1);
  expect(host('insights-compare-here')).toHaveLength(1);
});

test('Android’s back returns to the insights page', async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
  await openInsights();
  await press(openLink());
  expect(host('insights-compare-page')).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
    await settle();
  });
  await turns();
  expect(host('insights-compare-page')).toHaveLength(0);
  expect(host('insights-page')).toHaveLength(1);
});

test.each(['ar', 'fr', 'en'] as Language[])('the comparison names every control in %s', async (language) => {
  await i18n.changeLanguage(language);
  await openInsights();
  expect(accessibilityProblems(harness.tree!.root)).toEqual([]);
  await press(openLink());
  expect(host('insights-compare-here')).toHaveLength(1);
  expect(accessibilityProblems(harness.tree!.root)).toEqual([]);
  expect(missingKeys).toEqual([]);
  for (const node of harness.tree!.root.findAllByType(Text)) {
    expect((node.props as TextProps).numberOfLines).toBeUndefined();
    expect((node.props as TextProps).maxFontSizeMultiplier).toBeUndefined();
  }
});
