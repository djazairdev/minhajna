// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Makes the project's signing key pair, offline, on the holder's own
// computer (#223, answer 304; docs/checks/signed-updates.md):
//
//   node packages/core/scripts/make-key.ts --id <key-id> --out <folder>
//     --holder-ar <name> --holder-fr <name> --holder-en <name>
//     [--signs calendar,packs]
//
// The key signs what --signs lists, both kinds unless told otherwise; an
// IGP key for its official packs alone would list packs (answer 327).
// It asks for a passphrase twice and writes the private half, encrypted
// under it, to <folder>/<key-id>.private.pem, readable by its owner only
// on macOS and Linux. It refuses a folder inside any Git working copy and
// never overwrites a file.
// It prints the entry to add to data/dz/keys.json, and the fingerprint to
// publish where teachers and inspectors can compare it.

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { SIGNED_KINDS } from '../src/index.ts';
import { isOneOf } from '../src/read.ts';
import { insideRepository, makeKey, PASSPHRASE_LENGTH } from './signing.ts';
import { askHidden, run } from './terminal.ts';

run(async () => {
  const { values } = parseArgs({
    options: {
      id: { type: 'string' },
      out: { type: 'string' },
      'holder-ar': { type: 'string' },
      'holder-fr': { type: 'string' },
      'holder-en': { type: 'string' },
      signs: { type: 'string' },
    },
  });
  const { id, out } = values;
  const signs = (values.signs ?? SIGNED_KINDS.join(',')).split(',');
  if (!signs.every((kind) => isOneOf(SIGNED_KINDS, kind))) throw new Error(`--signs lists ${SIGNED_KINDS.join(', ')}.`);
  if (id === undefined || out === undefined || values['holder-ar'] === undefined)
    throw new Error(
      'Usage: make-key.ts --id <key-id> --out <folder> --holder-ar <name> [--holder-fr ...] [--holder-en ...] [--signs ...]',
    );
  if (insideRepository(out))
    throw new Error('Choose a folder outside any Git working copy, so the private half is never committed.');
  const holder = Object.fromEntries(
    (['ar', 'fr', 'en'] as const).flatMap((language) => {
      const name = values[`holder-${language}`];
      return name === undefined ? [] : [[language, name]];
    }),
  );
  const path = join(out, `${id}.private.pem`);
  if (existsSync(path)) throw new Error(`${path} already exists; a key is never overwritten.`);
  const passphrase = await askHidden(`Passphrase (at least ${PASSPHRASE_LENGTH} characters): `);
  if ((await askHidden('The same passphrase again: ')) !== passphrase) throw new Error('The passphrases differ.');
  const key = makeKey(id, holder, passphrase, signs);
  writeFileSync(path, key.privatePem, { flag: 'wx', mode: 0o600 });
  process.stdout.write(
    [
      `Private half: ${path}. Keep it and its passphrase offline; never share either.`,
      `Fingerprint to publish: ${key.entry.fingerprint.match(/.{4}/g)!.join(' ')}`,
      'Add this entry to the "keys" of data/dz/keys.json:',
      JSON.stringify(key.entry, null, 2),
      '',
    ].join('\n'),
  );
});
