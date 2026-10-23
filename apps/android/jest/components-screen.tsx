// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Mounting the component marks screens for their tests (#239): the screen, its
// texts and controls, the components and a component's entry, its kept marks,
// and a term setup with a column of the teacher's. Made-up records only.

import { marksFor, parseDay, type MarkTarget, type RecordEvent } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type React from 'react';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { MarksComponents, type MarksComponentsProps } from '../src/marks/MarksComponents';
import { MarksEntry } from '../src/marks/MarksEntry';
import { coreContext } from '../src/storage/core-context';
import { withData, type TestData } from './app-data';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
export const DAY = parseDay('2026-10-15');

/** The mounted screen's root. */
export const root = () => tree!.root;

export async function mount(data: TestData, element: React.ReactElement, day = '2026-10-15') {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, day)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
}

export async function unmount() {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
}

export const rendered = () => tree!.toJSON();

export const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );

export const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

export async function press(...testIDs: string[]) {
  for (const testID of testIDs) {
    await ReactTestRenderer.act(async () => {
      (control(testID)?.props as PressableProps).onPress?.({} as never);
      await settle();
    });
  }
}

export const entry = (componentId: string, more: { courseId?: string; month?: string } = {}) => (
  <MarksEntry courseId="c-1" term={1} componentId={componentId} onDone={jest.fn()} {...more} />
);

export const componentsScreen = (props: Partial<MarksComponentsProps> = {}) => (
  <MarksComponents courseId="c-1" term={1} onMonth={jest.fn()} onEntry={jest.fn()} onJustify={jest.fn()} {...props} />
);

export const kept = (data: TestData, target: MarkTarget, courseId = 'c-1') =>
  Object.fromEntries(marksFor(data.book.state, courseId, 1, target));

export const context = (data: TestData) => coreContext({ ...data, state: data.book.state });

/** 4م1's term setup, attendance from the roll-call book or not, with a column for research. */
export const setup = (rollCall: boolean, participation = 4): RecordEvent => ({
  kind: 'assessment.set',
  setup: {
    courseId: 'c-1',
    term: 1,
    release: '2025.9',
    components: [
      ...(['participation', 'quizzes', 'homework', 'notebook', 'attendance'] as const).map((id, index) => ({
        kind: 'preset' as const,
        id,
        name: { ar: id },
        points: [participation, 3, 3, 3, 3][index] ?? 3,
      })),
      { kind: 'column', id: 'col-1', name: 'عرض شفهي', points: 4 },
    ],
    rollCall,
  },
});
