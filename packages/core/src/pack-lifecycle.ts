// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pack editor's release lifecycle (#612, PRD section 4.3), prepared on
// the device for a national demo world. Source status and lifecycle stage
// are separate. A publisher is an account on the demo server (pack-step.ts).
// Only that world's Ministry account publishes an Official pack. Published
// content is immutable; a correction has another release. Revisions stop
// stale edits, and dates never go backwards. The codec signs every change
// and supplies the world's signed publication file before it may travel.

import { compareDays, isDay, type Day } from './day.ts';
import { compareReleases } from './pack-catalogue.ts';
import { readPackReview, REVIEWS_MOST, reviewsDone, type PackReview } from './pack-review.ts';
import { parsePlanPack, type PlanPack } from './pack.ts';
import { isWorldId } from './world-code.ts';

/** A refused release operation, distinct from platform or relay failures. */
export class PackReleaseError extends RangeError {
  readonly code: `E_PACK_${string}`;

  constructor(code: `E_PACK_${string}`) {
    super(code);
    this.code = code;
  }
}

export const PACK_STAGES = ['draft', 'under-review', 'published', 'superseded', 'withdrawn'] as const;
export type PackStage = (typeof PACK_STAGES)[number];
export type PackPublisher = 'curator' | 'ministry';

export interface PackRelease {
  readonly world: string;
  readonly pack: PlanPack;
  readonly stage: PackStage;
  readonly revision: number;
  readonly actor: PackPublisher;
  readonly day: Day;
  readonly file: string | null;
  /** Historical successor. Use publishedPackSuccessor to resolve its current status. */
  readonly supersededBy: string | null;
  /** The world's CA's signature over this step, once the server took it (pack-step.ts); null until then. */
  readonly attested: string | null;
  /** The reviews since it last went under review (pack-review.ts). */
  readonly reviews: readonly PackReview[];
}

export type PackChange =
  | { readonly stage: 'draft'; readonly pack: PlanPack }
  | { readonly stage: 'under-review'; readonly review?: Omit<PackReview, 'day'> }
  | { readonly stage: 'published' | 'withdrawn' }
  | { readonly stage: 'superseded'; readonly by: string };

export interface PackReleaseScope {
  readonly world: string;
  readonly day: Day;
  readonly actor: PackPublisher;
  readonly expected: number;
}

export const packReleaseKey = (id: string, release: string): string => `${id}@${release}`;

/** The published end of a replacement chain, or null if it was withdrawn. */
export function publishedPackSuccessor(
  release: PackRelease,
  releases: ReadonlyMap<string, PackRelease>,
): PackRelease | null {
  let current = release;
  while (current.stage === 'superseded' && current.supersededBy !== null) {
    const next = releases.get(packReleaseKey(current.pack.id, current.supersededBy));
    if (
      next === undefined ||
      next.world !== current.world ||
      next.pack.id !== current.pack.id ||
      !(compareReleases(next.pack.release, current.pack.release) > 0)
    )
      return null;
    if (next.stage === 'published') return next;
    current = next;
  }
  return null;
}

function reviewsAfter(current: PackRelease | null, change: PackChange, day: Day): readonly PackReview[] {
  if (change.stage === 'draft' || current === null) return [];
  if (change.stage !== 'under-review') return current.reviews;
  return change.review === undefined ? [] : [...current.reviews, { ...change.review, day }];
}

export function preparePackRelease(
  current: PackRelease | null,
  change: PackChange,
  scope: PackReleaseScope,
  successor: PackRelease | null = null,
): PackRelease {
  if (!isWorldId(scope.world) || !isDay(scope.day) || !['curator', 'ministry'].includes(scope.actor))
    throw new PackReleaseError('E_PACK_WORLD');
  if (!PACK_STAGES.includes(change.stage)) throw new PackReleaseError('E_PACK_STAGE');
  if (!Number.isSafeInteger(scope.expected) || scope.expected !== (current?.revision ?? 0) || scope.expected < 0)
    throw new PackReleaseError('E_PACK_CHANGED');
  if (current !== null && (current.world !== scope.world || compareDays(scope.day, current.day) < 0))
    throw new PackReleaseError('E_PACK_WORLD');
  if (!Number.isSafeInteger(scope.expected + 1)) throw new PackReleaseError('E_PACK_CHANGED');
  let pack: PlanPack;
  if (change.stage === 'draft') {
    const read = parsePlanPack(change.pack);
    if (!read.ok || (scope.actor === 'curator' && read.value.status === 'official'))
      throw new PackReleaseError('E_PACK_SOURCE');
    pack = read.value;
    if (
      current !== null &&
      (!['draft', 'under-review'].includes(current.stage) ||
        current.actor !== scope.actor ||
        current.pack.id !== pack.id ||
        current.pack.release !== pack.release)
    )
      throw new PackReleaseError('E_PACK_STAGE');
  } else {
    if (current === null) throw new PackReleaseError('E_PACK_STAGE');
    pack = current.pack;
    if (change.stage === 'under-review') {
      const review = change.review;
      if (current.actor !== scope.actor || current.stage !== (review === undefined ? 'draft' : 'under-review'))
        throw new PackReleaseError('E_PACK_STAGE');
      if (
        review !== undefined &&
        (current.reviews.length >= REVIEWS_MOST || readPackReview({ ...review, day: scope.day }) === null)
      )
        throw new PackReleaseError('E_PACK_REVIEW');
    } else if (change.stage === 'published') {
      if (current.stage !== 'under-review' || (current.actor !== scope.actor && scope.actor !== 'ministry'))
        throw new PackReleaseError('E_PACK_STAGE');
      if (!reviewsDone(current.reviews)) throw new PackReleaseError('E_PACK_REVIEW');
      if (scope.actor === 'curator' && pack.status === 'official') throw new PackReleaseError('E_PACK_SOURCE');
      if (scope.actor === 'ministry') {
        const official = { ...pack, status: 'official' as const };
        delete official.staleReason;
        pack = official;
      }
    } else {
      if (current.stage !== 'published' || current.actor !== scope.actor || current.file === null)
        throw new PackReleaseError('E_PACK_STAGE');
      if (
        change.stage === 'superseded' &&
        (successor === null ||
          successor.world !== scope.world ||
          successor.stage !== 'published' ||
          successor.file === null ||
          successor.actor !== current.actor ||
          compareDays(successor.day, scope.day) > 0 ||
          successor.pack.id !== pack.id ||
          successor.pack.release !== change.by ||
          compareReleases(successor.pack.release, pack.release) <= 0)
      )
        throw new PackReleaseError('E_PACK_SUCCESSOR');
    }
  }
  return {
    world: scope.world,
    pack,
    stage: change.stage,
    revision: scope.expected + 1,
    actor: scope.actor,
    day: scope.day,
    file: change.stage === 'superseded' || change.stage === 'withdrawn' ? current!.file : null,
    supersededBy: change.stage === 'superseded' ? change.by : null,
    attested: null,
    reviews: reviewsAfter(current, change, scope.day),
  };
}
