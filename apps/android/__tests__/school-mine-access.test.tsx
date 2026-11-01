// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's access log on School-mine (#593, answer 621), on the made-up
// term of grant-term.ts: before any grant it says none was made; once the
// director grants a request, the teacher's channel read gives its notice, and
// the log shows the day it was made and the inspector, then the inspector as
// labelled, the two signed weeks it opens, counted, of 1م2, and its end, with
// dates and no clock time; past its end it shows ended; on a new code it shows
// without classes, which the new device never signed; and two grants come
// newest first; and its words read in every language, each with its plural
// forms. Every school, class, teacher and device is made up.

import { addDays, type Day, type SchoolJoined } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { grantTerm, LABEL, STAFFED } from '../jest/grant-term';
import { joinNew, MINE, SUBJECTS } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { approveGrant } from '../src/director/grant-make';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';
import { SchoolMine } from '../src/week/SchoolMine';
import { readSignChannel } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.accessLog;
const day = (one: Day) => `day ${one}`;
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const grants = () =>
  tree!.root
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('mine-grant-'))
    .filter((node) => typeof node.type === 'string')
    .map((node) => String(node.props.testID));

async function render(world: { world: string; date: Day }, join: SchoolJoined) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolMine
          world={world}
          join={join}
          kit={kit}
          send={server.send}
          dayText={day}
          onClose={() => undefined}
          said=""
          subjects={SUBJECTS}
          mine={MINE}
          onSign={() => undefined}
          onReport={() => undefined}
        />
      </LocaleDirContext.Provider>,
    );
  });
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
}

const line = (until: Day, count: string) =>
  words.grant
    .replace('{{label}}', isolate(LABEL))
    .replace('{{weeks}}', count)
    .replace('{{classes}}', isolate('1م2'))
    .replace('{{until}}', day(until));

test('the log says no grant, then shows the grant the director made, and ended after its end', async () => {
  const { director, joined, fingerprint, ask } = await grantTerm();
  const world = { world: director.world, date: director.date };
  await render(world, joined);
  expect(texts()).toEqual(expect.arrayContaining([words.title, words.none, words.foot, words.given]));
  const request = await ask();
  const grant = await approveGrant(director, STAFFED, request.id, fingerprint, kit, server.send);
  expect((await readSignChannel(world, joined, kit, server.send)).notices.map((one) => one.value.grant)).toEqual([
    grant.id,
  ]);
  await render(world, joined);
  expect(texts()).not.toContain(words.none);
  expect(texts()).toEqual(
    expect.arrayContaining([words.when.replace('{{day}}', day(grant.from)), line(grant.until, words.weeks_two)]),
  );
  expect(texts().join(' ')).not.toMatch(/\d{1,2}:\d{2}/u);
  expect(texts()).not.toContain(words.ended.replace('{{until}}', day(grant.until)));
  await render({ ...world, date: addDays(grant.until, 1) }, joined);
  expect(texts()).toContain(words.ended.replace('{{until}}', day(grant.until)));
});

test('on a new code the grant shows without classes, which the new device never signed', async () => {
  const { id, director, device, fingerprint, ask } = await grantTerm();
  const again = await joinNew(id, director, device, 'teacher-1');
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  await render({ world: director.world, date: director.date }, again);
  const bare = words.grantNoClasses
    .replace('{{label}}', isolate(LABEL))
    .replace('{{weeks}}', words.weeks_two)
    .replace('{{until}}', day(grant.until));
  expect(texts()).toContain(bare);
  expect(texts().join(' ')).not.toContain('()');
});

test('two grants come newest first', async () => {
  const { director, joined, fingerprint, ask } = await grantTerm();
  const first = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const later = { ...director, date: addDays(director.date, 2) };
  const second = await approveGrant(later, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  await render({ world: later.world, date: later.date }, joined);
  expect(grants()).toEqual([`mine-grant-${second.id}`, `mine-grant-${first.id}`]);
});

test('the log’s words read in every language, each with its plural forms', () => {
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
    const log: Record<string, string> = words.demo.accessLog;
    expect(places(log)).toEqual(places(ar.demo.accessLog));
    expect(Object.keys(log).filter((key) => key.startsWith('weeks_'))).toEqual(
      forms[language].map((one) => `weeks_${one}`),
    );
  }
});
