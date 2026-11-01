// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curator's source catalogue (#611, R-4.2-23), with made-up packs only:
// every status and release stays visible, with its source, examples and
// stale reasons; filters distinguish no match from no catalogue; own lists
// never appear; sorting and filtering change none of the supplied packs.
// Arabic, French and English use their own bundled words, with no missing
// key. Labels and descriptions wrap instead of being shortened.

import { PACK_STATUSES, type PackStatus, type PlanPack } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { StyleSheet, Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { Badge, type BadgeProps } from '../src/components/Badge';
import { editorPacks } from '../src/editor/pack-list';
import { PackList } from '../src/editor/PackList';
import { bundledReference, readReference } from '../src/reference';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The made-up bundled reference must read');
const reference = read;
const source = (status: PackStatus, release = '2026.1'): PlanPack => ({
  ...reference.packs[0],
  id: `dz.cem.1am.math.made-up-${status}`,
  release,
  status,
  provenance: { issuer: 'Made-up issuer', edition: 'Made-up edition' },
  ...(status === 'stale' && {
    staleReason: { ar: 'سبب مختلق للتجربة', fr: 'Motif inventé', en: 'Made-up reason' },
  }),
});
const packs = PACK_STATUSES.map((status) => source(status));
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(shown: readonly PlanPack[] = packs, refusedPacks = 0, language: Language = 'ar') {
  missingKeys.length = 0;
  await ReactTestRenderer.act(async () => {
    await i18n.changeLanguage(language);
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        <PackList packs={shown} profile={reference.profile} refusedPacks={refusedPacks} />
      </LocaleDirContext.Provider>,
    );
  });
}

const texts = () => tree!.root.findAllByType(Text).map((node) => (node.props as { children: string }).children);
const rowIds = () => editorPacks(packs).map(({ pack }) => `editor-pack-${pack.id}@${pack.release}`);

async function filter(status: string) {
  const control = tree!.root.findAllByProps({ testID: `editor-status-${status}` })[0];
  await ReactTestRenderer.act(() => {
    (control.props as PressableProps).onPress?.({} as never);
  });
}

test.each(['ar', 'fr', 'en'] as const)('every declared status and its meaning appear in %s', async (language) => {
  await render(packs, 0, language);
  const words = catalogues[language];
  expect(tree!.root.findAllByType(Badge).map((node) => (node.props as BadgeProps).label)).toEqual(
    editorPacks(packs).map(({ pack }) => words.plan.status[pack.status as PackStatus]),
  );
  for (const status of PACK_STATUSES) {
    expect(texts()).toContain(words.plan.meaning[status]);
    const row = tree!.root.findAllByProps({ testID: `editor-pack-${source(status).id}@2026.1` })[0];
    expect(row.findAllByType(Badge)[0].props.variant).toBe(
      status === 'stale' || status === 'example' ? 'warning' : 'default',
    );
  }
  const stale = source('stale').staleReason!;
  expect(texts()).toContain(stale[language]);
  expect(texts()).toContain(words.editorPacks.intro);
  expect(texts().some((value) => value.includes('Made-up edition') && value.includes('Made-up issuer'))).toBe(true);
  expect(missingKeys).toEqual([]);
});

test('a selected status filters only the view and All restores every release', async () => {
  const before = JSON.stringify(packs);
  await render();
  await filter('stale');
  expect(tree!.root.findAllByType(Badge)).toHaveLength(1);
  expect(texts()).toContain(catalogues.ar.plan.status.stale);
  const chosen = tree!.root.findAll(
    (node) => node.props.testID === 'editor-status-stale' && node.props.accessibilityRole === 'radio',
  )[0];
  expect(chosen.props.accessibilityState).toEqual({ checked: true });
  expect(chosen.props['aria-checked']).toBe(true);
  const all = tree!.root.findAll(
    (node) => node.props.testID === 'editor-status-all' && node.props.accessibilityRole === 'radio',
  )[0];
  expect(all.props['aria-checked']).toBe(false);
  await filter('all');
  for (const testID of rowIds()) expect(tree!.root.findAllByProps({ testID }).length).toBeGreaterThan(0);
  expect(JSON.stringify(packs)).toBe(before);
});

test('earlier releases stay visible, with their own statuses, in numeric release order', async () => {
  const latest = source('community', '2026.10');
  const older = { ...source('in-force', '2026.2'), id: latest.id };
  const given = [older, latest];
  const before = JSON.stringify(given);
  expect(editorPacks(given).map(({ pack }) => [pack.release, pack.status])).toEqual([
    ['2026.10', 'community'],
    ['2026.2', 'in-force'],
  ]);
  await render(given);
  expect(tree!.root.findAllByType(Badge).map((node) => (node.props as BadgeProps).label)).toEqual([
    catalogues.ar.plan.status.community,
    catalogues.ar.plan.status['in-force'],
  ]);
  for (const release of ['2026.10', '2026.2'])
    expect(texts().some((value) => value.includes(i18n.t('plan.release', { release })))).toBe(true);
  expect(JSON.stringify(given)).toBe(before);
});

test('a class’s own list and an unrecognised identity never enter the source catalogue', async () => {
  const own: PlanPack = { ...source('community'), status: 'own' };
  const malformed = { ...source('community'), id: 'not-a-pack' };
  expect(editorPacks([own, malformed])).toEqual([]);
  await render([own]);
  expect(texts()).toContain(catalogues.ar.editorPacks.empty);
  expect(tree!.root.findAllByType(Badge)).toHaveLength(0);
  expect(texts()).not.toContain(catalogues.ar.plan.status.own);
});

test('an empty catalogue and a filter with no match have different explanations', async () => {
  await render([]);
  expect(texts()).toContain(catalogues.ar.editorPacks.empty);
  await ReactTestRenderer.act(() => tree!.unmount());
  await render([source('example')]);
  await filter('official');
  expect(texts()).toContain(catalogues.ar.editorPacks.noMatch);
  expect(texts()).not.toContain(catalogues.ar.editorPacks.empty);
});

test('unreadable source files are reported without being counted as an empty successful catalogue', async () => {
  await render([], 2);
  expect(texts()).toContain(i18n.t('editorPacks.refused', { count: 2 }));
  expect(tree!.root.findAll((node) => node.props.accessibilityRole === 'alert').length).toBeGreaterThan(0);
});

test('right-to-left text wraps at its natural height, and identities remain selectable', async () => {
  await render();
  const page = tree!.root.findAllByProps({ testID: 'editor-packs' })[0];
  expect(StyleSheet.flatten(page.props.style)).toMatchObject({ direction: 'rtl' });
  const labels = tree!.root.findAllByType(Text);
  expect(
    labels.every((node) => node.props.numberOfLines === undefined && node.props.maxFontSizeMultiplier === undefined),
  ).toBe(true);
  expect(labels.filter((node) => node.props.selectable).length).toBe(packs.length);
  const intro = labels.find((node) => node.props.children === catalogues.ar.editorPacks.intro)!;
  expect(StyleSheet.flatten(intro.props.style)).toMatchObject({ textAlign: 'right', writingDirection: 'rtl' });
});
