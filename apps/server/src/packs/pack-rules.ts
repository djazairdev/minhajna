// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A release's life on the server (#612, R-4.3-06, R-4.3-09, answer 767): what
// each step of a pack release may be, and for which account. A release moves
// through draft, under review, published, then superseded or withdrawn. Only
// the account that holds a release moves it, but the Ministry's account may
// publish what a curator has under review, and what it publishes is Official;
// no curator's step ever is. The server sees a release's name, stage and
// status and a keyed digest of its content, never its content, and signs each
// step it allows with the world's stand-in CA key over the text below, which
// no certificate's text can be, so a device can tell what the account did. A
// device shows the step it read, signed, so the server need hold no release's
// state: the sealed stream takes one record a revision and decides which of two
// steps counts, and no step left unused can hold a release back.
// packages/core/src/pack-step.ts rebuilds the same text.

export const PACK_ROLES = ['curator', 'ministry'] as const;
export type PackRole = (typeof PACK_ROLES)[number];

const STAGES = ['draft', 'under-review', 'published', 'superseded', 'withdrawn'] as const;
const STATUSES = ['official', 'in-force', 'latest-found', 'stale', 'community', 'example'] as const;
type PackStage = (typeof STAGES)[number];

const PACK_ID = /^[a-z0-9-]+(?:\.[a-z0-9-]+){4,5}$/;
const RELEASE = /^[0-9]{4}\.[0-9]{1,4}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** What a device asks of the server for one step of a release. */
export interface PackStepRequest {
  readonly id: string;
  readonly release: string;
  /** The revision the device read, which this step follows; 0 for a new release. */
  readonly expected: number;
  readonly stage: PackStage;
  readonly status: string;
  /** The content's digest, keyed so that only the world's devices can make or check it. */
  readonly digest: string;
  /** The release that replaces this one, for a step to superseded. */
  readonly by: string | null;
  /** The world's date the device read. */
  readonly day: string;
  /** The step this one follows, as the server signed it; null for a new release. */
  readonly previous: SignedStep | null;
  /** The latest step of the release a step to superseded names, as the server signed it. */
  readonly successor: SignedStep | null;
}

/** A step a device read from the sealed stream, with the signature that proves it was taken. */
export type SignedStep = Omit<PackStep, 'id' | 'release'> & { readonly release: string };

/** A step as the server keeps and signs it. */
export interface PackStep extends Omit<PackStepRequest, 'expected' | 'previous' | 'successor'> {
  readonly revision: number;
  readonly role: PackRole;
  readonly signature: string;
}

const FIELDS = ['id', 'release', 'expected', 'stage', 'status', 'digest', 'by', 'day', 'previous', 'successor'];
const STEP_FIELDS = ['release', 'revision', 'stage', 'role', 'status', 'digest', 'by', 'day', 'signature'];
const SIGNATURE = /^[A-Za-z0-9+/=]{12,96}$/;

/** A signed step in a body, or null when it isn't shaped as one. */
function readSigned(value: unknown): SignedStep | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== STEP_FIELDS.length || !STEP_FIELDS.every((field) => keys.includes(field))) return null;
  const { release, revision, stage, role, status, digest, by, day, signature } = value as Record<string, unknown>;
  const reads =
    typeof release === 'string' &&
    RELEASE.test(release) &&
    Number.isSafeInteger(revision) &&
    (revision as number) >= 1 &&
    STAGES.includes(stage as PackStage) &&
    PACK_ROLES.includes(role as PackRole) &&
    STATUSES.includes(status as (typeof STATUSES)[number]) &&
    typeof digest === 'string' &&
    DIGEST.test(digest) &&
    (by === null || (typeof by === 'string' && RELEASE.test(by))) &&
    typeof day === 'string' &&
    DAY.test(day) &&
    typeof signature === 'string' &&
    SIGNATURE.test(signature);
  return reads ? (value as SignedStep) : null;
}

/** The request in a body, or why it is refused. */
export function readStepRequest(body: unknown): PackStepRequest | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'a step is a JSON object';
  const keys = Object.keys(body);
  if (keys.length !== FIELDS.length || !FIELDS.every((field) => keys.includes(field))) {
    return `a step has ${FIELDS.join(', ')}, and nothing else`;
  }
  const { id, release, expected, stage, status, digest, by, day, previous, successor } = body as Record<
    string,
    unknown
  >;
  if (typeof id !== 'string' || !PACK_ID.test(id) || id.length > 128) return 'id must be a pack ID';
  if (typeof release !== 'string' || !RELEASE.test(release)) return 'release must be a release number';
  if (!Number.isSafeInteger(expected) || (expected as number) < 0 || (expected as number) >= Number.MAX_SAFE_INTEGER) {
    return 'expected must be a whole number from 0';
  }
  if (!STAGES.includes(stage as PackStage)) return `stage must be one of ${STAGES.join(', ')}`;
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return `status must be one of ${STATUSES.join(', ')}`;
  if (typeof digest !== 'string' || !DIGEST.test(digest)) return 'digest must be 32 bytes in base64url';
  if (typeof day !== 'string' || !DAY.test(day)) return 'day must be written YYYY-MM-DD';
  if (stage === 'superseded' ? typeof by !== 'string' || !RELEASE.test(by) : by !== null) {
    return 'by names the release that replaces this one, and only for a step to superseded';
  }
  const shown = previous === null ? null : readSigned(previous);
  const after = successor === null ? null : readSigned(successor);
  if ((previous !== null && shown === null) || (successor !== null && after === null)) {
    return 'previous and successor are steps as the server signed them';
  }
  return {
    id,
    release,
    expected: expected as number,
    stage: stage as PackStage,
    status: status as string,
    digest,
    by: by as string | null,
    day,
    previous: shown,
    successor: after,
  };
}

const compareReleases = (a: string, b: string): number => {
  const [yearA = 0, fixA = 0] = a.split('.').map(Number);
  const [yearB = 0, fixB = 0] = b.split('.').map(Number);
  return yearA - yearB || fixA - fixB;
};

/**
 * Why this account may not take this step, or null. `at` is the step the device
 * read, and `successor` the latest step of the release a step to superseded
 * names, each already checked against its signature. Whether a step's digest
 * and status are the release's own is for the devices, which read the release.
 */
export function refusal(
  request: PackStepRequest,
  role: PackRole,
  at: SignedStep | null,
  successor: SignedStep | null,
): string | null {
  const { stage, status } = request;
  if (role === 'curator' && status === 'official') return "only the Ministry's account has Official packs";
  if (stage === 'draft') {
    if (request.expected === 0) return null;
    if (at === null || !['draft', 'under-review'].includes(at.stage)) return 'this release is no longer a draft';
    return at.role === role ? null : 'another account holds this release';
  }
  if (at === null) return 'this release has no step to follow';
  if (stage === 'under-review') {
    if (at.stage !== 'draft' && at.stage !== 'under-review') return 'only a draft goes under review';
    return at.role === role ? null : 'another account holds this release';
  }
  if (stage === 'published') {
    if (at.stage !== 'under-review') return 'only a release under review is published';
    if (role === 'ministry') return status === 'official' ? null : "what the Ministry's account publishes is Official";
    return at.role === role ? null : 'another account holds this release';
  }
  if (at.stage !== 'published') return 'only a published release is superseded or withdrawn';
  if (at.role !== role) return 'another account holds this release';
  if (stage === 'withdrawn') return null;
  const replaces =
    successor !== null &&
    successor.stage === 'published' &&
    successor.role === role &&
    compareReleases(successor.release, request.release) > 0;
  return replaces ? null : 'the release that replaces this one must be published, later, and of this account';
}

/** The text the world's CA signs for a step. */
export function packStepText(world: string, step: Omit<PackStep, 'signature'>): string {
  const { id, release, revision, stage, role, status, by, day, digest } = step;
  const fields = [id, release, revision, stage, role, status, by ?? '', day, digest];
  return ['minhajna/pack-step/1', world, ...fields].join('\n');
}
