// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The worker can request only a bundled CMap or permitted standard font,
// never a PDF-supplied address, path, query or credential. Non-embedded
// Helvetica uses the browser's system substitution, not the package's
// GPL-2.0 Liberation font files, which the build deliberately excludes.

export class PdfAssets {
  async fetch({ kind, filename }: { readonly kind: string; readonly filename: string }): Promise<Uint8Array> {
    const folder =
      kind === 'cMapUrl' && /^[A-Za-z0-9_-]+\.bcmap$/u.test(filename)
        ? 'cmaps'
        : kind === 'standardFontDataUrl' && /^Foxit[A-Za-z]+\.pfb$/u.test(filename)
          ? 'standard_fonts'
          : null;
    if (folder === null) throw new Error('E_PDF_ASSET');
    const response = await fetch(new URL(`./pdf-assets/${folder}/${filename}`, import.meta.url), {
      credentials: 'omit',
    });
    if (!response.ok) throw new Error('E_PDF_ASSET');
    return new Uint8Array(await response.arrayBuffer());
  }
}
