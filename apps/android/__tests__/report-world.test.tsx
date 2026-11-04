// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A problem report sent to the open demo world's operators (#619, answer 657):
// the note cleaned of control characters the server refuses before it is shown;
// exactly the part, the note and the version sent, through the world for its
// own path; the ID and token taken in the server's shape; a world holding its
// 200 reports, a world gone and any other answer each thrown as such; deleting
// with the report's own token, or said as no longer in the world. On the Report
// screen: no world part without a world open, and the share line as it was;
// with one, which lines go and what never does, and the share line saying
// sending happens only on a press; sending waiting, with the reason, for a note
// that shows, one short enough once names are replaced, and the app's version;
// the note sent as previewed, with pupils' names replaced and never Android's
// version or the last screens; sending said, the button waiting meanwhile and a
// second press sending nothing; then that it was sent and a way to delete it,
// the deletion said, a report no longer in the world said, and sending again; a
// full, erased or closed world said as alerts, deleting said, and a gone or
// closed world in delete's own words; and the words with the same keys and
// placeholders in every language. Made-up records only.

import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { mount, press, root, settle, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import type { Send } from '../src/demo/world-session';
import { safeNote } from '../src/help/problem-report';
import { deleteFromWorld, sendToWorld } from '../src/help/report-world';
import { ProblemReport } from '../src/help/ProblemReport';
import native from '../src/native/NativeMinhajnaBuild';
import type { WorldRequest } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.report.world;
const ID = '0123456789abcdef'.repeat(2);
const TOKEN = 'made-up-report-token_'.padEnd(43, 'x');
const NO_WORLD = { statusCode: 404, message: 'no world has this id and pass' };
const NO_REPORT = { statusCode: 404, message: 'the world has no such report, or the token is not its own' };
const answer = (body: unknown, status = 200) => Promise.resolve({ status, body, retryAfter: null });
const iso = (value: string) => `${String.fromCharCode(0x2068)}${value}${String.fromCharCode(0x2069)}`;

beforeEach(() => {
  jest
    .spyOn(native, 'describe')
    .mockResolvedValue({ version: '0.5.0', versionCode: 5, apkSha256: '', signerSha256: null });
});
afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

async function typeNote(text: string) {
  await ReactTestRenderer.act(async () => {
    const field = root().findAll(
      (node) => node.props.testID === 'report-note' && typeof node.props.onChangeText === 'function',
    )[0];
    (field?.props as { onChangeText: (value: string) => void }).onChangeText(text);
    await Promise.resolve();
  });
}
const disabled = (testID: string) =>
  (
    root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
      .accessibilityState as { disabled?: boolean } | undefined
  )?.disabled === true;
/** Presses, then lets the request's answer land. */
async function tap(testID: string) {
  await press(testID);
  await ReactTestRenderer.act(settle);
}
const shown = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

test('cleans the note of control characters the server refuses before showing it', () => {
  const t = i18n.t.bind(i18n) as never;
  const note = `one\r\ntwo\rthree\tfour${String.fromCharCode(0xd800)}`;
  expect(safeNote(t, note, [])).toBe(`one\ntwo\nthree four${String.fromCharCode(0xfffd)}`);
});

test('sends exactly the part, the note and the version, and reads the answer', async () => {
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>(() => answer({ id: ID, token: TOKEN }, 201));
  const report = { part: 'roll', note: 'A\nB', version: '0.5.0', android: '14' } as const;
  await expect(sendToWorld('AAAAA', report, send)).resolves.toEqual({ id: ID, token: TOKEN });
  expect(send).toHaveBeenCalledWith({
    method: 'POST',
    path: '/worlds/AAAAA/problems',
    body: { part: 'roll', note: 'A\nB', version: '0.5.0' },
  });
  for (const [body, status, code] of [
    [{ message: 'a world keeps at most 200 problem reports' }, 409, 'E_REPORTS_FULL'],
    [NO_WORLD, 404, 'E_NO_SUCH_WORLD'],
    [{ message: 'Cannot POST' }, 404, 'E_WORLD_SERVER'],
    [{ id: ID }, 201, 'E_WORLD_SERVER'],
    [{ id: 'x', token: TOKEN }, 201, 'E_WORLD_SERVER'],
    [{ id: ID, token: TOKEN }, 200, 'E_WORLD_SERVER'],
    [null, 429, 'E_WORLD_BUSY'],
  ] as const)
    await expect(sendToWorld('AAAAA', report, () => answer(body, status))).rejects.toMatchObject({ code });
});

test('deletes with the report’s own token, or says it is no longer in the world', async () => {
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>(() => answer({ id: ID }));
  const sent = { id: ID, token: TOKEN };
  await expect(deleteFromWorld('AAAAA', sent, send)).resolves.toBe('deleted');
  expect(send).toHaveBeenCalledWith({ method: 'POST', path: `/worlds/AAAAA/problems/${ID}/delete`, starter: TOKEN });
  await expect(deleteFromWorld('AAAAA', sent, () => answer(NO_REPORT, 404))).resolves.toBe('gone');
  await expect(deleteFromWorld('AAAAA', sent, () => answer(NO_WORLD, 404))).rejects.toMatchObject({
    code: 'E_NO_SUCH_WORLD',
  });
});

test('offers nothing more without a world open, and keeps the share line as it was', async () => {
  await mount(await withPupils(), <ProblemReport steps={[]} world={null} />);
  expect(shown('report-world')).toBe(false);
  expect(texts()).toContain(ar.report.offline);
});

test('says why sending waits: no note that shows, one too long, or no version', async () => {
  await mount(await withPupils(), <ProblemReport steps={[]} world="AAAAA" send={() => answer(null, 500)} />);
  const why = () => texts().filter((line) => [ar.report.needsNote, words.tooLong, words.noVersion].includes(line));
  expect(texts()).toContain(words.offline);
  expect(why()).toEqual([ar.report.needsNote, ar.report.needsNote]);
  await typeNote(String.fromCharCode(0x200b, 0x2060));
  expect(why()).toContain(ar.report.needsNote);
  expect(disabled('report-world-send')).toBe(true);
  await typeNote('ريان، '.repeat(166).trim());
  expect(why()).toEqual([words.tooLong]);
  expect(disabled('report-world-send')).toBe(true);
  await typeNote('مشكلة');
  expect(why()).toEqual([]);
  expect(disabled('report-world-send')).toBe(false);
  await unmount();
  jest.spyOn(native, 'describe').mockRejectedValue(new Error('no build facts'));
  await mount(await withPupils(), <ProblemReport steps={[]} world="AAAAA" send={() => answer(null, 500)} />);
  await typeNote('مشكلة');
  await ReactTestRenderer.act(settle);
  expect(why()).toEqual([words.noVersion]);
  expect(disabled('report-world-send')).toBe(true);
});

test('sends the note as previewed, waiting meanwhile, then deletes it while the screen is open', async () => {
  const bodies: WorldRequest[] = [];
  let land: (() => void) | undefined;
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>((request) => {
    bodies.push(request);
    if (request.path.endsWith('/delete'))
      return answer(bodies.length > 2 ? NO_REPORT : { id: ID }, bodies.length > 2 ? 404 : 200);
    return new Promise((resolve) => {
      land = () => resolve({ status: 201, body: { id: ID, token: TOKEN }, retryAfter: null });
    });
  });
  await mount(await withPupils(), <ProblemReport steps={['Today', 'Roll']} world="AAAAA" send={send} />);
  expect(texts()).toEqual(expect.arrayContaining([words.title, words.what]));
  await typeNote('بعد مناداة مختلق آية، اختفى غيابها.');
  await press('report-world-send');
  expect(disabled('report-world-send')).toBe(true);
  expect(texts()).toContain(words.sending);
  await press('report-world-send');
  expect(send).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => {
    land!();
    await settle();
  });
  expect(bodies[0]).toEqual({
    method: 'POST',
    path: '/worlds/AAAAA/problems',
    body: { part: 'today', note: 'بعد مناداة تلميذ 1، اختفى غيابها.', version: '0.5.0' },
  });
  expect(texts()).toEqual(expect.arrayContaining([words.sent.replace('{{id}}', iso('01234567')), words.whileOpen]));
  expect(shown('report-world-send')).toBe(false);
  expect(accessibilityProblems(root())).toEqual([]);
  await tap('report-world-delete');
  expect(bodies[1]).toEqual({ method: 'POST', path: `/worlds/AAAAA/problems/${ID}/delete`, starter: TOKEN });
  expect(texts()).toContain(words.deleted.replace('{{id}}', iso('01234567')));
  await press('report-world-send');
  await ReactTestRenderer.act(async () => {
    land!();
    await settle();
  });
  await tap('report-world-delete');
  expect(texts()).toContain(words.gone.replace('{{id}}', iso('01234567')));
  expect(send).toHaveBeenCalledTimes(4);
});

test('says a full, erased or closed world as an alert, and keeps the report to send', async () => {
  let reply: ReturnType<Send> = answer({ message: 'a world keeps at most 200 problem reports' }, 409);
  await mount(await withPupils(), <ProblemReport steps={[]} world="AAAAA" send={() => reply} />);
  await typeNote('مشكلة');
  const alert = () =>
    root().findAll((node) => node.props.testID === 'report-world-problem' && 'accessibilityRole' in node.props)[0]
      ?.props as { accessibilityRole?: string; accessibilityLiveRegion?: string; children?: unknown } | undefined;
  await tap('report-world-send');
  expect(alert()).toMatchObject({
    accessibilityRole: 'alert',
    accessibilityLiveRegion: 'assertive',
    children: words.full,
  });
  reply = answer(NO_WORLD, 404);
  await tap('report-world-send');
  expect(alert()).toMatchObject({ children: words.erased });
  reply = Promise.reject(Object.assign(new Error('No world is open'), { code: 'E_NO_WORLD' }));
  reply.catch(() => undefined);
  await tap('report-world-send');
  expect(alert()).toMatchObject({ children: words.closed });
  expect(shown('report-world-send')).toBe(true);
});

test('says deleting, and a gone or closed world in delete’s own words', async () => {
  let land: ((answer: { status: number; body: unknown }) => void) | undefined;
  let fail: Error | null = null;
  const send: Send = (request) =>
    request.path.endsWith('/delete')
      ? fail !== null
        ? Promise.reject(fail)
        : new Promise((resolve) => {
            land = ({ status, body }) => resolve({ status, body, retryAfter: null });
          })
      : answer({ id: ID, token: TOKEN }, 201);
  await mount(await withPupils(), <ProblemReport steps={[]} world="AAAAA" send={send} />);
  await typeNote('مشكلة');
  await tap('report-world-send');
  await press('report-world-delete');
  expect(texts()).toContain(words.deleting);
  await ReactTestRenderer.act(async () => {
    land!({ status: 404, body: NO_WORLD });
    await settle();
  });
  expect(texts()).toContain(words.gone.replace('{{id}}', iso('01234567')));
  await tap('report-world-send');
  fail = Object.assign(new Error('No world is open'), { code: 'E_NO_WORLD' });
  await tap('report-world-delete');
  expect(texts()).toContain(words.closedDelete);
  expect(shown('report-world-delete')).toBe(true);
});

test('the words have the same keys and placeholders in every language', () => {
  const places = (value: unknown): unknown =>
    typeof value === 'string'
      ? (value.match(/\{\{\w+\}\}/gu) ?? []).sort()
      : Object.entries(value as object).map(([key, one]) => [key, places(one)]);
  for (const one of [en, fr]) expect(places(one.report.world)).toEqual(places(words));
});
