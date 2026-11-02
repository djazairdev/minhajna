// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Source metadata shared by the file reader and the curator's empty form.
// A new plan may have no items yet locally; only a complete parsed pack
// may be saved to a world's release history.

import { readAnchor } from './pack-fields.ts';
import { LICENCE_MODES, PACK_ID, PACK_STATUSES, type PlanPack, type Provenance } from './pack.ts';
import { isFields, LANGUAGE, Reader, RELEASE, type ParseResult } from './read.ts';

export type PackSource = Pick<PlanPack, 'id' | 'release' | 'status' | 'licence' | 'language' | 'anchor' | 'provenance'>;

export function readPackSource(reader: Reader, input: Record<string, unknown>) {
  const id = reader.requiredText(input, 'id', '', PACK_ID);
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const status = reader.oneOf(input, 'status', '', PACK_STATUSES);
  const licence = reader.oneOf(input, 'licence', '', LICENCE_MODES);
  const language = reader.requiredText(input, 'language', '', LANGUAGE);
  const anchor = readAnchor(reader, input['anchor']);

  let provenance: Provenance = { issuer: '', edition: '' };
  const rawProvenance = input['provenance'];
  if (isFields(rawProvenance)) {
    const foundAt = reader.text(rawProvenance, 'foundAt', 'provenance');
    provenance = {
      issuer: reader.requiredText(rawProvenance, 'issuer', 'provenance'),
      edition: reader.requiredText(rawProvenance, 'edition', 'provenance'),
      ...(foundAt !== undefined && { foundAt }),
    };
  } else {
    reader.fail('provenance', rawProvenance === undefined ? 'required' : 'invalid');
  }

  return { id, release, status, licence, language, anchor, provenance };
}

/** Validates source metadata without inventing an item for an empty local draft. */
export function parsePackSource(input: unknown): ParseResult<PackSource> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  const source = readPackSource(reader, input);
  if (
    source.status === undefined ||
    source.licence === undefined ||
    source.anchor === undefined ||
    reader.problems.length > 0
  )
    return { ok: false, problems: reader.problems };
  return { ok: true, value: { ...source, status: source.status, licence: source.licence, anchor: source.anchor } };
}
