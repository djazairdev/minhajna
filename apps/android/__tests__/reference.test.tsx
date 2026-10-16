// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import App from '../App';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { bundledReference, readReference } from '../src/reference';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    for (const tree of trees) tree.unmount();
  });
  trees.length = 0;
});

async function render(files = bundledReference): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App files={files} />);
  });
  trees.push(tree!);
  return tree!;
}

function shown(tree: ReactTestRenderer.ReactTestRenderer): unknown[] {
  return tree.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
}

test("reads Algeria's bundled profile and 2026/27 calendar through the core", () => {
  const reference = readReference(bundledReference);

  expect(reference.ok ? [] : reference.problems).toEqual([]);
  if (!reference.ok) return;
  expect(reference.profile.code).toBe('dz');
  expect(reference.calendar.year.from).toBe('2026-09-21');
  expect(reference.calendar.year.to).toBe('2027-07-08');
});

test('shows the navigation preview when the data and history read', async () => {
  const tree = await render();
  expect(tree.root.findAllByType(AppNavigator)).toHaveLength(1);
  expect(shown(tree)).not.toContain(text.referenceRefused);
});

describe('a refused file', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test('shows the short message and uses no data, for a broken calendar', async () => {
    const calendar = { ...(bundledReference.calendar as object), year: { id: '2026-2027', from: '21/09/2026' } };
    const files = { ...bundledReference, calendar };

    const reference = readReference(files);
    expect(reference.ok).toBe(false);
    expect(reference).not.toHaveProperty('calendar');
    expect(reference).not.toHaveProperty('profile');

    const tree = await render(files);
    expect(tree.root.findAllByType(AppNavigator)).toHaveLength(0);
    expect(shown(tree)).toEqual([text.name, text.tagline, text.latinName, text.referenceRefused]);
    const notice = tree.root.findAllByType(Text)[3].props as TextProps;
    expect(notice.accessibilityRole).toBe('alert');
    expect(warn).toHaveBeenCalledWith(
      'Reference data refused',
      expect.arrayContaining([expect.objectContaining({ file: 'calendar' })]),
    );
  });

  test('refuses both files when the profile is not a profile', async () => {
    const files = { ...bundledReference, profile: '<html>' };

    const reference = readReference(files);
    expect(reference.ok ? [] : reference.problems.map((problem) => problem.file)).toContain('profile');
    expect(shown(await render(files))).toContain(text.referenceRefused);
  });
});
