// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The coordinator's school layer (#226, answers 337, 342 and 345): built
// from the class's changes in force, named and credited as typed, shown as
// colleagues will read it, and shared as a file another teacher reads back
// as a school layer, with nothing recorded. Made-up data only.

import { nextSeq, parseDay, readLayerFile, recordChange, type PlanChange } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { LayerExport } from '../src/plan/LayerExport';
import { PlanLayers } from '../src/plan/PlanLayers';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
type Draft = PlanChange extends infer C ? (C extends unknown ? Omit<C, 'seq' | 'courseId' | 'day'> : never) : never;

async function changed(...drafts: Draft[]): Promise<TestData> {
  const data = await withDay();
  for (const draft of drafts) {
    const context = coreContext({ ...data, state: data.book.state });
    const seq = nextSeq(data.book.state.decisions, 'c-1');
    await data.book.record(day, recordChange(context, { ...draft, courseId: 'c-1', day, seq }));
  }
  return data;
}
const fill = async () => {
  await typeSettings('export-title', 'الأقسام الموازية (مثال)');
  await typeSettings('export-by', 'منسّقة المادة (مثال)');
};

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
  'shares the class changes as a school layer, recording nothing (%s)',
  async (language) => {
    const data = await changed(
      { id: 'a1', kind: 'add', title: 'مراجعة (مثال)', sessions: 1, before: 'u1-4' },
      { id: 'k1', kind: 'skip', item: 'u1-5' },
    );
    const entries = data.book.entries.length;
    await showSettingsScreen(<LayerExport courseId="c-1" />, data, language);
    expect(settingsControl('export-share').disabled).toBe(true);
    await fill();
    expect(settingsTexts()).toContain(catalogues[language].planLayers.export.holds);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    await pressSettings('export-share');
    expect(NativeInput.shareText).toHaveBeenCalledTimes(1);
    const [name, file] = jest.mocked(NativeInput.shareText).mock.calls[0];
    expect(name).toBe('minhajna-layer-2026-10-15.json');
    const read = await readLayerFile(file, [], () => Promise.resolve(false), data.profile);
    expect(read.ok && read.added.layer).toEqual(
      expect.objectContaining({
        level: 'school',
        title: 'الأقسام الموازية (مثال)',
        by: 'منسّقة المادة (مثال)',
        operations: [
          { kind: 'add', title: 'مراجعة (مثال)', sessions: 1, before: 'u1-4' },
          { kind: 'skip', item: 'u1-5' },
        ],
      }),
    );
    expect(has('export-shared')).toBe(true);
    expect(data.book.entries.length).toBe(entries);
  },
);

test('shares an edited layer under a new ID, and the same one again under its own', async () => {
  const data = await changed({ id: 'k1', kind: 'skip', item: 'u1-5' });
  await showSettingsScreen(<LayerExport courseId="c-1" />, data);
  await fill();
  await pressSettings('export-share');
  await pressSettings('export-share');
  await typeSettings('export-title', 'عنوان مصحّح (مثال)');
  await pressSettings('export-share');
  const ids = jest.mocked(NativeInput.shareText).mock.calls.map(([, file]) => (JSON.parse(file) as { id: string }).id);
  expect(ids[0]).toBe(ids[1]);
  expect(ids[2]).not.toBe(ids[0]);
});

test('needs a title and who made it, each on one line', async () => {
  await showSettingsScreen(<LayerExport courseId="c-1" />, await changed({ id: 'k1', kind: 'skip', item: 'u1-5' }));
  await typeSettings('export-title', 'الأقسام الموازية (مثال)');
  expect(has('export-needs')).toBe(true);
  expect(settingsControl('export-share').disabled).toBe(true);
});

test('says so when the share fails, and offers nothing without changes', async () => {
  jest.mocked(NativeInput.shareText).mockRejectedValueOnce(new Error('E_CALENDAR_SHARE'));
  await showSettingsScreen(<LayerExport courseId="c-1" />, await changed({ id: 'k1', kind: 'skip', item: 'u1-5' }));
  await fill();
  await pressSettings('export-share');
  expect(has('export-failed')).toBe(true);
  await showSettingsScreen(<LayerExport courseId="c-1" />, await withDay());
  expect(has('export-none')).toBe(true);
  expect(has('export-share')).toBe(false);
});

test('never shares a layer too large for a layer file', async () => {
  const many = Array.from({ length: 201 }, (_, n): Draft => ({
    id: `b${n}`,
    kind: 'budget',
    item: 'u1-3',
    sessions: 2,
  }));
  await showSettingsScreen(<LayerExport courseId="c-1" />, await changed(...many));
  await fill();
  expect(has('export-too-big')).toBe(true);
  expect(settingsControl('export-share').disabled).toBe(true);
});

test('Plan-layers offers the export only to a class with changes', async () => {
  const layers = (onExport = jest.fn()) => (
    <PlanLayers courseId="c-1" onChanges={jest.fn()} onDetails={jest.fn()} onImport={jest.fn()} onExport={onExport} />
  );
  await showSettingsScreen(layers(), await withDay());
  expect(has('layers-export')).toBe(false);
  const onExport = jest.fn();
  await showSettingsScreen(layers(onExport), await changed({ id: 'k1', kind: 'skip', item: 'u1-5' }));
  await pressSettings('layers-export');
  expect(onExport).toHaveBeenCalledTimes(1);
});
