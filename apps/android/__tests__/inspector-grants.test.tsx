// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// I-Grant on the inspector's phone (#594, answer 622), on the made-up term of
// grant-term.ts: before any grant it says none reached the phone; once the
// director grants a request it shows the grant with its school, its end, its
// span and its classes counted, and 1م2 by its number with its two signed weeks
// until opened, then by its class and subject with its sessions held, not held
// without the reason, and taken by the calendar with the day, and no correction
// or visa; a school the directorate does not list is said so; past its end the
// grant says it ended and its class has no button; a use the server refuses is
// said as an alert, and the class opens on trying again; and its words read in
// every language, each with its plural forms. Every school, class, teacher and
// device is made up.

import { addDays, parseDay, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SCHOOL } from '../jest/grant-world';
import { grantTerm, STAFFED, WEEKS } from '../jest/grant-term';
import { MINE } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { approveGrant } from '../src/director/grant-make';
import { InspectorGrants, type InspectorGrantsProps } from '../src/inspector/InspectorGrants';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';
import { deliveryReading } from '../src/week/school-mine-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.inspectorGrant;
const day = (one: Day) => `day ${one}`;
const NAME = 'Made-up school of district 3';
const LATIN = 'CEM Made-up';
const reading = deliveryReading(MINE, [], []);
const YENNAYER = parseDay('2027-01-12');
/** The last working day of the second week. */
const END = parseDay('2027-01-14');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
});

const settle = async () => {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const said = (testID: string) =>
  tree!.root
    .findAll((node) => node.props.testID === testID && typeof node.type === 'string')
    .flatMap((node) => node.findAllByType(Text))
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const press = async (testID: string) => {
  const [button] = tree!.root.findAll(
    (node) => node.props.testID === testID && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(() => {
    (button.props as PressableProps).onPress?.({} as never);
  });
  await settle();
};

async function render(
  world: InspectorGrantsProps['world'],
  schools = [{ id: SCHOOL.id, name: NAME, latinName: LATIN }],
  send: Send = server.send,
) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <InspectorGrants
          world={world}
          directorate={SCHOOL.directorateId}
          schools={schools}
          reading={reading}
          workingDays={MINE.profile.workingDays}
          kit={kit}
          send={send}
          dayText={day}
        />
      </LocaleDirContext.Provider>,
    );
  });
  await settle();
}

test('it says no grant reached the phone, then shows the grant and opens its class', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  await render(inspector);
  expect(texts()).toEqual(expect.arrayContaining([words.title, words.none, words.foot, words.footLog]));
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  await render(inspector);
  const id = `inspector-grant-${grant.id}`;
  expect(texts()).not.toContain(words.none);
  const span = words.classWeeks
    .replace('{{weeks}}', words.weeks_two)
    .replace('{{from}}', day(WEEKS[0]))
    .replace('{{to}}', day(END));
  expect(texts()).toEqual(
    expect.arrayContaining([
      isolate(NAME),
      words.until.replace('{{until}}', day(grant.until)),
      words.made
        .replace('{{day}}', day(grant.from))
        .replace('{{from}}', day(WEEKS[0]))
        .replace('{{to}}', day(END))
        .replace('{{classes}}', words.classes_one),
      words.class.replace('{{number}}', '1'),
      span,
      words.openLine,
    ]),
  );
  await press(`${id}-class-1-open`);
  expect(said(`${id}-class-1`)).toEqual([
    words.named.replace('{{class}}', isolate('1م2')).replace('{{subject}}', isolate('رياضيات')),
    words.weeksLabel,
    span,
    words.heldLabel,
    words.sessions_few.replace('{{count}}', '3'),
    words.lostLabel,
    words.lost.replace('{{sessions}}', words.sessions_one),
    words.holidaysLabel,
    words.holidays.replace('{{sessions}}', words.sessions_one).replace('{{days}}', day(YENNAYER)),
    words.correctionsLabel,
    words.nothing,
    words.visasLabel,
    words.nothing,
  ]);
  expect(texts().join(' ')).not.toMatch(/\d{1,2}:\d{2}/u);
});

test('a school the directorate does not list is said so, and an ended grant opens no class', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  await render(inspector, []);
  expect(texts()).toContain(isolate(words.unlisted));
  await render({ ...inspector, date: addDays(grant.until, 1) });
  expect(texts()).toContain(words.ended.replace('{{until}}', day(grant.until)));
  expect(tree!.root.findAll((node) => node.props.testID === `inspector-grant-${grant.id}-class-1-open`)).toEqual([]);
  expect(texts()).not.toContain(words.openLine);
});

test('a use refused says why as an alert, and the class opens on trying again', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  let refuse = true;
  const send: Send = (request) =>
    refuse && request.method === 'POST'
      ? Promise.resolve({ status: 503, body: { error: 'busy' }, retryAfter: null })
      : server.send(request);
  await render(inspector, undefined, send);
  const id = `inspector-grant-${grant.id}-class-1`;
  await press(`${id}-open`);
  const alerts = tree!.root.findAll(
    (node) => node.props.accessibilityRole === 'alert' && typeof node.type !== 'string',
  );
  expect(alerts).toHaveLength(1);
  expect(said(id)).toContain(words.again);
  refuse = false;
  await press(`${id}-open`);
  expect(said(id)).toContain(words.heldLabel);
  expect(tree!.root.findAll((node) => node.props.accessibilityRole === 'alert')).toEqual([]);
});

test('I-Grant’s words read in every language, each with its plural forms', () => {
  const forms = {
    ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
    fr: ['one', 'many', 'other'],
    en: ['one', 'other'],
  };
  const places = (words: Record<string, string>) =>
    Object.entries(words)
      .filter(([key]) => !key.includes('_'))
      .map(([key, one]) => [key, (one.match(/\{\{\w+\}\}/gu) ?? []).sort()]);
  for (const [language, words] of [
    ['ar', ar],
    ['fr', fr],
    ['en', en],
  ] as const) {
    const grant: Record<string, string> = words.demo.inspectorGrant;
    expect(places(grant)).toEqual(places(ar.demo.inspectorGrant));
    for (const plural of ['classes', 'weeks', 'sessions', 'corrections', 'visas'])
      expect(Object.keys(grant).filter((key) => key.startsWith(`${plural}_`))).toEqual(
        forms[language].map((one) => `${plural}_${one}`),
      );
  }
});
