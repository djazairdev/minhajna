// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An entirely invented two-page PDF: text on one page, a drawn rectangle
// without text on the other. Its metadata and script are test markers.

export function pdfFixture(): Uint8Array<ArrayBuffer> {
  const stream = 'BT /F1 18 Tf 30 200 Td (2 Synthetic lesson title) Tj ET';
  const drawing = '0.3 0.5 0.4 rg 30 30 100 100 re f';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /OpenAction 8 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Length ${drawing.length} >>\nstream\n${drawing}\nendstream`,
    '<< /S /JavaScript /JS (globalThis.PDF_SCRIPT_RAN=true;) >>',
    '<< /Author (Synthetic private metadata marker) /Title (Not a lesson title) >>',
  ];
  let text = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((one, index) => {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${one}\nendobj\n`;
  });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  text += offsets
    .slice(1)
    .map((one) => `${String(one).padStart(10, '0')} 00000 n \n`)
    .join('');
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 9 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(text);
}
