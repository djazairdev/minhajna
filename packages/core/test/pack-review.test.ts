// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The human review of a release (#614, R-4.3-08, R-4.3-16): two different
// people approve it before it is published, a later word counts, an edit asks
// them again, and an inspector counts for neither and is named only with
// consent.
// Every name, note and pack here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractionArtefacts,
  packReleaseKey,
  packReleaseRecords,
  readPackReview,
  reviewText,
  reviewsDone,
  signPackRelease,
  type PackRelease,
} from '../src/index.ts';
import { country, mathPack } from './fixtures.ts';
import { approval, day, fixture, source } from './pack-lifecycle-fixtures.ts';

const under = async (f: ReturnType<typeof fixture>): Promise<PackRelease> => {
  const draft = await f.change(null, { stage: 'draft', pack: source });
  return f.change(draft, { stage: 'under-review' });
};

describe('a release under review', () => {
  it('is published only when a curator and a maintainer, two people, stand approved', async () => {
    const f = fixture();
    let review = await under(f);
    await assert.rejects(f.change(review, { stage: 'published' }), /E_PACK_REVIEW/);
    review = await f.change(review, { stage: 'under-review', review: approval('curator', 'Made-up Curator') });
    await assert.rejects(f.change(review, { stage: 'published' }), /E_PACK_REVIEW/);
    const same = await f.change(review, { stage: 'under-review', review: approval('maintainer', ' made-up curator ') });
    await assert.rejects(f.change(same, { stage: 'published' }), /E_PACK_REVIEW/);
    const other = await f.change(same, { stage: 'under-review', review: approval('maintainer', 'Made-up Maintainer') });
    const published = await f.change(other, { stage: 'published' });
    assert.equal(published.stage, 'published');
    assert.equal(published.reviews.length, 3);
  });

  it('counts the latest word of each role, so a request for changes stops it', async () => {
    const f = fixture();
    const approved = await f.approved(await under(f));
    const asked = { stage: 'under-review' as const, review: approval('maintainer', 'Made-up Maintainer', 'changes') };
    const changed = await f.change(approved, asked);
    await assert.rejects(f.change(changed, { stage: 'published' }), /E_PACK_REVIEW/);
    assert.equal(reviewsDone(approved.reviews), true);
    assert.equal(reviewsDone(changed.reviews), false);
  });

  it('an inspector counts for neither of the two, and an edit asks both again', async () => {
    const f = fixture();
    const review = await under(f);
    const inspected = await f.change(review, { stage: 'under-review', review: approval('inspector', null) });
    await assert.rejects(f.change(inspected, { stage: 'published' }), /E_PACK_REVIEW/);
    const approved = await f.approved(inspected);
    const edited = await f.change(approved, { stage: 'draft', pack: source });
    assert.deepEqual(edited.reviews, []);
    const again = await f.change(edited, { stage: 'under-review' });
    await assert.rejects(f.change(again, { stage: 'published' }), /E_PACK_REVIEW/);
  });

  it('takes no review on a draft, and another account adds none', async () => {
    const f = fixture();
    const draft = await f.change(null, { stage: 'draft', pack: source });
    const word = { stage: 'under-review' as const, review: approval('curator', 'Made-up Curator') };
    await assert.rejects(f.change(draft, word), /E_PACK_STAGE/);
    const review = await f.change(draft, { stage: 'under-review' });
    await assert.rejects(f.change(review, word, 'ministry'), /E_PACK_STAGE/);
  });

  it('replays with its reviews, which the step binds, and refuses them changed', async () => {
    const f = fixture();
    const published = await f.published();
    const read = await packReleaseRecords(f.records, f.keys, country, day, f.authority);
    assert.deepEqual(read.get(packReleaseKey(source.id, '2026.1')), published);
    const g = fixture();
    const review = await under(g);
    const signed = await g.change(review, { stage: 'under-review', review: approval('curator', 'Made-up Curator') });
    const forged = await signPackRelease({ ...signed, reviews: [approval('curator', 'Someone Else')] }, g.keys, g.sign);
    const again = await packReleaseRecords([...g.records.slice(0, -1), forged.file], g.keys, country, day, g.authority);
    assert.equal(again.get(packReleaseKey(source.id, source.release))?.reviews.length, 0);
  });
});

describe('a signed step that breaks the review rules', () => {
  const key = packReleaseKey(source.id, source.release);
  const replayed = async (f: ReturnType<typeof fixture>, next: PackRelease) => {
    const attested = await f.attest({ ...next, attested: null });
    f.records.push((await signPackRelease(attested, f.keys, f.sign)).file);
    return (await packReleaseRecords(f.records, f.keys, country, day, f.authority)).get(key);
  };

  it('never publishes without both approvals, even when the server signs it', async () => {
    const f = fixture();
    const review = await under(f);
    const read = await replayed(f, { ...review, stage: 'published', revision: review.revision + 1 });
    assert.equal(read?.stage, 'under-review');
  });

  it('never drops a later request for changes', async () => {
    const f = fixture();
    const approved = await f.approved(await under(f));
    const asked = await f.change(approved, {
      stage: 'under-review',
      review: approval('maintainer', 'Made-up Maintainer', 'changes'),
    });
    const next = { ...asked, stage: 'published' as const, revision: asked.revision + 1, reviews: approved.reviews };
    assert.equal((await replayed(f, next))?.stage, 'under-review');
  });

  it('never carries approvals across a draft, or several in one step', async () => {
    const f = fixture();
    const approved = await f.approved(await under(f));
    const kept = await replayed(f, { ...approved, stage: 'draft', revision: approved.revision + 1 });
    assert.equal(kept?.revision, approved.revision);
    const g = fixture();
    const review = await under(g);
    const reviews = [approval('curator', 'Made-up Curator'), approval('maintainer', 'Made-up Maintainer')];
    const both = await replayed(g, { ...review, revision: review.revision + 1, reviews });
    assert.deepEqual(both?.reviews, []);
  });

  it('dates a review by the step, whatever it says', async () => {
    const f = fixture();
    const review = await under(f);
    const dated = { ...approval('curator', 'Made-up Curator'), day: '2099-01-01' };
    const taken = await f.change(review, { stage: 'under-review', review: dated });
    assert.equal(taken.reviews[0]?.day, taken.day);
  });
});

describe('a review as it reads', () => {
  it('needs a name, but for an inspector who gave no consent', () => {
    assert.deepEqual(readPackReview(approval('inspector', null)), approval('inspector', null));
    assert.equal(readPackReview(approval('curator', null)), null);
    assert.equal(readPackReview(approval('maintainer', '  ')), null);
    assert.equal(readPackReview({ ...approval('curator', 'A'), extra: 1 }), null);
    assert.equal(readPackReview({ ...approval('curator', 'A'), verdict: 'official' }), null);
    assert.equal(readPackReview({ ...approval('curator', 'A'), note: 'x'.repeat(501) }), null);
    assert.equal(readPackReview({ ...approval('curator', `A${String.fromCodePoint(0x202e)}`) }), null);
  });

  it('sees one person through spacing, case and compatibility forms', () => {
    const same = (a: string, b: string) => !reviewsDone([approval('curator', a), approval('maintainer', b)]);
    assert.equal(same('Made-up  Person', 'made-up person'), true);
    assert.equal(same('Made-up Person', 'Other Person'), false);
  });

  it('takes out of what is typed what a review may not hold', () => {
    assert.equal(reviewText(`  A${String.fromCodePoint(0x200d)}B${String.fromCodePoint(0x202e)} `), 'AB');
  });
});

describe('extraction artefacts', () => {
  it('names the items whose title holds one, and no others', () => {
    const [first, second] = mathPack.items;
    const pack = {
      ...mathPack,
      items: [{ ...first!, title: `Made-up ${String.fromCodePoint(0xfffd)}` }, second!, ...mathPack.items.slice(2)],
    };
    assert.deepEqual(extractionArtefacts(pack), [first!.id]);
    const shaped = { ...mathPack, items: [{ ...first!, title: String.fromCodePoint(0xfe8d) }] };
    assert.deepEqual(extractionArtefacts(shaped), [first!.id]);
    assert.deepEqual(extractionArtefacts(mathPack), []);
    const honoured = { ...mathPack, items: [{ ...first!, title: String.fromCodePoint(0xfdfa) }] };
    assert.deepEqual(extractionArtefacts(honoured), []);
    const ligature = { ...mathPack, items: [{ ...first!, title: String.fromCodePoint(0xfb01) }] };
    assert.deepEqual(extractionArtefacts(ligature), [first!.id]);
  });
});
