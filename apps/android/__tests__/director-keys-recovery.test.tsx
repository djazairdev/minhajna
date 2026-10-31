// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' recovery in a national demo world (#571, answers 556 to 558 and
// 599), against a made-up demo server: the recovery's tab makes the recovery
// from two new parts, says so, shows them once in their groups with the
// screen guarded as for a PIN pad, and they recover the keyring the store now
// holds while the map counts no more devices; each sheet prints in its own
// job, naming the school, the day and the fingerprint; the parts stay through
// a change of tab, a failed reading and both prints, until the director says
// both are printed; renewing asks first, then gives new parts the old ones no
// longer follow; a printing or a making that fails says so and keeps what it
// had; a double tap makes one recovery, and so does a change of tab while it
// is made; and a keyring that changed behind the page is read again rather
// than renewed unasked. Every world, school and device is
// made up.

import {
  directorSchool,
  eventOf,
  keysFacts,
  latestHeld,
  makeRecoveryParts,
  readRecoveryKey,
  recoverKeyring,
  seedNationalWorld,
  type Entry,
  type SchoolCalendar,
} from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { DemoServer, nodeKit } from '../jest/world-server';
import { recoveryDevice } from '../src/demo/recovery-device';
import { failed, startWorld } from '../src/demo/world-session';
import * as issueSession from '../src/director/issue-session';
import * as keysSession from '../src/director/keys-session';
import { SchoolKeys } from '../src/director/SchoolKeys';
import type { FakeLock } from '../jest/fake-lock';
import NativeLock from '../src/native/NativeMinhajnaLock';
import pdf from '../src/native/NativeMinhajnaPdf';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';
import { currentLanguage } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const server = new DemoServer();
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let printHtml: jest.SpiedFunction<typeof pdf.printHtml>;
const words = text.demo.keys;
const lock = NativeLock as unknown as FakeLock;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  printHtml = jest.spyOn(pdf, 'printHtml');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const rings = (entries: readonly Entry[]) => [
  null,
  ...entries.flatMap((one) => {
    const event = eventOf(one);
    return event?.kind === 'school.held' ? [event.held.ring] : [];
  }),
];

async function press(testID: string, times = 1) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      const button = tree!.root.findAllByProps({ testID })[0];
      if (turn === 0) for (let one = 0; one < times; one += 1) (button.props as PressableProps).onPress?.({} as never);
      await settle();
    });
}
const helds = (entries: readonly Entry[]) => rings(entries).length - 1;

/** A started world, a store of the director's own, and the seeded school. */
async function director() {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const open = { world: id, date: started.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  return { open, school };
}

async function page(
  open: Awaited<ReturnType<typeof director>>['open'],
  school: Awaited<ReturnType<typeof director>>['school'],
) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SchoolKeys world={open} school={school} kit={nodeKit} send={server.send} dayText={String} />,
    );
    await settle();
  });
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
  await press('keys-tab-recovery');
}

/** The parts the page shows, read back from their groups. */
const shownPart = (side: string) => {
  const groups = tree!.root
    .findAllByProps({ testID: `keys-part-${side}` })[0]
    .findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''))
    .filter((one) => /^[0-9A-Z]{4}$/u.test(one));
  return readRecoveryKey(groups.join(''));
};

test('the recovery is made, kept through tabs and both prints, and forgotten once both are said printed', async () => {
  const { open, school } = await director();
  await page(open, school);
  expect(texts()).toContain(words.recovery.make);
  await press('keys-recovery-make');
  expect(texts()).toContain(words.recovery.shown);
  expect(lock.guarded.at(-1)).toBe('pin');
  const parts = { school: shownPart('school')!, directorate: shownPart('directorate')! };
  expect(parts.school).not.toBeNull();
  expect(parts.directorate).not.toBeNull();
  const held = latestHeld(open.book.entries, 65)!;
  const desk = await issueSession.holdSchool(open, nodeKit, server.send);
  const facts = await keysFacts(held.ring, held.device, desk.crypto);
  expect(facts.devices).toHaveLength(1);
  expect(facts.recoveries).toHaveLength(1);
  const device = recoveryDevice(nodeKit);
  expect(typeof (await recoverKeyring(held.school, rings(open.book.entries), parts, desk.crypto, device))).toBe(
    'object',
  );
  expect(texts()).toContain(words.count.replace('{{number}}', '1'));
  await press('keys-tab-holders');
  expect(has('keys-part-school')).toBe(false);
  await press('keys-tab-recovery');
  expect(shownPart('school')).toBe(parts.school);
  await press('keys-recovery-print-school');
  expect(has('keys-recovery-forget')).toBe(false);
  await press('keys-recovery-print-directorate');
  const [[first, firstTitle], [second, secondTitle]] = printHtml.mock.calls;
  expect([firstTitle, secondTitle]).toEqual([words.recovery.schoolTitle, words.recovery.directorateTitle]);
  expect(first).toContain(parts.school);
  expect(first).not.toContain(parts.directorate);
  expect(second).toContain(parts.directorate);
  expect(second).not.toContain(parts.school);
  expect(first).toContain(`<html lang="${currentLanguage()}" dir="ltr">`);
  expect(first).toContain(facts.fingerprint);
  expect(first).toContain(held.school.slice(0, 8));
  expect(first).toContain(String(open.date));
  expect(has('keys-part-school')).toBe(true);
  expect(texts()).toContain(words.recovery.askPrinted);
  await press('keys-recovery-forget');
  expect(has('keys-part-school')).toBe(false);
  expect(texts()).toContain(words.recovery.printed);
  expect(lock.guarded.at(-1)).toBe('records');
});

test('renewing asks first, and the old parts no longer follow the keyring', async () => {
  const { open, school } = await director();
  await page(open, school);
  await press('keys-recovery-make');
  const old = { school: shownPart('school')!, directorate: shownPart('directorate')! };
  await press('keys-recovery-print-school');
  await press('keys-recovery-print-directorate');
  await press('keys-recovery-forget');
  expect(texts()).toContain(words.recovery.renew);
  await press('keys-recovery-make');
  expect(texts()).toContain(words.recovery.renewAsk);
  await press('keys-recovery-cancel');
  expect(has('keys-recovery-renew')).toBe(false);
  const before = helds(open.book.entries);
  await press('keys-recovery-make');
  await press('keys-recovery-renew');
  expect(helds(open.book.entries)).toBeGreaterThan(before);
  expect(shownPart('school')).not.toBe(old.school);
  const held = latestHeld(open.book.entries, 65)!;
  const desk = await issueSession.holdSchool(open, nodeKit, server.send);
  expect((await keysFacts(held.ring, held.device, desk.crypto)).recoveries).toHaveLength(1);
  const device = recoveryDevice(nodeKit);
  expect(await recoverKeyring(held.school, rings(open.book.entries), old, desk.crypto, device)).toBe('replaced');
});

test('a failed printing or reading keeps the parts, and a failed making lets the button work again', async () => {
  const { open, school } = await director();
  await page(open, school);
  const making = jest.spyOn(keysSession, 'makeRecovery').mockRejectedValueOnce(failed('Made up', 'E_SCHOOL_KEY'));
  await press('keys-recovery-make');
  expect(texts()).toContain(text.demo.problem.store);
  making.mockRestore();
  jest.spyOn(issueSession, 'holdSchool').mockRejectedValueOnce(failed('Made up', 'E_NETWORK'));
  await press('keys-recovery-make');
  expect(texts()).toContain(words.count.replace('{{number}}', '1'));
  const part = shownPart('school');
  expect(part).not.toBeNull();
  printHtml.mockRejectedValueOnce(new Error('made-up failure'));
  await press('keys-recovery-print-school');
  expect(shownPart('school')).toBe(part);
  expect(texts()).toContain(text.demo.problem.other);
});

test('a double tap makes one recovery', async () => {
  const { open, school } = await director();
  await page(open, school);
  const before = helds(open.book.entries);
  await press('keys-recovery-make', 2);
  expect(helds(open.book.entries)).toBe(before + 1);
});

test('a change of tab while the recovery is made keeps the button waiting', async () => {
  const { open, school } = await director();
  await page(open, school);
  let done: (made: keysSession.MadeRecovery) => void = () => undefined;
  const pending = new Promise<keysSession.MadeRecovery>((resolve) => (done = resolve));
  jest.spyOn(keysSession, 'makeRecovery').mockReturnValueOnce(pending);
  await press('keys-recovery-make');
  await press('keys-tab-holders');
  await press('keys-tab-recovery');
  const button = tree!.root.findAllByProps({ testID: 'keys-recovery-make' })[0];
  expect((button.props as PressableProps).disabled).toBe(true);
  const parts = makeRecoveryParts(nodeKit.random);
  await ReactTestRenderer.act(async () => {
    done({ parts, fingerprint: '1-abcd-ef01-2345-6789' });
    await settle();
  });
  expect(shownPart('school')).toBe(parts.school);
  expect(keysSession.makeRecovery).toHaveBeenCalledTimes(1);
  expect(texts()).toContain(words.recovery.shown);
});

test('a keyring that gained a recovery behind the page is read again, not renewed unasked', async () => {
  const { open, school } = await director();
  await page(open, school);
  await keysSession.makeRecovery(open, await issueSession.holdSchool(open, nodeKit, server.send), nodeKit, 'make');
  const before = helds(open.book.entries);
  await press('keys-recovery-make');
  expect(helds(open.book.entries)).toBe(before);
  expect(texts()).toContain(words.recovery.changed);
  expect(texts()).toContain(words.recovery.renew);
  expect(has('keys-part-school')).toBe(false);
});
