// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a committee's cut shaped the exam, in its own words (#606, answer 640):
// only a seat that adopted the cut has the words, after the exam's last day,
// the highest version counting, the lower text at a tie; no words count with no
// cut adopted or with no cut; words not signed by the seat they name, of
// another committee, malformed or too long do not read, and stop no others; the
// words stream stands apart from the votes', and names nothing in clear. Every
// world and committee is made up.

import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync, sign as nodeSign } from 'node:crypto';
import { describe, it } from 'node:test';
import type { SealedBatch } from '../src/batches.ts';
import {
  canonicalJson,
  COMMITTEE_WORDS,
  committeePlace,
  parseDay,
  readWords,
  sealWords,
  signWords,
  wordsPlace,
  wordsRead,
  wordsThatCount,
  WORDS_LENGTH,
  type CommitteeName,
  type CommitteeWords,
  type WorldSigner,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { cipher, mac } from './world-crypto.ts';

const { verify } = keySigner();
const sign: WorldSigner = (pkcs8, text) => {
  const key = createPrivateKey({ key: Buffer.from(pkcs8, 'base64'), format: 'der', type: 'pkcs8' });
  return Promise.resolve(nodeSign('sha256', Buffer.from(text, 'utf8'), key).toString('base64'));
};
const newPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    spki: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    pkcs8: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  };
};

const name: CommitteeName = { world: 'K7QF4', scope: 'dir-1', exam: 'mock', subject: 'math', grade: '4am' };
const last = parseDay('2030-05-10');
const after = parseDay('2030-05-11');
const words = (seat: number, text: string, version = 0, day = after): CommitteeWords => ({
  ...name,
  seat,
  words: text,
  day,
  version,
});
const adopted = { adopted: { item: 'u6', seats: [0, 2], day: parseDay('2030-04-28') } };
const count = (...all: CommitteeWords[]) =>
  wordsThatCount(
    all.map((one) => ({ words: one })),
    adopted,
    last,
  );

describe('a committee’s words', () => {
  it('count from a seat that adopted the cut, after the exam, the highest version, the lower text at a tie', () => {
    assert.equal(count(), null);
    assert.equal(count(words(0, 'first'))?.words, 'first');
    assert.equal(count(words(1, 'not of the majority')), null);
    assert.equal(count(words(0, 'on the last day', 0, last)), null);
    assert.equal(count(words(0, 'first'), words(2, 'second', 1), words(0, 'older', 0))?.words, 'second');
    assert.equal(count(words(0, 'b'), words(0, 'a'))?.words, 'a');
    assert.equal(count(words(0, 'a'), words(0, 'b'))?.words, 'a');
    assert.equal(count(words(2, 'same'), words(0, 'same'))?.seat, 0);
    const found = [{ words: words(0, 'first') }];
    assert.equal(wordsThatCount(found, { adopted: null }, last), null);
    const none = { adopted: { item: null, seats: [0, 2], day: after } };
    assert.equal(wordsThatCount(found, none, last), null);
  });

  it('are one to 600 characters, with no control character, trimmed, in NFC', () => {
    assert.equal(wordsRead('a'), true);
    assert.equal(wordsRead('a'.repeat(WORDS_LENGTH)), true);
    assert.equal(wordsRead('a'.repeat(WORDS_LENGTH + 1)), false);
    assert.equal(wordsRead('😀'.repeat(WORDS_LENGTH)), true);
    assert.equal(wordsRead('😀'.repeat(WORDS_LENGTH + 1)), false);
    const bad = ['', ' a', 'a ', 'a\nb', 'a\u0000b', 'a\u001fb', 'a\u007fb', 'a\u0085b', 'e\u0301'];
    const hidden = ['a\u202eb', '\u200b', 'a\u2028b', 'a\u00adb', 'a\ud83d'];
    for (const one of [...bad, ...hidden, 1, null]) assert.equal(wordsRead(one), false);
  });

  it('read only when well-formed and signed by the seat they name, of this committee, under its key', async () => {
    const sealing = new Uint8Array(32).fill(7);
    const [one, two] = [newPair(), newPair()];
    const room = { name, seats: [one.spki, two.spki] };
    const place = await wordsPlace(sealing, name, mac);
    assert.notEqual(place.stream, (await committeePlace(sealing, name, mac)).stream);
    const batches: SealedBatch[] = [];
    const raw = async (value: unknown) =>
      batches.push(...(await sealWords(place, value as never, batches.length, cipher)));
    const put = async (value: CommitteeWords, pkcs8: string) => raw(await signWords(value, pkcs8, sign));
    await put(words(0, 'marker-one'), one.pkcs8);
    await put(words(1, 'marker-wrong-key'), one.pkcs8);
    const others: Partial<CommitteeName>[] = [
      { world: 'B7QF4' },
      { scope: 'dir-2' },
      { exam: 'other' },
      { subject: 'arabic' },
      { grade: '3am' },
    ];
    for (const other of others) await put({ ...words(1, 'marker-other'), ...other }, two.pkcs8);
    const signed = async (text: string) =>
      raw({ text, signature: await sign(two.pkcs8, `${COMMITTEE_WORDS}\n${text}`) });
    await signed('{"seat":1}');
    await signed(canonicalJson({ ...words(1, 'marker-more'), more: 1 }));
    await signed(canonicalJson({ ...words(1, 'marker-more'), words: 'a'.repeat(WORDS_LENGTH + 1) }));
    await signed(` ${canonicalJson(words(1, 'marker-space'))}`);
    const wrong = [
      { version: -1 },
      { version: 1.5 },
      { seat: -1 },
      { seat: 0.5 },
      { day: '2030-02-30' },
      { grade: 'a b' },
    ];
    for (const more of wrong) await signed(canonicalJson({ ...words(1, 'marker-bad'), ...more }));
    const bare = canonicalJson(words(1, 'marker-bare'));
    await raw({ text: bare, signature: await sign(two.pkcs8, bare) });
    for (const value of [null, [], 'text', { text: 1, signature: 'x' }]) await raw(value);
    const long = await signWords(words(1, '😀'.repeat(WORDS_LENGTH)), two.pkcs8, sign);
    const longest = await sealWords(place, long, batches.length, cipher);
    assert.equal(longest.length, 2);
    batches.push(...longest);
    const read = await readWords(place, batches, room, verify, cipher);
    assert.deepEqual(
      read.map((each) => each.words.seat),
      [0, 1],
    );
    assert.equal(read[0]?.words.words, 'marker-one');
    assert.equal(read[1]?.words.words, '😀'.repeat(WORDS_LENGTH));
    const noSeat = await signWords(words(2, 'marker-no-seat'), two.pkcs8, sign);
    const sealed = await sealWords(place, noSeat, 0, cipher);
    assert.deepEqual(await readWords(place, sealed, room, () => Promise.resolve(true), cipher), []);
    await assert.rejects(signWords(words(0, ' bad'), one.pkcs8, sign), RangeError);
    const refusing = () => Promise.reject(new Error('A made-up refusal'));
    assert.deepEqual(await readWords(place, batches, room, refusing, cipher), []);
    const clear = batches.map((each) => new TextDecoder().decode(each.bytes)).join('');
    assert.equal(/marker|committee-words/u.test(clear + place.stream), false);
  });
});
