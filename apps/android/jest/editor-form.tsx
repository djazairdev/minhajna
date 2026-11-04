// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up source packs and real controls, without storage or a world server.

export { source, weekly } from './editor-source';
import type { PressableProps } from 'react-native';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { i18n, type Language } from '../src/text/i18n';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
export const rendered = () => tree!;

export async function show(element: ReactElement, language: Language = 'ar') {
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>{element}</LocaleDirContext.Provider>,
    );
  });
}

export async function unmount() {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
}

export function field(testID: string) {
  const node = rendered()
    .root.findAll((one) => one.props.testID === testID && one.props.onChangeText !== undefined)
    .at(0);
  if (node === undefined) throw new Error(`Missing field: ${testID}`);
  return {
    props: node.props as {
      value: string;
      editable?: boolean;
      textDirection?: string;
      onChangeText: (text: string) => void;
    },
  };
}
export const shown = (testID: string) => rendered().root.findAllByProps({ testID }).length > 0;

export async function type(testID: string, text: string) {
  await ReactTestRenderer.act(() => field(testID).props.onChangeText(text));
}

export async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    const node = rendered()
      .root.findAll((one) => one.props.testID === testID && one.props.onPress !== undefined)
      .at(0);
    (node?.props as PressableProps | undefined)?.onPress?.({} as never);
    await Promise.resolve();
  });
}
