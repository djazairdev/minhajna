// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's timetable package in setup's week step (#580, Setup-5a,
// Setup-5c, answer 608): the step waits for it beside the drawn week and opens
// a file; a package signed in a demo world is refused in its own words, with
// the format and the school it claims passed and the world not, and nothing
// saved; a package changed after signing fails its signature; a file that is
// not a package, or too large, says so without a school; the school claimed is
// information, not a check passed; the reason is said as the refusal opens,
// announced on the phone and in the hidden live region on a PC; another file is
// opened from the refusal, one that cannot be read is said there, and going
// back, by the button or Android's back, returns to the week; a cancelled pick
// and a file that cannot be read keep the week; and the words read in every
// language. Every world, school and teacher is made up.

import {
  canonicalJson,
  certificateRequest,
  issueCertificate,
  newId,
  packageFile,
  PACKAGE_FILE_MOST,
  parseDay,
  signPart,
  type KeySigner,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { generateKeyPairSync, randomBytes, sign, verify, createPublicKey } from 'node:crypto';
import { AccessibilityInfo, BackHandler, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData } from '../jest/app-data';
import { calendarInput } from '../jest/calendar-input';
import { Week } from '../src/setup/Week';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.week.package;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  jest.restoreAllMocks();
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  calendarInput.readFile.mockReset();
  calendarInput.readFile.mockResolvedValue(null);
});

function signer(): KeySigner {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    sign: (text) => Promise.resolve(sign('sha256', Buffer.from(text, 'utf8'), privateKey).toString('base64')),
    verify: (key, text, signature) =>
      Promise.resolve(
        verify(
          'sha256',
          Buffer.from(text, 'utf8'),
          createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' }),
          Buffer.from(signature, 'base64'),
        ),
      ),
  };
}

async function worldPackage() {
  const [ca, director] = [signer(), signer()];
  const random = (length: number) => new Uint8Array(randomBytes(length));
  const request = await certificateRequest('K7QF4', newId(random), director);
  const certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca);
  const part = {
    world: 'K7QF4',
    school: 'S'.repeat(22),
    schoolName: 'متوسطة المختلقة',
    assignment: 'a'.repeat(32),
    issue: 1,
    teacher: 'مختلق',
    version: 1,
    from: parseDay('2026-12-06'),
    once: false,
    sessions: [],
    bells: [],
  };
  return packageFile(await signPart(part, certificate, director));
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 20; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
}
const press = (testID: string) =>
  act(() =>
    (
      tree!.root.find((node) => node.props.testID === testID && typeof node.props.onPress === 'function')
        .props as PressableProps
    ).onPress?.({} as never),
  );

async function render() {
  const data = await openTestData();
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <Week onDraw={jest.fn()} onResolve={jest.fn()} onTimes={jest.fn()} onNext={jest.fn()} />)}
      </LocaleDirContext.Provider>,
    );
  });
  return data;
}

test('a package signed in a demo world is refused in its own words, and nothing is saved', async () => {
  const data = await render();
  const before = data.book.entries.length;
  expect(texts()).toEqual(expect.arrayContaining([words.waitTitle, words.waiting, words.open, words.untilLine]));
  calendarInput.readFile.mockResolvedValueOnce(await worldPackage());
  await press('package-open');
  expect(has('package-refused')).toBe(true);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.refusedTitle,
      words.reason.world.title,
      words.reason.world.line,
      words.check.format,
      words.check.world,
      words.saved,
      words.todoWorld,
    ]),
  );
  expect(texts().some((one) => one.includes('متوسطة المختلقة'))).toBe(true);
  expect(['format', 'school', 'signature', 'world', 'certified'].map((row) => has(`package-check-${row}`))).toEqual([
    true,
    true,
    true,
    true,
    false,
  ]);
  expect(data.book.entries.length).toBe(before);
  const school = tree!.root.find(
    (node) => node.props.testID === 'package-check-school' && node.props.accessible === true,
  );
  expect((school.props as { accessibilityLabel: string }).accessibilityLabel).not.toContain(words.passed);
  await press('package-back');
  expect([has('package-refused'), has('package-wait')]).toEqual([false, true]);
});

test('the reason is said as the refusal opens, and Android’s back returns to the week', async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
  const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  await render();
  calendarInput.readFile.mockResolvedValueOnce('not a package');
  await press('package-open');
  expect(announced).toHaveBeenCalledWith(`${words.reason.format.title} ${words.reason.format.line}`);
  calendarInput.readFile.mockRejectedValueOnce(new Error('Made-up failure'));
  await press('package-another');
  expect([has('package-refused'), texts().includes(words.unreadable)]).toEqual([true, true]);
  await act(() => [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 })));
  expect([has('package-refused'), has('package-wait')]).toEqual([false, true]);
  jest.replaceProperty(Platform, 'OS', 'web');
  calendarInput.readFile.mockResolvedValueOnce(' '.repeat(PACKAGE_FILE_MOST + 1));
  await press('package-open');
  const said = tree!.root.find((node) => node.props.testID === 'package-said' && node.type === Text);
  expect((said.props as TextProps).children).toBe(`${words.reason.size.title} ${words.reason.size.line}`);
});

test('a changed package fails its signature, and a file not a package says so', async () => {
  await render();
  const value = JSON.parse(await worldPackage()) as { text: string };
  const changed = canonicalJson({ ...value, text: value.text.replace('مختلق"', 'مختلقة"') });
  calendarInput.readFile.mockResolvedValueOnce(changed);
  await press('package-open');
  expect(texts()).toEqual(expect.arrayContaining([words.reason.signature.title, words.todoSend]));
  calendarInput.readFile.mockResolvedValueOnce('not a package');
  await press('package-another');
  expect(texts()).toContain(words.reason.format.title);
  expect(has('package-check-school')).toBe(false);
  calendarInput.readFile.mockResolvedValueOnce(' '.repeat(PACKAGE_FILE_MOST + 1));
  await press('package-another');
  expect(texts()).toContain(words.reason.size.title);
  expect(has('package-check-format')).toBe(false);
});

test('a cancelled pick and an unreadable file keep the week', async () => {
  await render();
  await press('package-open');
  expect(has('package-wait')).toBe(true);
  calendarInput.readFile.mockRejectedValueOnce(new Error('Made-up failure'));
  await press('package-open');
  expect([has('package-wait'), texts().includes(words.unreadable)]).toEqual([true, true]);
});

test('the package words read in every language', () => {
  const flat = (value: unknown, path = ''): [string, string][] =>
    typeof value === 'string'
      ? [[path, value]]
      : Object.entries(value as object).flatMap(([key, inner]) => flat(inner, `${path}.${key}`));
  const places = (text: string) => (text.match(/\{\{\w+\}\}/gu) ?? []).sort();
  const arabic = flat(ar.week.package);
  for (const one of [en, fr]) {
    const theirs = new Map(flat(one.week.package));
    expect([...theirs.keys()].sort()).toEqual(arabic.map(([key]) => key).sort());
    for (const [key, value] of arabic) expect([key, places(theirs.get(key)!)]).toEqual([key, places(value)]);
  }
});
