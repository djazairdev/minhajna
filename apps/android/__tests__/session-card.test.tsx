// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// SessionCard (#160): the focus, mini and done cards, their meta line read as
// one, the one tap and the two line buttons, both directions, and text that
// grows to 200%.

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { SessionCard } from '../src/components/SessionCard';
import { colors, shadows } from '../src/design/tokens';
import { proposalTexts } from '../src/gallery/proposal-texts';
import { samples } from '../src/gallery/samples';
import { SessionCardSamples } from '../src/gallery/session-card-samples';
import { sessionCardTexts } from '../src/gallery/session-card-texts';
import type { Language } from '../src/text/i18n';

let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
});

async function render(element: ReactElement, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

const byId = (id: string) => tree.root.findAllByType(View).find((node) => node.props.testID === id)!;
const flat = (node: ReactTestRenderer.ReactTestInstance) => StyleSheet.flatten((node.props as ViewProps).style) ?? {};
const press = async (id: string) => {
  const button = tree.root.find(
    (node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function',
  );
  await ReactTestRenderer.act(() => {
    (button.props as PressableProps).onPress?.({} as never);
  });
};

describe.each(
  (['ar', 'fr', 'en'] as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('%s, %s', (language, direction) => {
  test('each card is named, 48dp, and grows with the text', async () => {
    await render(<SessionCardSamples sample={samples[language]} language={language} />, direction);
    expect(accessibilityProblems(tree.root)).toEqual([]);
    const text = sessionCardTexts[language];
    const metas = tree.root
      .findAllByType(View)
      .filter((node) => node.props.accessible === true && typeof node.props.accessibilityLabel === 'string')
      .map((node) => node.props.accessibilityLabel as string);
    expect(metas).toContain(`${text.classes[0]}, ${text.slots[0]}, ${text.subject}`);
    expect(metas).toContain(`${text.classes[2]}, ${text.slots[2]}`);
    for (const id of ['card-done', 'card-focus', 'card-long', 'card-continued', 'card-mini']) {
      expect(flat(byId(id))).toMatchObject({ direction, backgroundColor: colors.sheet });
    }
    for (const node of tree.root.findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
  });
});

test('the focus card is marked by its border as well as its shadow', async () => {
  await render(<SessionCardSamples sample={samples.ar} language="ar" />, 'rtl');
  expect(flat(byId('card-focus'))).toMatchObject({
    borderWidth: 1,
    borderColor: colors.rule,
    boxShadow: shadows['shadow-focus-card'],
  });
  expect(flat(byId('card-mini'))).toMatchObject({ borderWidth: 1, borderColor: colors.line });
  expect(flat(byId('card-mini')).boxShadow).toBeUndefined();
});

test('only the tap records: each button calls its own action', async () => {
  const actions = { onConfirm: jest.fn(), onOther: jest.fn(), onDetails: jest.fn() };
  const text = sessionCardTexts.ar;
  const proposal = proposalTexts.ar;
  await render(
    <SessionCard
      testID="card"
      kind="focus"
      meta={{ className: text.classes[0], slot: text.slots[0], subject: text.subject }}
      proposal={{ tag: proposal.tag, lines: [{ label: proposal.topic, text: proposal.topicValue }] }}
      confirm={text.confirm}
      onConfirm={actions.onConfirm}
      more={[
        { id: 'other', label: text.other, onPress: actions.onOther },
        { id: 'details', label: text.details, onPress: actions.onDetails },
      ]}
    />,
    'rtl',
  );
  expect(Object.values(actions).every((action) => action.mock.calls.length === 0)).toBe(true);
  await press('card-confirm');
  expect(actions.onConfirm).toHaveBeenCalledTimes(1);
  await press('card-other');
  await press('card-details');
  expect(actions.onOther).toHaveBeenCalledTimes(1);
  expect(actions.onDetails).toHaveBeenCalledTimes(1);
});

test('the done card says what was written and where, with its tick hidden from TalkBack', async () => {
  const onShow = jest.fn();
  const text = sessionCardTexts.en;
  await render(
    <SessionCard
      testID="done"
      kind="done"
      meta={{ className: text.classes[0], slot: text.slots[0], subject: text.subject }}
      written={text.written}
      where={text.where}
      show={{ id: 'show', label: text.show, onPress: onShow }}
    />,
    'ltr',
  );
  expect(tree.root.findAllByType(Text).map((node) => (node.props as TextProps).children)).toEqual(
    expect.arrayContaining([text.written, text.where]),
  );
  const tick = tree.root
    .findAllByType(View)
    .find((node) => node.props.importantForAccessibility === 'no-hide-descendants');
  expect(tick?.props.accessibilityElementsHidden).toBe(true);
  await press('done-show');
  expect(onShow).toHaveBeenCalledTimes(1);
});

test('a card without its secondary buttons shows only the one tap', async () => {
  const text = sessionCardTexts.ar;
  const proposal = proposalTexts.ar;
  await render(
    <SessionCard
      testID="card"
      kind="focus"
      meta={{ className: text.classes[0], slot: text.slots[0] }}
      proposal={{ tag: proposal.tag, lines: [{ text: proposal.topicValue }] }}
      confirm={text.confirm}
      onConfirm={() => undefined}
    />,
    'rtl',
  );
  expect(accessibilityProblems(tree.root)).toEqual([]);
  const pressable = (id: string) =>
    tree.root.findAll(
      (node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function',
    ).length;
  expect([pressable('card-confirm') > 0, pressable('card-other'), pressable('card-details')]).toEqual([true, 0, 0]);
});
