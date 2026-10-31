// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's workspaces in a demo world (#562, answer 576), against a made-up
// demo server: a national world offers every role from the Ministry to the
// operators and a teachers' world the teacher and the observatory; each role
// above the teacher opens on its first page, its sidebar listing its own pages
// and no other's, under the demo's deployment name in the boards' Naskh or, for
// the curators and the observatory, the project's wordmark, with the role and
// the board's note; a page opens from the sidebar with its heading, said with
// the band when the role is new and alone after; the world's page shows its
// code and moves its date; changing the role goes back to the roles and leaving
// leaves the world, which the sidebar refuses while the world is busy; in right
// to left the sidebar opens the row; the teacher and the inspector keep the
// world's home; and the phone offers no workspace. Every world is made up.

import type { SchoolCalendar } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, StyleSheet, Text, type PressableProps, type TextInputProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { TextField } from '../src/components/TextField';
import { DemoRoot } from '../src/demo/DemoRoot';
import { WORLD_ROLES } from '../src/demo/world-mode';
import { ROLE_PAGES, type WorkspaceRole } from '../src/demo/world-pages';
import { WorldShell } from '../src/demo/WorldShell';
import { RailLink, railStyles, type RailLinkProps } from '../src/navigation/RailLink';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const left = jest.fn();
let os: jest.ReplaceProperty<typeof Platform.OS>;
const ALL_PAGES = [...new Set(Object.values(ROLE_PAGES).flat())];

beforeEach(() => {
  os = jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  left.mockClear();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const selected = (testID: string): unknown =>
  tree!.root.findAll((node) => node.props.testID === testID && 'aria-selected' in node.props)[0].props['aria-selected'];
const band = () => String(tree!.root.findByProps({ testID: 'demo-band' }).props.accessibilityLabel);
const said = () => String(tree!.root.findByProps({ testID: 'world-said' }).props.children);
const words = (testID: string): unknown =>
  tree!.root.findAll((node) => node.type === Text && node.props.testID === testID)[0].props.children;

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

async function render(direction: 'ltr' | 'rtl' = 'ltr') {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <DemoRoot
          kit={nodeKit}
          calendar={calendar}
          profile={read.ok ? read.profile : {}}
          storage={teacher.asSpec()}
          world={world.asSpec()}
          send={server.send}
          onBack={() => undefined}
          onLeft={left}
        />
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
}

/** A world of the kind started on this PC, its roles shown. */
async function started(kind: 'national' | 'teachers') {
  await render();
  await press(`demo-start-${kind}`);
}

test('each kind of world offers its roles, from the Ministry to those who serve the system', async () => {
  await started('national');
  for (const role of WORLD_ROLES.national) expect(shown(`world-role-${role}`)).toBe(true);
  expect(shown('world-role-observatory')).toBe(false);
  await press('world-leave');
  await started('teachers');
  expect(WORLD_ROLES.teachers.map((role) => shown(`world-role-${role}`))).toEqual([true, true]);
  expect(shown('world-role-director')).toBe(false);
});

test.each(Object.keys(ROLE_PAGES) as WorkspaceRole[])('the %s sees its own pages and no other', async (role) => {
  await started(role === 'observatory' ? 'teachers' : 'national');
  await press(`world-role-${role}`);
  const own = ROLE_PAGES[role];
  expect(ALL_PAGES.filter((page) => shown(`world-page-${page}`))).toEqual(ALL_PAGES.filter((p) => own.includes(p)));
  const listed = tree!.root.findByProps({ testID: 'world-rail' }).findAllByType(RailLink);
  expect(listed.map((node) => (node.props as RailLinkProps).testID)).toEqual(own.map((page) => `world-page-${page}`));
  expect(selected(`world-page-${own[0]}`)).toBe(true);
  expect(own.slice(1).map((page) => selected(`world-page-${page}`))).toEqual(own.slice(1).map(() => false));
  const project = role === 'curator' || role === 'observatory';
  const name = tree!.root.findAll((node) => node.type === Text && node.props.testID === 'world-name')[0];
  expect((name.props as TextProps).children).toBe(project ? text.name : text.demo.shell.name);
  expect(StyleSheet.flatten((name.props as TextProps).style)).toMatchObject(
    project ? railStyles.brand : railStyles.dep,
  );
  expect(texts()).not.toContain(project ? text.demo.shell.name : text.name);
  expect(words('world-who')).toBe(text.demo.roles[role]);
  expect(words('world-note')).toBe(text.demo.shell.note[role]);
});

test('a page opens from the sidebar with its heading, said alone once the role is said with the band', async () => {
  await started('national');
  await press('world-role-director');
  expect(said()).toContain(`${text.demo.band}. `);
  expect(said()).toContain(text.demo.pages.dashboard);
  expect(texts()).toContain(text.demo.pages.empty);
  const named = tree!.root.findAll((node) => typeof node.props.testID === 'string');
  expect(named[0].props.testID).toBe('demo-band');
  await press('world-page-keys');
  expect(selected('world-page-keys')).toBe(true);
  expect(selected('world-page-dashboard')).toBe(false);
  const heading = tree!.root.findAll((node) => node.type === Text && node.props.accessibilityRole === 'header');
  expect(heading.map((node) => (node.props as TextProps).children)).toEqual([
    text.demo.shell.name,
    text.demo.pages.keys,
  ]);
  expect(said()).toBe(text.demo.pages.keys);
  expect(shown('world-code')).toBe(false);
});

test('the world’s page shows the code and moves the date, and changing the role starts afresh', async () => {
  await started('national');
  await press('world-role-ministry');
  await press('world-page-world');
  expect(shown('world-code')).toBe(true);
  const dated = band();
  await press('world-move-date');
  expect(band()).not.toBe(dated);
  await press('world-change-role');
  expect(shown('world-shell')).toBe(false);
  expect(shown('world-role-ministry')).toBe(true);
  await press('world-role-ministry');
  expect(selected('world-page-thresholds')).toBe(true);
  await press('world-change-role');
  await press('world-role-directorate');
  expect(selected('world-page-thresholds')).toBe(true);
  expect(shown('world-page-published')).toBe(false);
  await press('world-leave');
  expect(left).toHaveBeenCalledTimes(1);
  expect(worldNetworkOpen()).toBeNull();
  expect(world.open).toBeNull();
});

test('the sidebar’s leave button is disabled while the world is busy', async () => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <WorldShell role="preparer" page="log" moving onPage={jest.fn()} onChangeRole={jest.fn()} onLeave={jest.fn()}>
        {null}
      </WorldShell>,
    );
  });
  const [button] = tree!.root.findAll(
    (node) => node.props.testID === 'world-leave' && 'accessibilityState' in node.props,
  );
  expect(button.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  expect(selected('world-page-log')).toBe(true);
});

test('in right to left the sidebar opens the row, at the start of the window', async () => {
  await render('rtl');
  await press('demo-start-national');
  await press('world-role-operator');
  const shell = tree!.root.findAll((node) => node.props.testID === 'world-shell' && 'style' in node.props)[0];
  expect(StyleSheet.flatten(shell.props.style as object)).toMatchObject({ flexDirection: 'row', direction: 'rtl' });
  const parts = shell.findAll((node) => /^world-(rail|page-map)$/u.test(String(node.props.testID)));
  expect(parts[0].props.testID).toBe('world-rail');
});

test('the teacher and the inspector keep the world’s home, and the phone offers no workspace', async () => {
  await started('national');
  for (const role of ['teacher', 'inspector']) {
    await press(`world-role-${role}`);
    expect(shown('world-shell')).toBe(false);
    expect(shown('world-code')).toBe(true);
    await press('world-change-role');
  }
  const code = String(tree!.root.findByProps({ testID: 'world-code' }).props.children).replaceAll(' ', '');
  await press('world-leave');
  await ReactTestRenderer.act(() => tree!.unmount());
  os.replaceValue('android');
  await render();
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === 'demo-code');
  await ReactTestRenderer.act(async () => {
    (input.props as TextInputProps).onChangeText?.(code);
    await settle();
  });
  await press('demo-join');
  expect(shown('world-role-teacher')).toBe(true);
  expect(Object.keys(ROLE_PAGES).filter((role) => shown(`world-role-${role}`))).toEqual([]);
});
