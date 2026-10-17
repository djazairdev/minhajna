// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The preview says what it is (#48): in one line on the welcome, before
// the language choice, and in full in Help, with its version and the
// checksums of its APK and signing certificate, grouped, left to right and
// selectable. The checksums here are made up; Jest has no installed APK.

import { StyleSheet, Text, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { AboutBuild, grouped } from '../src/help/BuildFacts';
import native from '../src/native/NativeMinhajnaBuild';
import { Welcome } from '../src/navigation/Welcome';
import text from '../src/text/ar.json';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await Promise.resolve();
  });
  return tree!.root.findAllByType(Text);
}

const shown = (texts: ReactTestRenderer.ReactTestInstance[]) => texts.map((node): unknown => node.props.children);

test('cuts a checksum into groups of four', () => {
  expect(grouped('0123456789abcdef01')).toBe('0123 4567 89ab cdef 01');
  expect(grouped('')).toBe('');
});

test('says it is a preview on the welcome in one line, before the language choice', async () => {
  const texts = shown(await render(<Welcome />));
  const notice = texts.indexOf(text.preview.short);
  expect(texts.slice(notice - 1, notice + 1)).toEqual([text.preview.badge, text.preview.short]);
  expect(texts).not.toContain(text.preview.message);
  expect(notice).toBeLessThan(texts.indexOf(text.language.label));
});

test('shows the version and both checksums, grouped, left to right and selectable', async () => {
  const texts = await render(<AboutBuild />);
  expect(shown(texts)).toEqual([
    text.preview.badge,
    text.preview.title,
    text.preview.message,
    i18n.t('preview.version', { version: '0.1.0', code: 1 }),
    text.preview.apk,
    grouped('ab'.repeat(32)),
    text.preview.signer,
    grouped('cd'.repeat(32)),
    text.preview.compare,
  ]);
  for (const node of texts.filter((one) => (one.props as TextProps).selectable)) {
    expect(StyleSheet.flatten((node.props as TextProps).style)).toMatchObject({
      direction: 'ltr',
      writingDirection: 'ltr',
    });
  }
  expect(texts.filter((one) => (one.props as TextProps).selectable)).toHaveLength(2);
});

test('leaves out the certificate when Android gives none, and says when the checksums fail', async () => {
  jest
    .spyOn(native, 'describe')
    .mockResolvedValueOnce({ version: '0.1.0', versionCode: 1, apkSha256: 'ef'.repeat(32), signerSha256: null });
  expect(shown(await render(<AboutBuild />))).not.toContain(text.preview.signer);
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.spyOn(native, 'describe').mockRejectedValueOnce(new Error('unreadable'));
  expect(shown(await render(<AboutBuild />))).toContain(text.preview.refused);
});
