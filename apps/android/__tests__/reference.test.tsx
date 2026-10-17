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

test("reads Algeria's bundled profile, 2026/27 calendar, bell times and packs through the core", () => {
  const reference = readReference(bundledReference);

  expect(reference.ok ? [] : reference.problems).toEqual([]);
  if (!reference.ok) return;
  expect(reference.profile.code).toBe('dz');
  expect(reference.calendar.year.from).toBe('2026-09-21');
  expect(reference.calendar.year.to).toBe('2027-07-08');
  expect(reference.bells.templates.map((template) => template.level)).toEqual(['cem', 'lycee']);
  expect(reference.packs.map((pack) => pack.id)).toEqual([
    'dz.cem.1am.math.example',
    'dz.cem.4am.arabic.example',
    'dz.primary.5ap.arabic.example',
  ]);
  expect(reference.refusedPacks).toBe(0);
});

test('shows the navigation preview when the data and history read', async () => {
  const tree = await render();
  expect(tree.root.findAllByType(AppNavigator)).toHaveLength(1);
  expect(shown(tree)).not.toContain(text.referenceRefused);
});

test('leaves out a refused plan pack on its own, and keeps the rest of the data', () => {
  const [first, ...rest] = bundledReference.packs;
  const reference = readReference({ ...bundledReference, packs: [{ ...(first as object), format: 2 }, ...rest] });
  expect(reference.ok).toBe(true);
  if (!reference.ok) return;
  expect(reference.packs).toHaveLength(2);
  expect(reference.refusedPacks).toBe(1);
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
    expect(shown(tree)).toEqual([
      text.name,
      text.tagline,
      text.welcome.line,
      text.referenceRefused,
      text.language.label,
      text.language.ar,
      text.language.fr,
      text.language.en,
      text.welcome.noAccount,
      text.welcome.offline,
      text.welcome.onPhone,
    ]);
    const notice = tree.root.findAllByType(Text)[3].props as TextProps;
    expect(notice.accessibilityRole).toBe('alert');
    expect(warn).toHaveBeenCalledWith(
      'Reference data refused',
      expect.arrayContaining([expect.objectContaining({ file: 'calendar' })]),
    );
  });

  test('refuses all three files when the bell times overlap', async () => {
    const bells = bundledReference.bells as { templates: { morning: string[][] }[] };
    const [first, ...rest] = bells.templates;
    const files = {
      ...bundledReference,
      bells: {
        ...bells,
        templates: [
          {
            ...first,
            morning: [
              ['08:00', '09:00'],
              ['08:30', '09:30'],
            ],
          },
          ...rest,
        ],
      },
    };

    const reference = readReference(files);
    expect(reference.ok ? [] : reference.problems).toEqual([
      { path: 'templates[0].morning[1]', problem: 'invalid', file: 'bells' },
    ]);
    expect(shown(await render(files))).toContain(text.referenceRefused);
  });

  test('refuses all three files when the profile is not a profile', async () => {
    const files = { ...bundledReference, profile: '<html>' };

    const reference = readReference(files);
    expect(reference.ok ? [] : reference.problems.map((problem) => problem.file)).toContain('profile');
    expect(shown(await render(files))).toContain(text.referenceRefused);
  });
});
