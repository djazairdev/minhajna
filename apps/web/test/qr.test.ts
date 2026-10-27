// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's QR codes against the phone's (#250, part 3): the same texts give
// the same cells as ZXing 3.5.4 in Java, which the phone runs (QrRows.kt,
// StatementQr.kt). The SHA-256 of each code's rows, one line a row, was
// taken from that Java encoder on 27 October 2026. The second and fourth
// texts chose another mask, and the fourth another version, before the
// port's two differences were replaced with Java's. The texts are made up.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { shortRows, statementRows } from '../src/native/files/qr.ts';

const SHORT: [string, string][] = [
  ['made-up-code', 'ccde354d4908df72b0718ee5ecfabee1d497cb91b305cb8ff8de29199353f574'],
  ['minhajna-key:1:JH2SGRPRWR2HJRWGM7498N32', '72f4717d7f7e5f5c07f1bd05c7ea354f13b6d81cb816bdf1ff41dcc426f44cb3'],
  ['\u0645'.repeat(50), '4d2177feca5370c912c50771b2a3fda259f87513a138755b35f47a9841e3f729'],
];

const STATEMENTS: [string, string][] = [
  ['{"example":1}', '7c5788804f749944ed3655652cd1586ee8e45f4a29bfe4c85da3cb5cc90304f8'],
  ['x'.repeat(331), '9f7635c2a1a6df3a9e00990940af83c39d642cc9cacb9c5b12c6a85a6079da03'],
  ['x'.repeat(996), '900ff632254a63f38b8dfb88fc9d6439222816cb0b86f66120144702edd835a3'],
  ['\u0645'.repeat(498), '5312d79d6194d22c991d3713ad0681dd6a968ed219857bd1c2d7a5350bb6dc79'],
  ['😀'.repeat(249), 'b4de6f4aa8f32a3b50057120f9dfde6b05f82db2dcbb21b7e015f0ac38ead2f3'],
];

const digest = (rows: string) => createHash('sha256').update(rows).digest('hex');

describe("the PC's QR codes", () => {
  it("draw a short key's cells as the phone does", () => {
    for (const [text, java] of SHORT) assert.equal(digest(shortRows(text)), java, text);
  });

  it("draw a statement's cells, quiet zone included, as the phone does", () => {
    for (const [text, java] of STATEMENTS)
      assert.equal(digest(statementRows(text).join('\n')), java, text.slice(0, 20));
  });
});
