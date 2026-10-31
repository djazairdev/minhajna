// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school security key at its edges in a national demo world (#572, answer
// 602), against a made-up demo server and a made-up browser's WebAuthn: setting
// up asks the key with the PIN required, a discoverable credential on a
// cross-platform key, the security-key hint and the fixed PRF salt, under a
// user handle the same for a teacher each time and named with the key's number;
// a PRF output given at creation is used as it is, one of another length is
// refused, and otherwise the new credential alone is asked; a key without the
// PRF extension and a closed prompt are refused, each in its own words; signing
// in passes its abort signal to the browser. A setup whose joined record landed
// but went unanswered joins with the same signing key when set up again, and a
// key set up and joined is then refused without asking the key, its session
// still opening; another device joining while the key is set up is said; an
// erased world says so; a session put where another record took its number is
// put again; a key of one world opens nothing in another; a key without the PRF
// extension is said in the director's words before any certificate; and a code
// issue's text is never kept in a key. Every world, school, teacher and key is
// made up.

import { Platform } from 'react-native';
import { fakeBrowser, keyWorld, noBrowser, prfFrom } from '../jest/staff-key';
import { DemoServer, nodeKit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { keyCodeText } from '../src/director/issue-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { joinSchool } from '../src/school/school-join-session';
import { setUpKey, signInWithKey } from '../src/staff/key-session';
import { browserKey, type KeyHolder, type StaffKey } from '../src/staff/security-key';

const server = new DemoServer();

beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
  noBrowser();
});

type Options = { publicKey: Record<string, unknown> };
const closed = (name: string) => Object.assign(new Error('Made up'), { name });

/** A made-up key whose PRF output is fixed, noting whom it was set up for. */
function madeKey(first: number) {
  const holders: KeyHolder[] = [];
  const key: StaffKey = {
    setUp: (holder) => (holders.push(holder), Promise.resolve(prfFrom(first))),
    ask: () => Promise.resolve(prfFrom(first)),
  };
  return { key, holders };
}

/** The demo server's send, with the n-th request `matches` picks answered with `status` instead. */
function failing(matches: (method: string, path: string) => boolean, at: number, status: number): Send {
  let seen = 0;
  return (request) => {
    if (matches(request.method, request.path) && ++seen === at)
      return Promise.resolve({ status, body: null, retryAfter: null });
    return server.send(request);
  };
}

const batchPost = (method: string, path: string) => method === 'POST' && path.endsWith('/batches');

test('setting up asks the key as it should, and refuses no PRF, a wrong length and a closed prompt', async () => {
  const keys = fakeBrowser(() => prfFrom(4), { onCreate: true });
  const handle = Uint8Array.of(1, 2, 3);
  const holder = { teacher: 'Made Up', number: '0042', handle };
  expect(await browserKey(nodeKit.random)!.setUp(holder)).toEqual(prfFrom(4));
  expect(keys.get).not.toHaveBeenCalled();
  const { publicKey } = keys.create.mock.calls[0][0] as Options;
  expect(publicKey).toMatchObject({
    rp: { name: 'Minhajna' },
    user: { id: handle, name: 'Made Up', displayName: 'Made Up · 0042' },
    authenticatorSelection: {
      authenticatorAttachment: 'cross-platform',
      residentKey: 'required',
      userVerification: 'required',
    },
    hints: ['security-key'],
  });
  const salt = (publicKey.extensions as { prf: { eval: { first: Uint8Array } } }).prf.eval.first;
  expect(String.fromCharCode(...salt)).toBe('minhajna/staff-key/prf/1');
  fakeBrowser(() => prfFrom(4, 16), { onCreate: true });
  await expect(browserKey(nodeKit.random)!.setUp(holder)).rejects.toMatchObject({ code: 'E_KEY_PRF' });
  const later = fakeBrowser(() => prfFrom(5));
  expect(await browserKey(nodeKit.random)!.setUp(holder)).toEqual(prfFrom(5));
  const asked = (later.get.mock.calls[0][0] as Options).publicKey;
  expect(asked).toMatchObject({ userVerification: 'required', allowCredentials: [{ type: 'public-key' }] });
  const none = fakeBrowser(() => prfFrom(6), { enabled: false });
  await expect(browserKey(nodeKit.random)!.setUp(holder)).rejects.toMatchObject({ code: 'E_KEY_PRF' });
  none.create.mockRejectedValueOnce(closed('AbortError'));
  await expect(browserKey(nodeKit.random)!.setUp(holder)).rejects.toMatchObject({ code: 'E_KEY_CANCELLED' });
  none.create.mockRejectedValueOnce(closed('NotSupportedError'));
  await expect(browserKey(nodeKit.random)!.setUp(holder)).rejects.toMatchObject({ code: 'E_KEY_PRF' });
  const signal = new AbortController().signal;
  await browserKey(nodeKit.random)!.ask(signal);
  expect(none.get.mock.calls.at(-1)![0]).toMatchObject({ signal });
});

test('a setup whose joined record landed unanswered joins when set up again, and a joined key is refused', async () => {
  const made = await keyWorld(server);
  const issue = await made.issue('key');
  const { key, holders } = madeKey(1);
  const certificates = jest.fn();
  let posts = 0;
  const lost: Send = async (request) => {
    if (request.path.endsWith('/certificates')) certificates();
    const answer = await server.send(request);
    return batchPost(request.method, request.path) && ++posts === 2 ? { ...answer, status: 503 } : answer;
  };
  const setUp = (one: StaffKey) => setUpKey({ world: made.id }, made.desk, issue, made.names, one, nodeKit, lost);
  await expect(setUp(key)).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  await setUp(key);
  expect(certificates).toHaveBeenCalledTimes(1);
  expect(holders).toHaveLength(2);
  expect(holders[0].handle).toEqual(holders[1].handle);
  expect(holders[0].number).toBe(issue.keyNumber);
  const again = madeKey(2);
  await expect(setUp(again.key)).rejects.toMatchObject({ code: 'E_KEY_SET_UP' });
  expect(again.holders).toHaveLength(0);
  expect((await signInWithKey({ world: made.id }, key, nodeKit, server.send)).teacher).toBe(made.names.teacher);
});

test('another device joining while the key is set up is said, and an erased world says so', async () => {
  const made = await keyWorld(server);
  const issue = await made.issue('key');
  const text = await keyCodeText(made.id, made.desk, issue);
  let posts = 0;
  const raced: Send = async (request) => {
    if (batchPost(request.method, request.path) && ++posts === 1) await joinSchool(made.pc, text, nodeKit, server.send);
    return server.send(request);
  };
  const { key } = madeKey(9);
  await expect(setUpKey({ world: made.id }, made.desk, issue, made.names, key, nodeKit, raced)).rejects.toMatchObject({
    code: 'E_KEY_TAKEN',
  });
  server.reset();
  await expect(signInWithKey({ world: made.id }, key, nodeKit, server.send)).rejects.toMatchObject({
    code: 'E_NO_SUCH_WORLD',
  });
});

test('a taken number is put again, and a key opens nothing in another world', async () => {
  const made = await keyWorld(server);
  const { key } = madeKey(3);
  const raced = failing(batchPost, 1, 409);
  await setUpKey({ world: made.id }, made.desk, await made.issue('key'), made.names, key, nodeKit, raced);
  expect((await signInWithKey({ world: made.id }, key, nodeKit, server.send)).world).toBe(made.id);
  await expect(keyCodeText(made.id, made.desk, await made.issue('phone'))).rejects.toThrow(RangeError);
  leaveWorldNetwork();
  const other = await keyWorld(server);
  await expect(signInWithKey({ world: other.id }, key, nodeKit, server.send)).rejects.toMatchObject({
    code: 'E_KEY_NOT_SET',
  });
  const prf = fakeBrowser(() => prfFrom(8), { enabled: false });
  const browser = browserKey(nodeKit.random)!;
  await expect(
    setUpKey({ world: other.id }, other.desk, await other.issue('key'), other.names, browser, nodeKit, server.send),
  ).rejects.toMatchObject({ code: 'E_KEY_SETUP_PRF' });
  expect(prf.create).toHaveBeenCalledTimes(1);
});
