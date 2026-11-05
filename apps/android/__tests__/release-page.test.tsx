// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release (#614, answer 768): the release's checks, the two-person review
// the core holds publishing to, an inspector named only by choice, the
// Ministry's Official publication, withdrawal after a question, and the map of
// who holds what, written out beside the drawing. Everything is made up.

import type { PackRelease } from '@minhajna/core';
import { act } from 'react-test-renderer';
import { press, rendered, show, shown, type, unmount } from '../jest/editor-form';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { source as clean, weekly } from '../jest/editor-source';
import { packService, reference } from '../jest/pack-release';
import { openWorld, type OpenWorld } from '../src/demo/world-mode';
import { Drawing } from '../src/drawing/drawing-kit';
import { keepPackAccount } from '../src/editor/pack-account';
import { PackDesk } from '../src/editor/PackDesk';
import { readPackReleases } from '../src/editor/pack-release-session';
import { leaveWorldNetwork } from '../src/network/world-network';

const NEXT = '2026.7';
const source = { ...clean, status: 'community' as const, release: NEXT };
let teacher: FakeStorage;
async function drain() {
  await act(async () => {
    for (let i = 0; i < 40; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}
beforeEach(() => {
  teacher = new FakeStorage();
});
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

type Service = Awaited<ReturnType<typeof packService>>;

async function open(f: Service, signedIn = true) {
  const fake = new FakeWorld(teacher);
  const found = {
    world: f.world.world,
    kind: 'national' as const,
    code: f.made.code,
    date: f.world.date,
    starter: signedIn ? f.made.starter : null,
  };
  const opened = await openWorld(found, teacher.asSpec(), fake.asSpec());
  if (!signedIn) return opened;
  await keepPackAccount(opened, 'curator', f.editor.accounts.curator!);
  return keepPackAccount(opened, 'ministry', f.editor.accounts.ministry!).then(() => opened);
}

function page(
  f: Service,
  opened: OpenWorld,
  role: 'curator' | 'ministry' = 'curator',
  at: 'releases' | 'reviews' = 'releases',
) {
  return (
    <PackDesk
      role={role}
      page={at}
      reference={reference}
      open={opened}
      held={f.editor.held}
      profile={reference.profile}
      kit={f.editor.kit}
      packs={[]}
      send={f.server.send}
    />
  );
}

async function underReview(f: Service, release = NEXT): Promise<PackRelease> {
  const draft = await f.change(null, { stage: 'draft', pack: { ...source, release } });
  return f.change(draft, { stage: 'under-review' });
}

async function opened(f: Service, role: 'curator' | 'ministry' = 'curator', release = NEXT) {
  await show(page(f, await open(f), role), 'en');
  await drain();
  await press(`release-open-${release}`);
  await drain();
}

const read = async (f: Service) => (await readPackReleases(f.editor, f.server.send)).values().next().value!;
const said = () => JSON.stringify(rendered().toJSON());
const disabled = (id: string) => rendered().root.findByProps({ testID: id }).props.disabled === true;

async function review(person: string, role: 'curator' | 'maintainer', button = 'review-approve') {
  await press(`review-role-${role}`);
  await type('review-name', person);
  await press(button);
  await drain();
}

test('a release is published only after a curator and another person, a maintainer, both agree', async () => {
  const f = await packService();
  await underReview(f);
  await opened(f);
  expect(disabled('release-publish')).toBe(true);
  await review('Made-up Curator', 'curator');
  expect(disabled('release-publish')).toBe(true);
  await review('MADE-UP CURATOR', 'maintainer');
  expect(disabled('release-publish')).toBe(true);
  await review('Made-up Maintainer', 'maintainer');
  expect(disabled('release-publish')).toBe(false);
  await press('release-publish');
  await drain();
  const done = await read(f);
  expect(done.stage).toBe('published');
  expect(done.actor).toBe('curator');
  expect(done.pack.status).toBe('community');
  expect(done.reviews.map((one) => one.name)).toContain('Made-up Maintainer');
  expect(shown('review-form')).toBe(false);
});

test('a request for changes holds the release back', async () => {
  const f = await packService();
  await underReview(f);
  await opened(f);
  await review('Made-up Curator', 'curator');
  await review('Made-up Maintainer', 'maintainer', 'review-changes');
  expect(disabled('release-publish')).toBe(true);
  expect(said()).toContain('Changes requested');
});

test('a check that fails holds the release back, even with both approvals', async () => {
  const f = await packService();
  const pack = { ...weekly, status: 'community' as const, release: NEXT };
  const draft = await f.change(null, { stage: 'draft', pack });
  const sent = await f.change(draft, { stage: 'under-review' });
  await f.approved(sent);
  await opened(f);
  expect(disabled('release-publish')).toBe(true);
  expect(said()).toContain('A check above still holds this release back');
  await type('release-weeks', '1');
  expect(disabled('release-publish')).toBe(false);
});

test('an inspector is named only by choice, and their word never counts', async () => {
  const f = await packService();
  await underReview(f);
  await opened(f);
  await press('review-role-inspector');
  expect(shown('review-name')).toBe(false);
  await press('review-approve');
  await drain();
  expect((await read(f)).reviews).toEqual([expect.objectContaining({ role: 'inspector', name: null })]);
  expect(said()).toContain('isn’t an official approval');
  await press('review-role-inspector');
  await press('review-credit');
  await type('review-name', 'Made-up Inspector');
  await press('review-approve');
  await drain();
  expect((await read(f)).reviews.at(-1)!.name).toBe('Made-up Inspector');
  expect(disabled('release-publish')).toBe(true);
});

test('the Ministry reads the reviews and publishes the release as Official', async () => {
  const f = await packService();
  await f.approved(await underReview(f));
  await opened(f, 'ministry');
  expect(shown('review-form')).toBe(false);
  await press('release-publish');
  await drain();
  const done = await read(f);
  expect(done.actor).toBe('ministry');
  expect(done.pack.status).toBe('official');
});

test('withdrawing asks first, and a later release can replace an older one', async () => {
  const f = await packService();
  await f.published('2026.5');
  await f.published('2026.6');
  await opened(f, 'curator', '2026.5');
  expect(shown('release-withdraw-confirm')).toBe(false);
  await press('release-withdraw');
  await press('release-withdraw-cancel');
  expect(shown('release-withdraw-confirm')).toBe(false);
  await press('release-supersede');
  await drain();
  const all = await readPackReleases(f.editor, f.server.send);
  expect([...all.values()].find((one) => one.pack.release === '2026.5')!.supersededBy).toBe('2026.6');
  await press('release-back');
  await press('release-open-2026.6');
  await press('release-withdraw');
  await press('release-withdraw-confirm');
  await drain();
  const again = await readPackReleases(f.editor, f.server.send);
  expect([...again.values()].find((one) => one.pack.release === '2026.6')!.stage).toBe('withdrawn');
});

test('a broken history says so, and an older published release compares with its past', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack: { ...source, release: '2026.2' } });
  for (const release of ['2026.5', '2026.6'])
    await f.change(await f.approved(await underReview(f, release)), { stage: 'published' });
  await show(page(f, await open(f)), 'en');
  await drain();
  await press('release-open-2026.2');
  expect(said()).toContain('doesn’t fit its history');
  await press('release-back');
  await press('release-open-2026.5');
  expect(said()).toContain('first release');
});

test('a whitespace name leaves approval off, and a name is cleaned of format characters', async () => {
  const f = await packService();
  await underReview(f);
  await opened(f);
  await type('review-name', '   ');
  expect(disabled('review-approve')).toBe(true);
  await type('review-name', `Made-up${String.fromCodePoint(0x200d)} Curator`);
  await press('review-approve');
  await drain();
  expect((await read(f)).reviews[0].name).toBe('Made-up Curator');
});

test('the Ministry can withdraw what it published', async () => {
  const f = await packService();
  await f.approved(await underReview(f));
  await opened(f, 'ministry');
  await press('release-publish');
  await drain();
  await press('release-withdraw');
  await press('release-withdraw-confirm');
  await drain();
  expect((await read(f)).stage).toBe('withdrawn');
});

test('a device with no account reads the release and takes no step', async () => {
  const f = await packService();
  await f.approved(await underReview(f));
  await show(page(f, await open(f, false), 'curator', 'reviews'), 'en');
  await drain();
  await press(`release-open-${NEXT}`);
  expect(disabled('release-publish')).toBe(true);
  expect(disabled('review-approve')).toBe(true);
});

test('the map shows who holds what, the same words beside it, and only the words without a drawing', async () => {
  const f = await packService();
  await underReview(f);
  await opened(f);
  expect(shown('release-view-map')).toBe(false);
  expect(said()).toContain('no content');
  expect(said()).toContain('the sealed record');
  await unmount();
  const spec = jest.fn();
  const kit = {
    Chart: () => null,
    Map: (props: { spec: unknown }) => {
      spec(props.spec);
      return null;
    },
  };
  await show(<Drawing.Provider value={kit}>{page(f, await open(f))}</Drawing.Provider>, 'en');
  await drain();
  await press(`release-open-${NEXT}`);
  await press('release-view-map');
  const [drawn] = spec.mock.lastCall as [{ nodes: { id: string }[]; links: { from: string; idle?: boolean }[] }];
  expect(drawn.nodes.map((one) => one.id)).toContain('teachers');
  expect(drawn.links.filter((one) => one.from === 'space' && one.idle)).toHaveLength(1);
  expect(shown('release-map-text')).toBe(true);
  expect(said()).toContain('no content');
});
