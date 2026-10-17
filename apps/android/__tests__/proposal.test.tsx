// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Proposal and DueStrip (#129): in pencil with the tag read first, the strip's
// one fact and soft button, both directions, and text that grows to 200%.

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ImageProps, PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { DueStrip } from '../src/components/DueStrip';
import { Proposal } from '../src/components/Proposal';
import { controlIcon } from '../src/design/Icon';
import { colors } from '../src/design/tokens';
import { DueStripSamples, ProposalSamples } from '../src/gallery/proposal-samples';
import { proposalTexts } from '../src/gallery/proposal-texts';
import { samples } from '../src/gallery/samples';
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

function expectGrowingText(direction: 'rtl' | 'ltr') {
  for (const node of tree.root.findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
    if (typeof node.parent?.type !== 'string' && node.parent?.type !== Text) {
      expect(flat(node)).toMatchObject({ writingDirection: direction, textAlign: 'start' });
    }
  }
  for (const node of tree.root.findAllByType(View)) expect(flat(node).height).toBeUndefined();
}

describe.each(
  (['ar', 'fr', 'en'] as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('%s, %s', (language, direction) => {
  test('the proposals are in pencil, never ink, with the tag read first', async () => {
    await render(<ProposalSamples sample={samples[language]} language={language} />, direction);
    expect(accessibilityProblems(tree.root)).toEqual([]);
    const text = proposalTexts[language];
    const box = byId('proposal-plan');
    expect(box.props.accessible).toBe(true);
    expect(box.props.accessibilityLabel).toBe(
      [text.tag, `${text.domain}: ${text.domainValue}`, `${text.topic}: ${text.topicValue}`, ...text.stages].join('. '),
    );
    expect(byId('proposal-continues').props.accessibilityLabel).toMatch(
      new RegExp(`^${text.continuesTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\. `),
    );
    expect(flat(box)).toMatchObject({
      direction,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors['pencil-edge'],
    });
    for (const node of tree.root.findAllByType(Text))
      expect(StyleSheet.flatten((node.props as TextProps).style)?.color ?? colors.pencil).toBe(colors.pencil);
    expectGrowingText(direction);
  });

  test('the strips say one fact, with a soft button that opens the task', async () => {
    await render(<DueStripSamples sample={samples[language]} language={language} />, direction);
    expect(accessibilityProblems(tree.root)).toEqual([]);
    const text = proposalTexts[language];
    const shown = tree.root.findAllByType(Text).map((node) => (node.props as TextProps).children);
    expect(shown).toEqual(expect.arrayContaining([text.noAbsence, text.homeworkDue]));
    expect(tree.root.findAllByType(Image)).toHaveLength(2);
    for (const icon of tree.root.findAllByType(Image)) {
      expect(StyleSheet.flatten((icon.props as ImageProps).style)).toMatchObject({ width: 18, height: 18 });
      expect(icon.parent?.parent?.props).toMatchObject({
        importantForAccessibility: 'no-hide-descendants',
        accessibilityElementsHidden: true,
      });
    }
    expect(flat(byId('due-roll'))).toMatchObject({
      direction,
      backgroundColor: colors.due,
    });
    expectGrowingText(direction);
  });
});

test("the strip's button opens its task", async () => {
  const onOpen = jest.fn();
  const text = proposalTexts.ar;
  await render(
    <DueStrip testID="due" icon={controlIcon('pupils')} fact={text.noAbsence} action={text.rollCall} onOpen={onOpen} />,
    'rtl',
  );
  const button = tree.root.find(
    (node) => node.props.testID === 'due-open' && typeof (node.props as PressableProps).onPress === 'function',
  );
  expect(button.props.accessibilityLabel ?? text.rollCall).toBe(text.rollCall);
  await ReactTestRenderer.act(() => {
    (button.props as PressableProps).onPress?.({} as never);
  });
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('a proposal line without a label is read as it is written', async () => {
  await render(
    <Proposal testID="p" tag="Proposed by the plan" lines={[{ text: '- Correcting the homework' }]} />,
    'ltr',
  );
  expect(byId('p').props.accessibilityLabel).toBe('Proposed by the plan. - Correcting the homework');
});
