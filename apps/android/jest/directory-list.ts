// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up directory list for the tests that walk setup's school selects,
// served by a stand-in for the directory's client so no test connects, and a
// walk through the selects. Every school and commune name is made up.

import { parseDay, type ReferenceList } from '@minhajna/core';
import type { PressableProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import * as directory from '../src/network/directory-network';

const commune = (code: string, ar: string, fr: string) => ({ code, name: { ar, fr, en: fr } });
const HOPE = commune('1601', 'بلدية الأمل', 'Commune de l’Espoir');
const OASIS = commune('0701', 'بلدية الواحة', 'Commune de l’Oasis');

export const MADE_UP_LIST: ReferenceList = {
  format: 1,
  version: '2026.1',
  published: parseDay('2026-09-01'),
  levels: [
    {
      code: 'primary',
      options: [
        { code: 'class', subjects: ['arabic', 'math', 'islamic'], classTeacher: true },
        { code: 'french', subjects: ['french'] },
      ],
    },
    {
      code: 'cem',
      options: [
        { code: 'arabic', subjects: ['arabic'] },
        { code: 'arabic-islamic', subjects: ['arabic', 'islamic'] },
        { code: 'math', subjects: ['math'] },
      ],
    },
    { code: 'lycee', options: [{ code: 'math', subjects: ['math'] }] },
  ],
  schools: [
    { id: 'cem-16-1', name: 'متوسطة النجاح', level: 'cem', wilaya: '16', commune: HOPE },
    { id: 'cem-16-2', name: 'متوسطة الفجر', level: 'cem', wilaya: '16', commune: HOPE },
    { id: 'cem-07-1', name: 'متوسطة الواحة', level: 'cem', wilaya: '07', commune: OASIS },
    { id: 'pri-16-1', name: 'ابتدائية الأمل', level: 'primary', wilaya: '16', commune: HOPE },
  ],
};

/** Serves the list, or a refusal with this code, to every read of the directory. */
export function serveReference(
  answer: ReferenceList | string = MADE_UP_LIST,
): jest.SpyInstance<Promise<unknown>, Parameters<typeof directory.directoryGet>> {
  return jest
    .spyOn(directory, 'directoryGet')
    .mockImplementation(() =>
      typeof answer === 'string'
        ? Promise.reject(Object.assign(new Error('made-up refusal'), { code: answer }))
        : Promise.resolve(answer),
    );
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Presses the first pressable with this test ID under the root, and lets what it starts settle. */
async function press(root: () => ReactTestInstance, testID: string) {
  const [node] = root().findAll(
    (one) => one.props.testID === testID && typeof (one.props as PressableProps).onPress === 'function',
    { deep: false },
  );
  if (node === undefined) throw new Error(`Nothing to press has the test ID ${testID}`);
  await ReactTestRenderer.act(async () => {
    (node.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

/** Chooses a level, option, wilaya, commune and school in the selects, by their values. */
export async function pickSchool(
  root: () => ReactTestInstance,
  values: { level: string; option: string; wilaya: string; commune: string; school: string } = {
    level: 'cem',
    option: 'arabic',
    wilaya: '16',
    commune: '1601',
    school: 'cem-16-1',
  },
  testID = 'choice',
) {
  await ReactTestRenderer.act(settle);
  for (const field of ['level', 'option', 'wilaya', 'commune', 'school'] as const) {
    await press(root, `${testID}-${field}`);
    await press(root, `${testID}-${field}-${values[field]}`);
  }
}
