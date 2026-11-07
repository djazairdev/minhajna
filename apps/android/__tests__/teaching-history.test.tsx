// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup's first step against what the history holds and what it sends
// (answers 802 to 809): the list is read with nothing of the teacher's, and
// leaving stops the read; a school typed in an earlier version opens empty
// and keeps its ID, its bell times and its classes' subjects once chosen; a
// school held as another is not offered; a list with nothing to choose says
// so; a change the phone cannot save says so. Made-up schools only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { MADE_UP_LIST, pickSchool, serveReference } from '../jest/directory-list';
import type { DirectoryOptions } from '../src/network/directory-network';
import { Teaching } from '../src/setup/Teaching';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const onNext = jest.fn();
const root = () => tree!.root;
const day = parseDay('2026-10-15');

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  onNext.mockReset();
  jest.restoreAllMocks();
});

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

async function render(data: TestData) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, <Teaching onNext={onNext} />)}</LocaleDirContext.Provider>,
    );
  });
  await settle();
}

async function press(id: string) {
  const node = root().find((one) => one.props.testID === id && one.props.onPress !== undefined);
  await ReactTestRenderer.act(() => {
    (node.props as PressableProps).onPress?.({} as never);
  });
  await settle();
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));

test('reads the list with nothing of the teacher’s, and stops the read on leaving', async () => {
  let signal: AbortSignal | undefined;
  const served = serveReference().mockImplementation((_path: string, _code?: string, options?: DirectoryOptions) => {
    signal = options?.signal;
    return new Promise(() => undefined);
  });
  await render(await openTestData());
  expect(served).toHaveBeenCalledTimes(1);
  expect(served.mock.calls[0].slice(0, 2)).toEqual(['/directory/reference', undefined]);
  expect(signal?.aborted).toBe(false);
  await ReactTestRenderer.act(() => tree!.unmount());
  tree = undefined;
  expect(signal?.aborted).toBe(true);
});

test('a typed school opens empty, then keeps its ID, bell times and classes’ subjects', async () => {
  serveReference();
  const data = await openTestData();
  const bells = { morning: [], afternoon: [] } as never;
  await data.book.recordAll(day, [
    {
      kind: 'school.set',
      school: { id: 's-old', name: 'مدرسة مكتوبة', levels: ['cem'], subjects: ['french'], zone: '16', bells },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-1',
        schoolId: 's-old',
        level: 'cem',
        grade: '1am',
        name: '1م1',
        groups: [{ id: 'k-1-w', kind: 'whole', name: 'القسم' }],
      },
    },
    { kind: 'course.set', course: { id: 'c-1', classId: 'k-1', subject: 'french', year: '2026-2027', pack: null } },
  ]);
  await render(data);
  expect(root().findAll((one) => one.props.testID === 'choice-option')).toHaveLength(0);
  await pickSchool(root);
  await press('setup-next');
  expect([...data.book.state.schools.values()]).toEqual([
    expect.objectContaining({ id: 's-old', code: 'cem-16-1', subjects: ['arabic', 'french'], bells }),
  ]);
  const count = data.book.entries.length;
  await ReactTestRenderer.act(() => tree!.unmount());
  await render(data);
  await press('setup-next');
  expect(data.book.entries.length).toBe(count);
});

test('does not offer a school the teacher holds as another', async () => {
  serveReference();
  const data = await openTestData();
  await data.book.recordAll(day, [
    { kind: 'school.set', school: { id: 's-1', name: 'أ', levels: ['cem'], subjects: ['arabic'] } },
    { kind: 'school.set', school: { id: 's-2', name: 'ب', code: 'cem-16-2', levels: ['cem'], subjects: ['arabic'] } },
  ]);
  await render(data);
  for (const [field, value] of [
    ['level', 'cem'],
    ['option', 'arabic'],
    ['wilaya', '16'],
    ['commune', '1601'],
  ]) {
    await press(`choice-${field}`);
    await press(`choice-${field}-${value}`);
  }
  await press('choice-school');
  expect(root().findAll((one) => one.props.testID === 'choice-school-cem-16-2')).toHaveLength(0);
  expect(root().findAll((one) => one.props.testID === 'choice-school-cem-16-1').length).toBeGreaterThan(0);
});

test('a list with nothing to choose says nothing is published, and a server past its limits says so', async () => {
  serveReference({ ...MADE_UP_LIST, schools: [] });
  await render(await openTestData());
  expect(shown()).toContain(text.setup.directory.none);
  await ReactTestRenderer.act(() => tree!.unmount());
  serveReference('E_DIRECTORY_BUSY');
  await render(await openTestData());
  expect(shown()).toContain(text.setup.directory.busy);
});

test('says so when the choice could not be saved', async () => {
  serveReference();
  const data = await openTestData();
  jest.spyOn(data.storage, 'appendEntry').mockRejectedValue(new Error('E_DISK_FULL'));
  await render(data);
  await pickSchool(root);
  await press('setup-next');
  expect(shown()).toContain(text.setup.notSaved);
});
