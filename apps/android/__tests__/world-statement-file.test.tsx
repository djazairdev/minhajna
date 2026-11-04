// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How the world's statement leaves (#630, answer 725), against the jest server:
// the file holds the signed statement, saved on a PC and shared on a phone, and
// reads in its own world alone; a save given up says nothing, and a file that
// fails says so and may be tried again; a signature that fails says so, until
// what is said changes; a stale plan signs nothing; a statement too large for
// one code says so; the buttons wait while a step runs; and a second press
// while it signs does nothing. Every pupil, school and world here is made up.

import { checkStatement } from '@minhajna/core';
import { AccessibilityInfo, Platform, type PressableProps } from 'react-native';
import {
  act,
  has,
  leavePage,
  open,
  press,
  read,
  said,
  shown,
  statementWorld,
  texts,
  words,
} from '../jest/statement-world';
import { nodeKit as kit } from '../jest/world-server';
import files from '../src/native/NativeMinhajnaFiles';
import * as session from '../src/school/world-statement-session';
import ar from '../src/text/ar.json';

const signButton = () =>
  shown().root.findAllByProps({ testID: 'world-statement-sign' })[0].props as {
    disabled: boolean;
    onPress: () => void;
  };

test('the file holds the signed statement, saved on a PC, and the world’s reader keeps it', async () => {
  const made = await statementWorld();
  const text = jest.spyOn(files, 'makeText').mockResolvedValue('token');
  const saved = jest.spyOn(files, 'saveFile').mockResolvedValue(true);
  await open(made);
  await press('world-statement-sign');
  await press('world-statement-file');
  expect(saved).toHaveBeenCalledWith('token');
  expect(said()).toBe(ar.documents.output.saved);
  const [body, name] = text.mock.calls[0];
  expect(name.endsWith('.json')).toBe(true);
  expect(name).toContain(made.room.name);
  expect(name).toContain(made.subject);
  const verify = (spki: string, signed: string, signature: string) => kit.verify(spki, signed, signature);
  const checked = await checkStatement(body, verify, made.world.world);
  if (!checked.ok) throw new Error('The statement did not read in its world');
  expect((await checkStatement(body, verify)).ok).toBe(false);
  expect((await checkStatement(body, verify, 'K1MT9')).ok).toBe(false);
});

test('a save given up says nothing, and a file that fails says so and may be tried again', async () => {
  const made = await statementWorld();
  jest.spyOn(files, 'makeText').mockResolvedValue('token');
  const saved = jest.spyOn(files, 'saveFile');
  saved.mockClear();
  saved.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('Made up'));
  await open(made);
  await press('world-statement-sign');
  await press('world-statement-file');
  expect(said()).toBe(words.signed);
  await press('world-statement-file');
  expect(texts()).toContain(ar.demo.statement.pc.fileFailed);
  expect(has('world-statement-again')).toBe(false);
  expect(has('world-statement-made')).toBe(true);
  saved.mockResolvedValueOnce(true);
  await press('world-statement-file');
  expect(saved).toHaveBeenCalledTimes(3);
});

test('on a phone the file is shared and what is said is announced', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const made = await statementWorld();
  jest.spyOn(files, 'makeText').mockResolvedValue('token');
  const shared = jest.spyOn(files, 'shareFile').mockResolvedValue();
  await open(made);
  await press('world-statement-sign');
  expect(announced).toHaveBeenCalledWith(words.signed);
  await press('world-statement-file');
  expect(shared).toHaveBeenCalledWith('token', words.title);
  shared.mockRejectedValueOnce(new Error('Made up'));
  await press('world-statement-file');
  expect(texts()).toContain(ar.demo.statement.fileFailed);
  expect(announced).toHaveBeenCalledWith(ar.demo.statement.fileFailed);
});

test('a signature that fails says so, and changing what is said clears it', async () => {
  const made = await statementWorld();
  const pack = read.packs.find((one) => one.id === made.room.packs[made.code].id)!;
  const lesson = pack.items.find((one) => one.kind === 'lesson')!;
  const refused = { ...kit, sign: () => Promise.reject(new Error('Made up')) };
  await open(made, { kit: refused });
  await press('world-statement-sign');
  expect(texts()).toContain(ar.statement.failed);
  expect(has('world-statement-made')).toBe(false);
  await press(`world-statement-item-${lesson.id}`);
  expect(texts()).not.toContain(ar.statement.failed);
});

test('a stale plan signs nothing, saying so, and a problem is announced on a phone', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const made = await statementWorld();
  const stale = { ...read, packs: read.packs.map((one) => ({ ...one, status: 'stale' as const })) };
  await open(made, { reference: stale });
  await press('world-statement-sign');
  expect(texts()).toContain(ar.statement.failed);
  expect(announced).toHaveBeenCalledWith(ar.statement.failed);
  expect(has('world-statement-made')).toBe(false);
});

test('a statement too large for one code says so, and the buttons wait while a step runs', async () => {
  const code = jest.spyOn(session, 'statementCode').mockResolvedValue(null);
  await open(await statementWorld());
  await press('world-statement-sign');
  expect(code).toHaveBeenCalled();
  expect(has('world-statement-qr')).toBe(false);
  expect(texts()).toContain(ar.demo.statement.pc.tooBig);
  await leavePage();
  jest.replaceProperty(Platform, 'OS', 'android');
  const made = await statementWorld();
  let release: (signed: string) => void = () => undefined;
  const slow = { ...kit, sign: () => new Promise<string>((go) => (release = go)) };
  await open(made, { kit: slow });
  await act(() => signButton().onPress());
  expect(signButton().disabled).toBe(true);
  await act(() => release(''));
  await open(made);
  await press('world-statement-sign');
  expect(texts()).toContain(ar.demo.statement.tooBig);
});

test('a second press while it signs does nothing', async () => {
  const made = await statementWorld();
  const signing = jest.fn(kit.sign);
  await open(made, { kit: { ...kit, sign: signing } });
  await act(() => {
    const [button] = shown().root.findAllByProps({ testID: 'world-statement-sign' });
    (button.props as PressableProps).onPress?.({} as never);
    (button.props as PressableProps).onPress?.({} as never);
  });
  expect(signing).toHaveBeenCalledTimes(1);
  expect(has('world-statement-made')).toBe(true);
});
