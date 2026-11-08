// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the join screen says while the answer is not there (answer 808): it
// loads, the server wakes, stayed asleep, is busy, the network fails, the
// code opens nothing or what arrives cannot be read, each with a retry;
// leaving stops the request, and only the latest code's answer shows; the
// scan fills the code on a phone and is hidden on a PC. Every control is
// named in each language and direction. Made-up data only.

import { Platform } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarInput } from '../jest/calendar-input';
import { MADE_UP_CODE, MADE_UP_DELIVERY, serveJoin } from '../jest/directory-join';
import {
  CHOSEN,
  closeJoin,
  joinRoot,
  press,
  showJoin,
  shown,
  typeCode,
  withId,
  withSchools,
} from '../jest/join-screen';
import { useJoin, type JoinLoad } from '../src/join/useJoin';
import * as directory from '../src/network/directory-network';
import text from '../src/text/ar.json';
import { catalogues, i18n, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await closeJoin();
  await i18n.changeLanguage('ar');
  calendarInput.scanQr.mockReset();
  jest.restoreAllMocks();
});

async function asked() {
  await showJoin(await withSchools(CHOSEN));
  await typeCode(MADE_UP_CODE);
  await press('join-next');
}

test.each([
  ['E_DIRECTORY_MISSING', text.join.unknown],
  ['E_DIRECTORY_BAD', text.join.unknown],
  ['E_DIRECTORY_BUSY', text.setup.directory.busy],
  ['E_DIRECTORY_FULL', text.setup.directory.busy],
  ['E_DIRECTORY_WAKING', text.join.asleep],
  ['E_DIRECTORY_NETWORK', text.join.offline],
])('says what %s means, and tries again', async (code, line) => {
  const join = serveJoin(code);
  await asked();
  expect(shown()).toContain(line);
  expect(accessibilityProblems(joinRoot())).toEqual([]);
  await press('join-retry');
  expect(join).toHaveBeenCalledTimes(2);
});

test('says when what arrives cannot be read', async () => {
  jest.spyOn(directory, 'directoryPost').mockResolvedValue({ format: 1 });
  await asked();
  expect(shown()).toContain(text.join.refused);
});

test('says the server wakes, and stops the request on leaving', async () => {
  let signal: AbortSignal | undefined;
  jest.spyOn(directory, 'directoryPost').mockImplementation((_path, _body, _code, options) => {
    signal = options?.signal;
    options?.onWaking?.();
    return new Promise(() => undefined);
  });
  await asked();
  expect(shown()).toContain(text.setup.directory.waking);
  expect(withId('join-next')[0].props.disabled).toBe(true);
  expect(signal?.aborted).toBe(false);
  await closeJoin();
  expect(signal?.aborted).toBe(true);
});

test('shows only the answer to the latest code', async () => {
  const later = {
    ...MADE_UP_DELIVERY,
    classes: [MADE_UP_DELIVERY.classes[0]],
    sessions: [MADE_UP_DELIVERY.sessions[0]],
  };
  let answerFirst: (answer: unknown) => void = () => undefined;
  jest
    .spyOn(directory, 'directoryPost')
    .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
    .mockResolvedValueOnce(later);
  const seen: { ask?: (code: string) => void; load?: JoinLoad } = {};
  function Probe() {
    const { ask, load } = useJoin();
    seen.ask = ask;
    seen.load = load;
    return null;
  }
  let probe: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    probe = ReactTestRenderer.create(<Probe />);
  });
  await ReactTestRenderer.act(async () => {
    seen.ask?.('FIRSTCODE0000000');
    seen.ask?.('LATERCODE0000000');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  await ReactTestRenderer.act(async () => {
    answerFirst(MADE_UP_DELIVERY);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  const load = seen.load;
  expect(load?.kind === 'ready' ? [load.code, load.delivery.classes.length] : load).toEqual(['LATERCODE0000000', 1]);
  await ReactTestRenderer.act(() => probe?.unmount());
});

test('fills the code from a scan on a phone, and says when the camera fails', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const join = serveJoin();
  await showJoin(await withSchools(CHOSEN));
  calendarInput.scanQr.mockResolvedValueOnce(null);
  await press('join-scan');
  expect(join).not.toHaveBeenCalled();
  calendarInput.scanQr.mockRejectedValueOnce(new Error('made-up failure'));
  await press('join-scan');
  expect(withId('join-code')[0].props.error).toBe(text.join.camera);
  calendarInput.scanQr.mockResolvedValueOnce(MADE_UP_CODE);
  await press('join-scan');
  expect(join).toHaveBeenCalledWith('/directory/join', { code: '7K2M9Q4RX8ZT3HN6' }, undefined, expect.anything());
  expect(withId('join-preview')).toHaveLength(1);
});

test('hides the scan on a PC', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await showJoin(await withSchools(CHOSEN));
  expect(withId('join-scan')).toEqual([]);
  expect(withId('join-code')).toHaveLength(1);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  serveJoin();
  await showJoin(await withSchools(CHOSEN), undefined, direction);
  expect(accessibilityProblems(joinRoot())).toEqual([]);
  await typeCode('1234');
  await press('join-next');
  expect(accessibilityProblems(joinRoot())).toEqual([]);
  await typeCode(MADE_UP_CODE);
  await press('join-next');
  expect(accessibilityProblems(joinRoot())).toEqual([]);
});
