// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A source is selected locally, never accepted as an address. File names,
// paths and document metadata are not part of the output or of an error.

export async function sourceBytes(file: Blob): Promise<Uint8Array> {
  if (file.size === 0 || file.size > 32 * 1024 * 1024) throw new Error('E_PDF_LIMIT');
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') throw new Error('E_PDF_FORMAT');
  return data;
}
