// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The human review of a pack release (#614, R-4.3-08, R-4.3-16, answer 768).
// Two people, a curator and a subject maintainer, compare the release with the
// page images and the release before it, and it is published only once both
// have approved it, each their latest word counting. An inspector may review as
// well: that is never counted as either of the two, nor shown as official
// approval, and their name is kept only with their consent. A draft starts with
// no review, so any edit asks both again.

import { isDay, type Day } from './day.ts';
import { isFields } from './read.ts';

export const REVIEW_ROLES = ['curator', 'maintainer', 'inspector'] as const;
export type ReviewRole = (typeof REVIEW_ROLES)[number];
export type ReviewVerdict = 'approved' | 'changes';

export interface PackReview {
  readonly role: ReviewRole;
  readonly verdict: ReviewVerdict;
  /** The reviewer's name; null for an inspector who gave no consent to be credited. */
  readonly name: string | null;
  readonly note: string;
  readonly day: Day;
}

export const NAME_MOST = 80;
export const NOTE_MOST = 500;
export const REVIEWS_MOST = 20;

const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const CONTROLS = new RegExp(CONTROL.source, 'gu');
const reads = (text: string, most: number) => text.length <= most && !CONTROL.test(text);

/** A review as a release's record may hold it, or null when it does not read. */
export function readPackReview(value: unknown): PackReview | null {
  if (!isFields(value)) return null;
  const { role, verdict, name, note, day } = value;
  if (Object.keys(value).some((key) => !['role', 'verdict', 'name', 'note', 'day'].includes(key))) return null;
  if (!REVIEW_ROLES.includes(role as ReviewRole) || (verdict !== 'approved' && verdict !== 'changes')) return null;
  if (typeof note !== 'string' || !reads(note, NOTE_MOST) || typeof day !== 'string' || !isDay(day)) return null;
  if (name === null ? role !== 'inspector' : typeof name !== 'string' || name.trim() === '' || !reads(name, NAME_MOST))
    return null;
  return { role: role as ReviewRole, verdict, name: name as string | null, note, day };
}

/** A person's name to compare, whatever its spacing, case or compatibility forms. */
const folded = (name: string) => name.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase();
const samePerson = (a: string, b: string) => folded(a) === folded(b);

/** What a person typed, as a review holds it: no control or format characters, nor spaces at its ends. */
export const reviewText = (text: string) => text.replace(CONTROLS, '').trim();

/** Each role's latest word on the release. */
export function latestReviews(reviews: readonly PackReview[]): ReadonlyMap<ReviewRole, PackReview> {
  return new Map(reviews.map((review) => [review.role, review]));
}

/** Whether two different people, a curator and a subject maintainer, stand approved. */
export function reviewsDone(reviews: readonly PackReview[]): boolean {
  const latest = latestReviews(reviews);
  const curator = latest.get('curator');
  const maintainer = latest.get('maintainer');
  return (
    curator?.verdict === 'approved' &&
    maintainer?.verdict === 'approved' &&
    curator.name !== null &&
    maintainer.name !== null &&
    !samePerson(curator.name, maintainer.name)
  );
}
