// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signs a calendar update with the project's key, offline (#223, answers
// 304 and 305; docs/checks/signed-updates.md):
//
//   node packages/core/scripts/sign-update.ts --key <key-id>.private.pem
//     --id <key-id> --in <update.json> --out <signed.json>
//
// It asks for the key's passphrase, reads the update against the bundled
// calendar, signs it, opens the result with the keys data/dz/keys.json
// lists as the phone would, and only then writes it. It never overwrites a
// file. The output ends in .json, the only kind the phone's file picker
// offers, and the tool says whether it also fits one QR code.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { openPrivateKey, readBundled, signUpdate } from './signing.ts';
import { askHidden, run } from './terminal.ts';

run(async () => {
  const { values } = parseArgs({
    options: { key: { type: 'string' }, id: { type: 'string' }, in: { type: 'string' }, out: { type: 'string' } },
  });
  const { key: pem, id, in: input, out } = values;
  if (pem === undefined || id === undefined || input === undefined || out === undefined)
    throw new Error('Usage: sign-update.ts --key <private.pem> --id <key-id> --in <update.json> --out <signed.json>');
  if (!out.endsWith('.json')) throw new Error('The output must end in .json, the only kind the phone opens.');
  if (existsSync(out)) throw new Error(`${out} already exists; choose another name.`);
  const update = JSON.parse(readFileSync(input, 'utf8')) as unknown;
  const key = openPrivateKey(readFileSync(pem, 'utf8'), await askHidden('Passphrase: '));
  const signed = await signUpdate(update, key, id, readBundled());
  writeFileSync(out, signed.file, { flag: 'wx' });
  const { release, published, entries, removed } = signed.update;
  process.stdout.write(
    [
      `Signed release ${release} of ${published}. Entries set: ${entries.length}; removed: ${removed.length}.`,
      `Written to ${out}, ${signed.bytes} bytes;`,
      signed.qr ? 'it also fits one QR code.' : 'too large for one QR code: file only.',
      '',
    ].join('\n'),
  );
});
