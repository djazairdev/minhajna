// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a PC sends where the phone shares (#250, answers 509 and 523), as a
// browser may share no JSON file and may have no share menu: a school layer
// and a statement too long for one code are saved, counting only once saved;
// the pilot's timings go through the browser's share menu or are copied, the
// screen says which, and the button waits while the menu is open. The phone's
// sharing stays in its own tests. Made-up records only.

import { nextSeq, parseDay, recordChange, sharingHistory } from '@minhajna/core';
import { Platform, Share } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import type { TestData } from '../jest/app-data';
import { calendarInput } from '../jest/calendar-input';
import { mount, press, root, texts, unmount } from '../jest/components-screen';
import { browserState, endSends, resetBrowser } from '../jest/fake-browser';
import { FakeStorage } from '../jest/fake-storage';
import { statementClasses } from '../jest/statement-classes';
import { withDay } from '../jest/today-day';
import files from '../src/native/NativeMinhajnaFiles';
import { PilotTimings } from '../src/pilot/PilotTimings';
import { timingStore } from '../src/pilot/timing-store';
import { LayerExport } from '../src/plan/LayerExport';
import { StatementShare } from '../src/sharing/StatementShare';
import { coreContext } from '../src/storage/core-context';
import text from '../src/text/ar.json';

jest.mock('../src/native/NativeMinhajnaBrowser', () => jest.requireActual<object>('../jest/fake-browser'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const day = parseDay('2026-10-15');
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const disabled = (testID: string) => {
  const found = root().find((node) => node.props.testID === testID && typeof node.type === 'string');
  return (found.props as { accessibilityState?: { disabled?: boolean } }).accessibilityState?.disabled === true;
};

async function type(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    const [field] = root().findAll(
      (node) => node.props.testID === testID && typeof node.props.onChangeText === 'function',
    );
    (field?.props as { onChangeText: (next: string) => void }).onChangeText(value);
    await Promise.resolve();
  });
}

/** A class with one plan change in force, so it has a layer to save. */
async function withChange(): Promise<TestData> {
  const data = await withDay();
  const context = coreContext({ ...data, state: data.book.state });
  const seq = nextSeq(data.book.state.decisions, 'c-1');
  const draft = { id: 'k1', kind: 'skip' as const, item: 'u1-5', courseId: 'c-1', day, seq };
  await data.book.record(day, recordChange(context, draft));
  return data;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetBrowser();
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

test('a school layer is saved on a PC, and counts only once saved', async () => {
  const makeText = jest.spyOn(files, 'makeText');
  const saveFile = jest.spyOn(files, 'saveFile').mockResolvedValueOnce(false);
  await mount(await withChange(), <LayerExport courseId="c-1" />);
  await type('export-title', 'Parallel classes (made-up)');
  await type('export-by', 'The coordinator (made-up)');
  expect(texts()).toContain(text.planLayers.export.pc.share);
  await press('export-share');
  expect(has('export-shared')).toBe(false);
  expect(has('export-failed')).toBe(false);
  await press('export-share');
  expect(makeText.mock.calls.map(([, name]) => name)).toEqual([
    'minhajna-layer-2026-10-15.json',
    'minhajna-layer-2026-10-15.json',
  ]);
  expect(saveFile).toHaveBeenCalledTimes(2);
  expect(calendarInput.shareText).not.toHaveBeenCalled();
  expect(texts()).toContain(text.planLayers.export.pc.shared);
  saveFile.mockRejectedValueOnce(new Error('E_FILE'));
  await type('export-by', 'Another coordinator (made-up)');
  await press('export-share');
  expect(texts()).toContain(text.planLayers.export.pc.failed);
});

test('a statement too long for one code is saved on a PC, and counts only once saved', async () => {
  const data = await statementClasses('\u0645'.repeat(120));
  const shareFile = jest.spyOn(files, 'shareFile');
  const saveFile = jest.spyOn(files, 'saveFile').mockResolvedValueOnce(false);
  await mount(data, <StatementShare courseId="c-m" onCourse={jest.fn()} />);
  expect(texts()).toContain(text.statement.pc.tooLong);
  expect(texts()).not.toContain(text.statement.tooLong);
  await press('statement-file');
  expect(sharingHistory(data.book.entries)).toEqual([]);
  await press('statement-file');
  expect(saveFile).toHaveBeenCalledTimes(2);
  expect(shareFile).not.toHaveBeenCalled();
  expect(sharingHistory(data.book.entries).map((one) => one.how)).toEqual(['file']);
  expect(texts()).toContain(text.documents.output.saved);
});

test('the pilot timings are shared or copied on a PC, saying which, and wait for the menu', async () => {
  const share = jest.spyOn(Share, 'share');
  const storage = FakeStorage.unlocked();
  storage.timings = [{ kind: 'session', week: parseDay('2026-10-11'), tenths: 40, oneTap: true }];
  const store = timingStore(storage.asSpec(), 0);
  await mount(await withDay(), <PilotTimings store={store} />);
  expect(texts()).toContain(text.pilotTimings.pc.shareLine);
  await press('timings-share');
  expect(browserState.sent).toHaveLength(1);
  expect(share).not.toHaveBeenCalled();
  expect(texts()).toContain(text.pilotTimings.copied);
  browserState.sendAs = 'failed';
  await press('timings-share');
  expect(texts()).toContain(text.pilotTimings.copyFailed);
  browserState.sendAs = 'shared';
  browserState.holds = true;
  await press('timings-share');
  expect(disabled('timings-share')).toBe(true);
  expect(has('timings-copied') || has('timings-failed')).toBe(false);
  await ReactTestRenderer.act(async () => {
    endSends();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(disabled('timings-share')).toBe(false);
  expect(browserState.sent).toHaveLength(3);
});
