// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What makes a pack release's step more than a claim (#612, R-4.3-09, answer
// 767). In a demo world anyone with the code can sign with the world's key, so
// the server's pack-editor accounts stand behind each step: the server signs
// one with the world's stand-in CA key, over the text below, as its
// apps/server/src/packs/pack-rules.ts writes it, for the account's role. It
// sees no release, so the step names the content by a digest keyed with the
// world's sealing key. A device rebuilds the text from the release it read, so
// a role, a status, or content other than what the account took fails.

import type { PackRelease } from './pack-lifecycle.ts';
import type { PlanPack } from './pack.ts';
import { ascii } from './school-key-shape.ts';
import { asciiJson } from './sealed-stream.ts';
import type { Verifier } from './signed-read.ts';
import { toBase64Url, type WorldMac } from './world-keys.ts';

/** What a device checks a release's step with: the world's CA key, and its sealing key for the digest. */
export interface PackAuthority {
  readonly caKey: string;
  readonly sealing: Uint8Array;
  readonly mac: WorldMac;
  readonly verify: Verifier;
}

/** The pack's digest, which only the world's devices can make or check. */
export async function packDigest(pack: PlanPack, sealing: Uint8Array, mac: WorldMac): Promise<string> {
  return toBase64Url(await mac(sealing, ascii(`minhajna/pack-digest/1\n${asciiJson(pack)}`)));
}

/** The text the world's CA signs for a release's step. */
export function packStepText(release: PackRelease, digest: string): string {
  const { world, pack, revision, stage, actor, supersededBy, day } = release;
  const fields = [pack.id, pack.release, revision, stage, actor, pack.status, supersededBy ?? '', day, digest];
  return ['minhajna/pack-step/1', world, ...fields].join('\n');
}

/** Whether the world's CA signed this release's step, for its role and its content. */
export async function packStepHolds(release: PackRelease, authority: PackAuthority): Promise<boolean> {
  if (release.attested === null) return false;
  const digest = await packDigest(release.pack, authority.sealing, authority.mac);
  return authority.verify(authority.caKey, packStepText(release, digest), release.attested);
}
