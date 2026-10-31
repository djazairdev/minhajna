// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world kit module on a PC (#561) gives what Node's crypto and the phone's
// native code give: the vectors below were made by Node with made-up inputs,
// and the phone's WorldCryptoTest checks the same ones, at the world's 600,000
// rounds. A seal that does not open is null; a fresh seal opens, an empty one
// too; a pair's halves sign and check, its fingerprint the SHA-256 of its SPKI,
// and a pair the phone made checks; it agrees on P-256 as Node does, and
// refuses a point off the curve (#570); it refuses what the phone refuses; and
// every failure is E_WORLD_KIT, saying nothing of the bytes.

import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { describe, it } from 'node:test';
import WorldKit from '../src/native/WorldKit.ts';
import { worldKit } from '../src/native/world-kit.ts';

const SECRET = '4d4144455550574f524c44534543524554';
const SALT = '6d696e68616a6e612f776f726c642f4142434445';
const KEY = '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
const PLAIN = '7b226d616465223a227570227d';
const SEALED = '000102030405060708090a0b0a126cf6acb843312d5ec26319905eea2db3bba4ddc3b6fcc62e682acc';
const SEALED_EMPTY = '000102030405060708090a0b656e7780606eefe387a3453712bd950a';
/** An agreement Node made on P-256 (#570): its private half, another's point, and the bits they agree on. */
const AGREEMENT = {
  pkcs8:
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgohIwywKShdnSLjEHQZr4RcOlGe0IRa8HLN7HbdNK' +
    'KG6hRANCAATE1weEa+3KK3MP+4teu9jNvPYZQTvOm1JoHkCgxhy1M02mVL6EEK9TjofoHkYPTcuWijlxuKVLmUbK4kWZzmJO',
  peer:
    '0471b28ea1c5aaa2a8de43d57ca5d4937578e6b022054a4bac19c03d1612a18887' +
    'b78f81138fc20c93de43eeed64205421211d2e1c0f3556e2765c21239718ab7d',
  agreed: 'e2f4f74ef9a375f6f27e02f7d46f3ff681ab551971cbdc02683154d4bd9a10d9',
};
/** A pair the phone made on an emulator, its private half thrown away, and its signature of `minhajna/world/ABCDE`. */
const PHONE = {
  spki:
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8D0r6wKlfnOX9qGhO0WZr7foI9IEc9AjhRbqafQBBAkQ' +
    'dqEfRW2sgrO/QPY0h14CCnk6QLwG0qZs9hxyBFkQ4g==',
  signed: 'MEYCIQCxFv7crlklbBYI3FSxk52VZfVHxd4kVLPKomL+cIoyMwIhAJsfvcXSlkwSRbUxleW3SxIWllYyT0sNsk34S8iddtNr',
};

describe('the world kit module on a PC', () => {
  it('agrees on P-256 as Node and the phone do, and refuses a point off the curve', async () => {
    assert.equal(await WorldKit.agree(AGREEMENT.pkcs8, AGREEMENT.peer), AGREEMENT.agreed);
    const [one, other] = [await WorldKit.newAgreement(), await WorldKit.newAgreement()];
    assert.match(one.publicKey, /^04[0-9a-f]{128}$/u);
    assert.equal(await WorldKit.agree(one.pkcs8, other.publicKey), await WorldKit.agree(other.pkcs8, one.publicKey));
    const off = AGREEMENT.peer.slice(0, -2) + (AGREEMENT.peer.endsWith('7d') ? '7c' : '7d');
    await assert.rejects(WorldKit.agree(AGREEMENT.pkcs8, off), { code: 'E_WORLD_KIT' });
    await assert.rejects(WorldKit.agree(AGREEMENT.pkcs8, AGREEMENT.peer.slice(2)), { code: 'E_WORLD_KIT' });
  });

  it('may always connect, as the page’s policy names the demo server', () => {
    assert.equal(WorldKit.canConnect(), true);
  });

  it('derives and MACs as Node and the phone do', async () => {
    const derived = await WorldKit.derive(SECRET, SALT, 600_000);
    assert.equal(derived, '6371282357f1bc9d3d403bf482bcd2afa02b49196c9cdb4da7be443f3f0fa3cd');
    assert.equal(
      await WorldKit.derive(SECRET, SALT, 1),
      'de2c6629050d05745e5d309a8cd0e72dd9adf7ff84a1a3fbcb802b65cea64cd6',
    );
    assert.equal(
      await WorldKit.derive(SECRET, '', 1),
      '312fabd6c0b7056c8d027d0de7eec56ab9a7b4a3dde13264d80a6aba5df56641',
    );
    const pass = Buffer.from('minhajna/world/pass').toString('hex');
    assert.equal(await WorldKit.mac(derived, pass), '0cec5f50794fc39e0fa88a70417dfc5ea2d720461645c38b1a247e75f51813ff');
  });

  it('opens what Node sealed, and nothing changed', async () => {
    assert.equal(await WorldKit.open(KEY, SEALED, SALT), PLAIN);
    assert.equal(await WorldKit.open(KEY, SEALED_EMPTY, SALT), '');
    assert.equal(await WorldKit.open(KEY, await WorldKit.seal(KEY, '', SALT), SALT), '');
    const changed = SEALED.slice(0, 40) + (SEALED[40] === '0' ? '1' : '0') + SEALED.slice(41);
    assert.equal(await WorldKit.open(KEY, changed, SALT), null);
    assert.equal(await WorldKit.open(KEY, SEALED, Buffer.from('minhajna/world/FGHIJ').toString('hex')), null);
    assert.equal(await WorldKit.open(KEY.slice(0, 32), SEALED, SALT), null);
    assert.equal(await WorldKit.open(KEY, SEALED.slice(0, 24), SALT), null);
    const sealed = await WorldKit.seal(KEY, PLAIN, SALT);
    assert.notEqual(sealed.slice(0, 24), (await WorldKit.seal(KEY, PLAIN, SALT)).slice(0, 24));
    assert.equal(await WorldKit.open(KEY, sealed, SALT), PLAIN);
  });

  it('makes a pair whose halves sign and check, its fingerprint the SHA-256 of its SPKI', async () => {
    const pair = await WorldKit.newPair();
    const spki = Buffer.from(pair.spki, 'base64');
    assert.equal(pair.fingerprint, createHash('sha256').update(spki).digest('hex'));
    const text = 'minhajna/world/ABCDE\nمثال تجريبي';
    const signed = Buffer.from(await WorldKit.sign(pair.pkcs8, text), 'base64');
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    assert.equal(verify('sha256', Buffer.from(text), key, signed), true);
    assert.equal(verify('sha256', Buffer.from(`${text}.`), key, signed), false);
  });

  it('checks a pair the phone made, as Node does', async () => {
    const spki = Buffer.from(PHONE.spki, 'base64');
    const text = 'minhajna/world/ABCDE';
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    assert.equal(verify('sha256', Buffer.from(text), key, Buffer.from(PHONE.signed, 'base64')), true);
    assert.equal(await worldKit.verify(PHONE.spki, text, PHONE.signed), true);
    assert.equal(await worldKit.verify(PHONE.spki, `${text}.`, PHONE.signed), false);
    assert.equal(
      createHash('sha256').update(spki).digest('hex'),
      '90e491053328fd6dff141a7eeee2708baad8cbec8e38b5da87637a60481052b8',
    );
  });

  it('answers E_WORLD_KIT for any failure, saying nothing of the bytes', async () => {
    for (const failing of [
      () => WorldKit.derive('zz', SALT, 1),
      () => WorldKit.mac('', '00'),
      () => WorldKit.seal(KEY.slice(0, 30), PLAIN, SALT),
      () => WorldKit.open('0F', SEALED, SALT),
      () => WorldKit.sign('not a key', 'text'),
      () => WorldKit.derive('', SALT, 1),
      () => WorldKit.seal(KEY.slice(0, 32), PLAIN, SALT),
      () => WorldKit.seal(KEY.slice(0, 48), PLAIN, SALT),
      async () => WorldKit.sign((await WorldKit.newPair()).pkcs8, '\uD800'),
    ]) {
      await assert.rejects(failing(), (error: Error & { code?: string }) => {
        assert.equal(error.code, 'E_WORLD_KIT');
        assert.doesNotMatch(error.message, /[0-9a-f]{8}|not a key/u);
        return true;
      });
    }
  });
});
