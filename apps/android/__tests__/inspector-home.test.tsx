// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspector's home cards (#594, answer 622), on the made-up term of
// grant-term.ts: in French the grant's school shows by its Latin name and the
// words are French; a class opened, then the world's date moving, shows the
// class by its number again, and opening it on the new day posts one use a week
// more; and the home shows the key card and I-Grant together, the school by the
// name the world seeds. Every school, class, teacher and device is made up.

import { addDays, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { grantTerm, STAFFED } from '../jest/grant-term';
import { reference, SCHOOL } from '../jest/grant-world';
import { MINE } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { seededWorld } from '../src/director/director-world';
import { approveGrant } from '../src/director/grant-make';
import { InspectorGrants, type InspectorGrantsProps } from '../src/inspector/InspectorGrants';
import { InspectorHome } from '../src/inspector/InspectorHome';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import fr from '../src/text/fr.json';
import { i18n } from '../src/text/i18n';
import { isolate } from '../src/week/grid-labels';
import { deliveryReading } from '../src/week/school-mine-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const day = (one: Day) => `day ${one}`;
const reading = deliveryReading(MINE, [], []);
const schools = [{ id: SCHOOL.id, name: 'مدرسة مختلقة', latinName: 'CEM Made-up' }];
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
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
const buttons = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.props.onPress === 'function');
const press = async (testID: string) => {
  await ReactTestRenderer.act(() => {
    (buttons(testID)[0].props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const posts = () => server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches')).length;

const page = (world: InspectorGrantsProps['world']) => (
  <LocaleDirContext.Provider value="rtl">
    <InspectorGrants
      world={world}
      directorate={SCHOOL.directorateId}
      schools={schools}
      reading={reading}
      workingDays={MINE.profile.workingDays}
      kit={kit}
      send={server.send}
      dayText={day}
    />
  </LocaleDirContext.Provider>
);

async function show(element: ReactElement) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  await settle();
}

test('in French the school shows by its Latin name, in French words', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  await i18n.changeLanguage('fr');
  await show(page(inspector));
  expect(texts()).toEqual(expect.arrayContaining([isolate('CEM Made-up'), fr.demo.inspectorGrant.title]));
  expect(texts()).not.toContain(isolate('مدرسة مختلقة'));
});

test('the date moving shows an opened class by its number again, and opening it posts that day’s uses', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const id = `inspector-grant-${grant.id}-class-1`;
  await show(page(inspector));
  await press(`${id}-open`);
  expect(buttons(`${id}-open`)).toEqual([]);
  expect(texts()).toContain(ar.demo.inspectorGrant.heldLabel);
  await ReactTestRenderer.act(() => tree!.update(page({ ...inspector, date: addDays(inspector.date, 1) })));
  await settle();
  expect(buttons(`${id}-open`).length).toBeGreaterThan(0);
  expect(texts()).not.toContain(ar.demo.inspectorGrant.heldLabel);
  const before = posts();
  await press(`${id}-open`);
  expect(posts() - before).toBe(2);
  expect(texts()).toContain(ar.demo.inspectorGrant.heldLabel);
});

test('the home shows the key card and I-Grant, the school by the name the world seeds', async () => {
  const { director, inspector, fingerprint, ask } = await grantTerm();
  await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  await show(
    <LocaleDirContext.Provider value="rtl">
      <InspectorHome
        world={inspector}
        school={SCHOOL}
        reference={reference}
        mine={MINE}
        kit={kit}
        send={server.send}
        dayText={day}
      />
    </LocaleDirContext.Provider>,
  );
  const seeded = seededWorld(inspector.world, reference).schools.find((one) => one.id === SCHOOL.id)!;
  const ids = tree!.root.findAll((node) => typeof node.type === 'string').map((node) => node.props.testID as unknown);
  expect(ids).toEqual(expect.arrayContaining(['inspector-key', 'inspector-grants']));
  expect(texts()).toEqual(expect.arrayContaining([ar.demo.inspectorKey.title, isolate(seeded.name)]));
});
