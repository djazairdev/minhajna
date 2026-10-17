// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Text, TextInput, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';

let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
});

test('does not mistake a placeholder or a filled value for an input label', async () => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <TextInput testID="unnamed" value="CEM-01" placeholder="Example" style={{ width: 20, height: 20 }} />,
    );
  });
  expect(accessibilityProblems(tree.root)).toEqual([
    'unnamed: nothing for TalkBack to read',
    'unnamed: smaller than 48dp (20×20)',
  ]);
});

test('reports a broken label association even if a fallback label exists', async () => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <TextInput
        testID="broken"
        accessibilityLabel="Code"
        accessibilityLabelledBy="missing"
        style={{ minWidth: 48, minHeight: 48 }}
      />,
    );
  });
  expect(accessibilityProblems(tree.root)).toEqual([
    'broken: broken accessibilityLabelledBy',
    'broken: nothing for TalkBack to read',
  ]);
});

test('accepts the intrinsic native edit-box role and a resolved spoken label', async () => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <View>
        <Text nativeID="code">Code</Text>
        <TextInput accessibilityLabelledBy="code" style={{ minWidth: 48, minHeight: 48 }} />
      </View>,
    );
  });
  expect(accessibilityProblems(tree.root)).toEqual([]);
});
