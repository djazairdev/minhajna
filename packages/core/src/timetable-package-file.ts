// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's timetable package as a file (#580, PRD §5.9, §7.4, answer 608):
// the teacher's part exactly as the school signed it for their channel
// (timetable-package.ts), its canonical text, signature and certificate, behind
// its own format, so a part received can be kept or carried as a file without
// signing it again. Reading a file is untrusted (§5.9): it checks, in order,
// its size; its format, the file's own fields and nothing else, as canonical
// text, past a byte order mark or line breaks at its end that saving or sharing
// may add, and the part's shape and canonical text, after which the school it
// names is known, though only as what the file claims; then that the content
// matches the signature, then the world the part names, then that the world's
// CA certified the signer. Real mode trusts no world, so it refuses every part
// that names one, as it refuses a statement signed in a world (answer 577);
// inside a world, a part of that world whose certificate its CA issued is
// accepted. Every part names a world until the state's CA exists to vouch for a
// real school's key. The world comes before the certification so that real
// mode, which trusts no CA, refuses a world's part in its own words. A refusal
// names the check that failed, and the school the part names when its shape
// read. Two limits: the demo's CA certifies any device a request names (answer
// 564), so inside a world any key it certified can sign a package; and a part
// names its teacher but is not bound to the one reading it, so the screen shows
// whose part it is.

import { canonicalJson } from './canonical.ts';
import { checkCertificate, isCertificate, type Certificate, type KeyChecker } from './certify.ts';
import { isTimetablePart, TIMETABLE_PART_FORMAT, type SignedPart, type TimetablePart } from './timetable-package.ts';
import { record, signedLine } from './timetable-record.ts';

/** The format a package file carries. */
export const TIMETABLE_PACKAGE_FORMAT = 'minhajna/timetable-package/1';

/** The most characters a package file may hold. */
export const PACKAGE_FILE_MOST = 200_000;

/** The checks a package file passes, in order. */
export const PACKAGE_CHECKS = ['size', 'format', 'signature', 'world', 'certified'] as const;

/** One check of a package file. */
export type PackageCheck = (typeof PACKAGE_CHECKS)[number];

/** Whom a reading trusts: in real mode no world, inside a world that world and its CA's key. */
export interface PackageTrust {
  readonly checker: KeyChecker;
  readonly world: { readonly id: string; readonly ca: string } | null;
}

/** A package file read: its part and signer, or the check it failed and the school it names when it read. */
export type PackageRead =
  | { readonly ok: true; readonly part: TimetablePart; readonly certificate: Certificate }
  | { readonly ok: false; readonly failed: PackageCheck; readonly school: string | null };

/** A signed part as a package file's text. */
export const packageFile = ({ text, signature, certificate }: SignedPart): string =>
  canonicalJson({ format: TIMETABLE_PACKAGE_FORMAT, text, signature, certificate });

function parsed(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** A package file's part and signer when every check passes for whom the reading trusts. */
export async function readPackageFile(saved: string, trust: PackageTrust): Promise<PackageRead> {
  const refused = (failed: PackageCheck, school: string | null = null): PackageRead => ({ ok: false, failed, school });
  if (saved.length > PACKAGE_FILE_MOST) return refused('size');
  let end = saved.length;
  while (end > 0 && (saved[end - 1] === '\n' || saved[end - 1] === '\r')) end -= 1;
  const file = saved.slice(saved.startsWith('\uFEFF') ? 1 : 0, end);
  const value = parsed(file);
  if (!record(value) || value.format !== TIMETABLE_PACKAGE_FORMAT) return refused('format');
  const { format, text, signature, certificate, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof text !== 'string' || typeof signature !== 'string')
    return refused('format');
  if (!isCertificate(certificate) || canonicalJson({ format, text, signature, certificate }) !== file) {
    return refused('format');
  }
  const part = parsed(text);
  if (!isTimetablePart(part) || canonicalJson(part) !== text) return refused('format');
  const school = part.schoolName;
  const line = signedLine(TIMETABLE_PART_FORMAT, certificate, text);
  const holds = await trust.checker.verify(certificate.publicKey, line, signature).catch(() => false);
  if (!holds) return refused('signature', school);
  const { world } = trust;
  if (world === null || part.world !== world.id || certificate.world !== world.id) return refused('world', school);
  if (!(await checkCertificate(certificate, world.id, world.ca, trust.checker))) return refused('certified', school);
  return { ok: true, part, certificate };
}
