// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Real signed, sealed draft revisions on the made-up relay, through the
// curator page. Failed writes retain inputs; stale revisions never win.

import { act } from 'react-test-renderer';
import { field, press, show, shown, source, type, unmount } from '../jest/editor-form';
import { packService } from '../jest/pack-release';
import { PacksPage } from '../src/editor/PacksPage';
import { readPackReleases } from '../src/editor/pack-release-session';
import { leaveWorldNetwork } from '../src/network/world-network';

const pack = { ...source, release: '2026.9' };
async function drain() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

test('an edited source draft is signed, saved and reopened after remount', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack });
  const page = <PacksPage {...f.editor} packs={[]} send={f.server.send} />;
  await show(page);
  await drain();
  await press('draft-open-2026.9');
  await press('draft-edit-lesson');
  await type('item-title', 'عنوان مختلق محفوظ');
  await type('item-retyped-budget', '2');
  await type('item-retyped-sourcePage', '3');
  await press('item-save');
  await drain();
  expect(shown('editor-item-form')).toBe(false);
  const saved = [...(await readPackReleases(f.editor, f.server.send)).values()][0];
  expect(saved.revision).toBe(2);
  expect(saved.pack.items[0].title).toBe('عنوان مختلق محفوظ');
  expect(source.items[0].title).not.toBe(saved.pack.items[0].title);
  await unmount();
  await show(page);
  await drain();
  await press('draft-open-2026.9');
  await press('draft-edit-lesson');
  expect(field('item-title').props.value).toBe('عنوان مختلق محفوظ');
  expect(field('item-retyped-budget').props.value).toBe('');
});

test('a competing revision refuses the save and keeps every typed field', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack });
  await show(<PacksPage {...f.editor} packs={[]} send={f.server.send} />);
  await drain();
  await press('draft-open-2026.9');
  await press('draft-edit-lesson');
  await type('item-title', 'تصحيح مختلق لم يُحفظ');
  await type('item-retyped-budget', '2');
  await type('item-retyped-sourcePage', '3');
  await f.change(first, {
    stage: 'draft',
    pack: { ...pack, provenance: { ...pack.provenance, edition: 'Concurrent edition' } },
  });
  await press('item-save');
  await drain();
  expect(shown('editor-item-form')).toBe(true);
  expect(field('item-title').props.value).toBe('تصحيح مختلق لم يُحفظ');
  expect(field('item-retyped-budget').props.value).toBe('2');
  expect([...(await readPackReleases(f.editor, f.server.send)).values()][0].revision).toBe(2);
});

test('a failed history read blocks creation, and published releases cannot be edited', async () => {
  const f = await packService();
  const fail = () => Promise.reject(new Error('Synthetic offline'));
  await show(<PacksPage {...f.editor} packs={[]} send={fail} />);
  await drain();
  await press('draft-new');
  expect(shown('editor-source-form')).toBe(false);
  await unmount();
  await f.published();
  await show(<PacksPage {...f.editor} packs={[]} send={f.server.send} />);
  await drain();
  expect(shown('draft-open-2026.1')).toBe(false);
});

test('a new manual pack has no saved placeholder, and saves only after its first checked item', async () => {
  const f = await packService();
  await show(<PacksPage {...f.editor} packs={[]} send={f.server.send} />);
  await drain();
  await press('draft-new');
  await type('source-id', pack.id);
  await type('source-release', pack.release);
  await type('source-issuer', 'Synthetic issuer');
  await type('source-edition', 'Synthetic edition');
  await press('source-keep');
  expect((await readPackReleases(f.editor, f.server.send)).size).toBe(0);
  await press('draft-add');
  await type('item-id', 'first');
  await type('item-title', 'درس أول مختلق');
  await type('item-week', '1');
  await type('item-retyped-week', '1');
  await type('item-sourcePage', '1');
  await type('item-retyped-sourcePage', '1');
  await press('item-save');
  await drain();
  const saved = [...(await readPackReleases(f.editor, f.server.send)).values()][0];
  expect(saved.pack.items).toHaveLength(1);
  expect(saved.pack.items[0].id).toBe('first');
});
