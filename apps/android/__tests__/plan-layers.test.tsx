// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The layers of a class's plan (#226, Plan-layers, answers 337 to 343):
// a district layer signed by the curators and a school layer from an
// unverified sender, each never official, switched on class by class, one
// at each level; and their import from a file, which takes a layer in
// without switching it on, and refuses one of another pack, one sent the
// wrong way, or another under an ID already taken. Made-up layers and
// keys only.

import { addLayer, courseLayers, layerKey, parseDay, PLAN_LAYER_FORMAT, type PlanLayer } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { makeTestKey, signedFile } from '../../../packages/core/test/signed-fixtures';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { LayerImport } from '../src/plan/LayerImport';
import { PlanLayers } from '../src/plan/PlanLayers';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const key = makeTestKey();
const pack = 'dz.cem.4am.arabic.example';
const layer = (level: 'district' | 'school', id: string, fields: Partial<PlanLayer> = {}): PlanLayer => ({
  level,
  id,
  pack,
  title: level === 'district' ? 'توزيع مفتش (مثال)' : 'طبقة 4م1 و4م2 (مثال)',
  by: level === 'district' ? 'مفتش (مثال)' : 'منسّقة المادة (مثال)',
  made: parseDay('2026-09-28'),
  operations: [{ kind: 'budget', item: 'u1-3', sessions: 3 }],
  ...fields,
});
const file = (one: PlanLayer) => ({
  format: PLAN_LAYER_FORMAT,
  version: { major: 1, minor: 0 },
  country: 'dz',
  ...one,
});
const district = layer('district', 'example-district', {
  operations: [{ kind: 'move', item: 'u1-5', before: 'u1-4' }],
});
const school = layer('school', 'example-school');
const day = parseDay('2026-10-15');
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

async function taken(): Promise<TestData> {
  const data = { ...(await withDay()), keys: [key.trusted] };
  await data.book.record(day, addLayer(data.book.state, { layer: school }));
  await data.book.record(
    day,
    addLayer(data.book.state, { layer: district, signed: { key: key.trusted.id, file: '{}' } }),
  );
  return data;
}
const layers = () => (
  <PlanLayers courseId="c-1" onChanges={jest.fn()} onDetails={jest.fn()} onImport={jest.fn()} onExport={jest.fn()} />
);

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'shows each layer, never official, off until switched on (%s)',
  async (language) => {
    const data = await taken();
    await showSettingsScreen(layers(), data, language);
    const text = catalogues[language].planLayers;
    expect(has(`layer-${layerKey(school)}`)).toBe(true);
    expect(has(`layer-${layerKey(district)}`)).toBe(true);
    expect(settingsTexts().filter((one) => one === text.variant)).toHaveLength(2);
    expect(courseLayers(data.book.state, 'c-1').on).toEqual([]);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('says who signed a district layer, and that a school layer’s sender is not verified', async () => {
  await showSettingsScreen(layers(), await taken());
  const shown = settingsTexts();
  expect(shown).toContain('\u2068مفتش (مثال)\u2069 · موقّع من: \u2068Example holder\u2069');
  expect(shown).toContain('وصلت من \u2068منسّقة المادة (مثال)\u2069. لم يُتحقق من المرسل.');
  expect(shown).toContain('عملياتها في الفصل الأول.');
});

test('switches a layer on and off for this class alone, one at each level', async () => {
  const data = await taken();
  const other = layer('school', 'example-other', { operations: [{ kind: 'skip', item: 'u1-5' }] });
  await data.book.record(day, addLayer(data.book.state, { layer: other }));
  await showSettingsScreen(layers(), data);
  await pressSettings(`layer-switch-${layerKey(school)}`);
  await pressSettings(`layer-switch-${layerKey(district)}`);
  expect(courseLayers(data.book.state, 'c-1').on.map((one) => one.id)).toEqual(['example-district', 'example-school']);
  await showSettingsScreen(layers(), data);
  await pressSettings(`layer-switch-${layerKey(other)}`);
  expect(courseLayers(data.book.state, 'c-1').on.map((one) => one.id)).toEqual(['example-district', 'example-other']);
  await showSettingsScreen(layers(), data);
  await pressSettings(`layer-switch-${layerKey(district)}`);
  expect(courseLayers(data.book.state, 'c-1').on.map((one) => one.id)).toEqual(['example-other']);
  expect(data.book.state.layerSwitches.get('c-1/district')?.layer).toBeNull();
});

test('links the layers from the class plan, saying which are applied', async () => {
  const data = await taken();
  const onLayers = jest.fn();
  await showSettingsScreen(<ClassPlan courseId="c-1" onLayers={onLayers} />, data);
  expect(settingsTexts()).toContain(catalogues.ar.planLayers.noneOn);
  await pressSettings('plan-layers');
  expect(onLayers).toHaveBeenCalledTimes(1);
});

describe('importing a layer', () => {
  const open = async (text: string) => {
    const data = { ...(await withDay()), keys: [key.trusted] };
    const onTaken = jest.fn();
    jest.mocked(NativeInput.readFile).mockResolvedValueOnce(text);
    await showSettingsScreen(<LayerImport courseId="c-1" onTaken={onTaken} />, data);
    await pressSettings('layer-file');
    return { data, onTaken };
  };

  test('takes a school layer in, without switching it on', async () => {
    const { data, onTaken } = await open(JSON.stringify(file(school)));
    expect(has(`layer-${layerKey(school)}`)).toBe(true);
    expect(has(`layer-switch-${layerKey(school)}`)).toBe(false);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    await pressSettings('layer-take');
    expect(onTaken).toHaveBeenCalledTimes(1);
    expect(data.book.state.layers.map((one) => one.layer.id)).toEqual(['example-school']);
    expect(courseLayers(data.book.state, 'c-1').on).toEqual([]);
  });

  test('names what the layer itself adds, before it is taken in', async () => {
    const added = layer('school', 'example-added', {
      operations: [
        { kind: 'add', title: 'مراجعة (مثال)', sessions: 1, before: null },
        { kind: 'move', item: 'u1-5', before: 'add~s.example-added.1' },
      ],
    });
    await open(JSON.stringify(file(added)));
    const shown = settingsTexts().join('\n');
    expect(shown).toContain('«\u2068مراجعة (مثال)\u2069»، حصة واحدة، في آخر القائمة');
    expect(shown).toContain('قبل «\u2068مراجعة (مثال)\u2069»');
    expect(shown).not.toContain('add~s.example-added.1');
  });

  test('takes a signed district layer in with its file', async () => {
    const signed = signedFile(key, file(district));
    const { data } = await open(signed);
    await pressSettings('layer-take');
    expect(data.book.state.layers[0]?.signed).toEqual({ key: key.trusted.id, file: signed });
  });

  test('refuses a district layer sent unsigned, and one of another pack', async () => {
    await open(JSON.stringify(file({ ...district })));
    expect(settingsTexts()).toContain(catalogues.ar.planLayers.problems.level);
    expect(has('layer-take')).toBe(false);
    await open(JSON.stringify(file({ ...school, pack: 'dz.cem.3am.math.example' })));
    expect(has('layer-other-pack')).toBe(true);
    expect(has('layer-take')).toBe(false);
  });

  test('says a layer is already taken in, or that another has its ID', async () => {
    const { data } = await open(JSON.stringify(file(school)));
    await pressSettings('layer-take');
    jest.mocked(NativeInput.readFile).mockResolvedValueOnce(JSON.stringify(file(school)));
    await showSettingsScreen(<LayerImport courseId="c-1" onTaken={jest.fn()} />, data);
    await pressSettings('layer-file');
    expect(settingsTexts()).toContain(catalogues.ar.planLayers.held);
    jest.mocked(NativeInput.readFile).mockResolvedValueOnce(JSON.stringify(file({ ...school, title: 'نسخة أخرى' })));
    await showSettingsScreen(<LayerImport courseId="c-1" onTaken={jest.fn()} />, data);
    await pressSettings('layer-file');
    expect(settingsTexts()).toContain(catalogues.ar.planLayers.clash);
    expect(has('layer-take')).toBe(false);
  });
});
