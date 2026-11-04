// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Two curators on one draft, on the made-up relay: the one who saved second
// moves their open form onto the latest revision with the typing kept and the
// other's changes taken, and a release no longer editable says so. A banner
// goes with the draft it was about.

import { act } from 'react-test-renderer';
import { field, press, rendered, show, shown, source, type, unmount } from '../jest/editor-form';
import { packService } from '../jest/pack-release';
import { PacksPage } from '../src/editor/PacksPage';
import { readPackReleases } from '../src/editor/pack-release-session';
import en from '../src/editor/item-text/en.json';
import { leaveWorldNetwork } from '../src/network/world-network';

const pack = { ...source, release: '2026.9' };
const two = {
  ...pack,
  items: [...pack.items, { id: 'second', kind: 'lesson' as const, title: 'Made-up second', budget: 1, sourcePage: 4 }],
};
const newest = async (f: Awaited<ReturnType<typeof packService>>) =>
  [...(await readPackReleases(f.editor, f.server.send)).values()][0];
const page = (f: Awaited<ReturnType<typeof packService>>) => (
  <PacksPage {...f.editor} packs={[]} send={f.server.send} />
);
const said = () => JSON.stringify(rendered().toJSON());
async function drain() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

async function editedThenBeaten(f: Awaited<ReturnType<typeof packService>>) {
  const first = await f.change(null, { stage: 'draft', pack });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  await press('draft-edit-lesson');
  await type('item-title', 'Made-up correction');
  await type('item-retyped-budget', '2');
  await type('item-retyped-sourcePage', '3');
  return first;
}

test('the second curator applies the open entry to the latest draft, losing nothing', async () => {
  const f = await packService();
  const first = await editedThenBeaten(f);
  const edition = 'Made-up edition from the other curator';
  await f.change(first, { stage: 'draft', pack: { ...pack, provenance: { ...pack.provenance, edition } } });
  await press('item-save');
  await drain();
  expect(said()).toContain(en.packChanged);
  expect(said()).toContain(en.latestApplyHint);
  expect(said()).toContain(en.applyLatest);
  expect(field('item-title').props.value).toBe('Made-up correction');
  await press('draft-latest');
  expect(said()).not.toContain(en.packChanged);
  expect(shown('draft-latest')).toBe(false);
  expect(field('item-retyped-budget').props.value).toBe('2');
  await press('item-save');
  await drain();
  expect(shown('editor-item-form')).toBe(false);
  const saved = await newest(f);
  expect(saved.revision).toBe(3);
  expect(saved.pack.items[0].title).toBe('Made-up correction');
  expect(saved.pack.provenance.edition).toBe(edition);
});

test('a latest revision that is no longer a draft says so, and offers nothing to apply', async () => {
  const f = await packService();
  const first = await editedThenBeaten(f);
  const review = await f.change(first, { stage: 'under-review' });
  await f.change(review, { stage: 'published' });
  await press('item-save');
  await drain();
  expect(shown('draft-latest')).toBe(false);
  expect(shown('draft-locked')).toBe(true);
  expect(said()).not.toContain(en.latestApplyHint);
  expect(field('item-title').props.value).toBe('Made-up correction');
});

test('applying a source or structure form keeps the other curator’s changes in fields left alone', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  await press('draft-source');
  await type('source-issuer', 'My made-up issuer');
  const theirs: typeof pack = {
    ...pack,
    licence: 'link-only',
    anchor: { kind: 'budgets', unit: 'hours' },
    provenance: { ...pack.provenance, edition: 'Their made-up edition' },
  };
  const second = await f.change(first, { stage: 'draft', pack: theirs });
  await press('source-keep');
  await drain();
  await press('draft-latest');
  expect(field('source-edition').props.value).toBe('Their made-up edition');
  await press('source-keep');
  await drain();
  const saved = await newest(f);
  expect(saved.revision).toBe(3);
  expect(saved.pack.provenance).toMatchObject({ issuer: 'My made-up issuer', edition: 'Their made-up edition' });
  expect(saved.pack.anchor).toEqual({ kind: 'budgets', unit: 'hours' });
  expect(saved.pack.licence).toBe('link-only');
  expect(second.revision).toBe(2);
});

test('applying an item form takes the other’s change to the same item, and says if it was removed', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack: two });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  await press('draft-edit-second');
  await type('item-title', 'My made-up title');
  await type('item-retyped-budget', '1');
  await type('item-retyped-sourcePage', '4');
  const changed = two.items.map((one) => (one.id === 'second' ? { ...one, budget: 7 } : one));
  const second = await f.change(first, { stage: 'draft', pack: { ...two, items: changed } });
  await press('item-save');
  await drain();
  await press('draft-latest');
  expect(field('item-title').props.value).toBe('My made-up title');
  expect(field('item-budget').props.value).toBe('7');
  expect(field('item-retyped-budget').props.value).toBe('');
  expect(field('item-retyped-sourcePage').props.value).toBe('4');
  await f.change(second, { stage: 'draft', pack });
  await type('item-retyped-budget', '7');
  await press('item-save');
  await drain();
  expect(said()).toContain(en.packChanged);
  await press('draft-latest');
  expect(shown('item-gone')).toBe(true);
  await press('item-save');
  await drain();
  expect((await newest(f)).revision).toBe(3);
});

test('an applied item form re-enters pages the other changed, and a budget whose unit changed', async () => {
  const f = await packService();
  const paged = {
    ...pack,
    items: [{ id: 'lesson', kind: 'lesson' as const, title: 'Made-up', budget: 2, sourcePage: 3, pages: '10' }],
  };
  const first = await f.change(null, { stage: 'draft', pack: paged });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  await press('draft-edit-lesson');
  await type('item-pages-check', '10');
  await type('item-retyped-budget', '2');
  await type('item-retyped-sourcePage', '3');
  await f.change(first, {
    stage: 'draft',
    pack: {
      ...paged,
      anchor: { kind: 'budgets', unit: 'hours' },
      items: [{ ...paged.items[0], pages: '11' }],
    },
  });
  await press('item-save');
  await drain();
  await press('draft-latest');
  expect(field('item-pages').props.value).toBe('11');
  expect(field('item-pages-check').props.value).toBe('');
  expect(field('item-budget').props.value).toBe('2');
  expect(field('item-retyped-budget').props.value).toBe('');
  expect(field('item-retyped-sourcePage').props.value).toBe('3');
});

test('a new item’s budget needs retyping when the unit changes under it', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  await press('draft-add');
  await type('item-id', 'added');
  await type('item-title', 'Made-up addition');
  await type('item-budget', '4');
  await type('item-retyped-budget', '4');
  await type('item-sourcePage', '5');
  await type('item-retyped-sourcePage', '5');
  await f.change(first, { stage: 'draft', pack: { ...pack, anchor: { kind: 'budgets', unit: 'hours' } } });
  await press('item-save');
  await drain();
  await press('draft-latest');
  expect(field('item-budget').props.value).toBe('4');
  expect(field('item-retyped-budget').props.value).toBe('');
  expect(field('item-retyped-sourcePage').props.value).toBe('5');
});

test('a banner about a draft goes when the curator leaves it', async () => {
  const f = await packService();
  const first = await editedThenBeaten(f);
  await f.change(first, { stage: 'draft', pack: { ...pack, licence: 'link-only' } });
  await press('item-save');
  await drain();
  await press('item-cancel');
  expect(said()).toContain(en.openLatest);
  expect(said()).toContain(en.latestShowHint);
  await press('draft-back');
  expect(said()).not.toContain(en.packChanged);
  expect(shown('draft-open-2026.9')).toBe(true);
});
