// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A QR code drawn from its modules (#247): each row as runs of one colour,
// ink on the sheet's light colour, left to right in any interface direction,
// inside a quiet zone of four modules, and one image for a screen reader.

import { StyleSheet, type ViewStyle } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { QrCode } from '../src/settings/QrCode';
import { colors } from '../src/design/tokens';

test('draws each row as runs of one colour, left to right, inside its quiet zone', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<QrCode testID="code" rows={'1100\n0111'} label="رمز مختلق" module={5} />);
  });
  const style = (node: ReactTestRenderer.ReactTestInstance): ViewStyle =>
    StyleSheet.flatten(node.props.style as ViewStyle) ?? {};
  const views = tree!.root.findAll((node) => (node.type as unknown) === 'View');
  const zone = views[0];
  if (zone === undefined) throw new Error('No view drawn');
  expect(zone.props.testID).toBe('code');
  expect(zone.props.accessible).toBe(true);
  expect(zone.props.accessibilityRole).toBe('image');
  expect(zone.props.accessibilityLabel).toBe('رمز مختلق');
  expect(style(zone).padding).toBe(20);
  const code = views.find((node) => style(node).width === 20 && style(node).direction === 'ltr');
  expect(code).toBeDefined();
  const runs = views.filter((node) => style(node).backgroundColor !== undefined && node !== zone);
  expect(runs.map((node) => [style(node).width, style(node).backgroundColor])).toEqual([
    [10, colors.ink],
    [10, colors.sheet],
    [5, colors.sheet],
    [15, colors.ink],
  ]);
  await ReactTestRenderer.act(() => tree!.unmount());
});
