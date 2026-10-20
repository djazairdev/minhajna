// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The head of a class's plan and the pack's details (#225): the pack, its
// status, release, timing and source; switching to a parallel class; the
// details of a structure pack; a link-only pack whose items open their
// source in the browser only after a confirmation (answer 289); and the
// addresses that never open. Made-up packs and classes only.

import { parseDay, type PlanPack } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Alert, Linking, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { PlanDetails } from '../src/plan/PlanDetails';
import { sourceAddress } from '../src/plan/pack-source';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
  await i18n.changeLanguage('ar');
});

const linkPack = (data: TestData): PlanPack => {
  const example = data.packs.find((pack) => pack.id === 'dz.cem.4am.arabic.example')!;
  return {
    ...example,
    id: 'dz.cem.4am.civics.example',
    status: 'latest-found',
    licence: 'link-only',
    provenance: { issuer: 'Made-up issuer', edition: 'Made-up edition', foundAt: 'https://example.org/plan.pdf' },
    items: example.items.map((item, index) => ({ ...item, sourcePage: index + 2 })),
  };
};

async function withParallel(pack?: (data: TestData) => PlanPack): Promise<TestData> {
  const day = await withDay();
  const data = pack === undefined ? day : { ...day, packs: [...day.packs, pack(day)] };
  const pin = pack === undefined ? { id: 'dz.cem.4am.arabic.example', release: '2026.1' } : pack(data);
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'course.set',
    course: {
      id: 'c-2',
      classId: 'k-2',
      subject: 'arabic',
      year: '2026-2027',
      pack: { id: pin.id, release: pin.release },
    },
  });
  return data;
}

async function show(data: TestData, element: React.JSX.Element, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, element, '2026-10-22')}</LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const press = async (id: string) => {
  const target = root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
  await ReactTestRenderer.act(() => (target?.props.onPress as () => void)());
};

test('names the pack, its release and timing, and opens its details', async () => {
  const onDetails = jest.fn();
  await show(await withDay(), <ClassPlan courseId="c-1" onDetails={onDetails} />);
  expect(shown()).toEqual(
    expect.arrayContaining([text.plan.status.example, 'المخطط السنوي · الإصدار 2026.1', text.classPlan.details]),
  );
  await press('plan-details');
  expect(onDetails).toHaveBeenCalled();
});

test('switches to a parallel class on the same pack, in place', async () => {
  const onCourse = jest.fn();
  await show(await withParallel(), <ClassPlan courseId="c-1" onCourse={onCourse} />);
  expect(shown()).toEqual(expect.arrayContaining(['4م1', '4م2']));
  await press('plan-parallel-c-2');
  expect(onCourse).toHaveBeenCalledWith('c-2');
  expect(accessibilityProblems(root())).toEqual([]);
});

test('a structure pack’s details: issuer, edition, ID and release, licence, timing, who keyed it', async () => {
  const data = await withParallel((day) => ({ ...linkPack(day), licence: 'structure-only' }));
  await show(data, <PlanDetails courseId="c-2" />);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.plan.meaning['latest-found'],
      '\u2068Made-up issuer\u2069',
      '\u2068Made-up edition\u2069',
      'dz.cem.4am.civics.example · 2026.1',
      '\u2068https://example.org/plan.pdf\u2069',
      text.planDetails.licences['structure-only'],
      text.classPlan.keyedBy,
    ]),
  );
  expect(root().findAll((node) => node.props.testID === 'pack-items')).toHaveLength(0);
});

test('a link-only pack opens an item’s source in the browser only once the teacher confirms', async () => {
  const data = await withParallel(linkPack);
  const alert = jest.spyOn(Alert, 'alert');
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await show(data, <PlanDetails courseId="c-2" />);
  expect(shown()).toEqual(expect.arrayContaining([text.planDetails.items, text.planDetails.linkNote]));
  const first = data.packs.at(-1)!.items.find((item) => item.kind !== 'unit')!;
  await press(`pack-source-${first.id}`);
  expect(open).not.toHaveBeenCalled();
  expect(alert.mock.calls[0]?.[1]).toContain('\u2068example.org\u2069');
  const buttons = alert.mock.calls[0]?.[2] ?? [];
  await ReactTestRenderer.act(() => {
    buttons[1]?.onPress?.();
  });
  expect(open).toHaveBeenCalledWith(`https://example.org/plan.pdf#page=${first.sourcePage}`);
});

test('only a plain https address ever opens', () => {
  const base = { provenance: { issuer: 'x', edition: 'x' }, items: [] } as unknown as PlanPack;
  for (const foundAt of [
    'http://example.org/plan.pdf',
    'https://user:pass@example.org/plan.pdf',
    'https://example.org/a plan.pdf',
    'javascript:alert(1)',
    'Ministry website',
    'https://127.0.0.1/plan.pdf',
    'https://localhost/plan.pdf',
    'https://example.org/pl\u202ean.pdf',
    'https://example.org/plan.pdf#page=2',
  ]) {
    expect(sourceAddress({ ...base, provenance: { ...base.provenance, foundAt } })).toBeNull();
  }
  expect(sourceAddress({ ...base, provenance: { ...base.provenance, foundAt: 'https://example.org/p.pdf' } })).toBe(
    'https://example.org/p.pdf',
  );
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control on the details (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await withParallel(linkPack), <PlanDetails courseId="c-2" />, direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].planDetails.linkNote);
});
