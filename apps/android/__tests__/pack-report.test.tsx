// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Plan-error reports in a national world (#616, R-4.3-20, answer 770): a
// teacher sends one from the world's plans, with a name only when they chose
// credit, the server sees batches and nothing named, and the curators' page
// reads it with its item, release, note and credit. Everything is made up.

import { act } from 'react-test-renderer';
import { press, rendered, show, shown, type, unmount } from '../jest/editor-form';
import { source as clean } from '../jest/editor-source';
import { packService } from '../jest/pack-release';
import { readPackReports, sendPackReport } from '../src/editor/pack-report-session';
import { ReportsPage } from '../src/editor/ReportsPage';
import { leaveWorldNetwork } from '../src/network/world-network';
import { WorldReportForm } from '../src/school/WorldReportForm';

const source = { ...clean, status: 'community' as const, release: '2026.7' };

async function drain() {
  await act(async () => {
    for (let i = 0; i < 40; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

type Service = Awaited<ReturnType<typeof packService>>;

const report = (note: string, name: string | null = null, release = source.release) => ({
  id: source.id,
  release,
  item: source.items[0].id,
  kind: 'page' as const,
  note,
  name,
});

const inbox = (f: Service) => <ReportsPage {...f.editor} send={f.server.send} dayText={(day) => `day ${day}`} />;

const rows = () =>
  rendered().root.findAll((node) => node.props.testID === 'report-row' && typeof node.type === 'string');
const said = () => JSON.stringify(rendered().toJSON());

test('a report travels sealed, once, and dated by the world', async () => {
  const f = await packService();
  const word = report('Made-up note in clear', 'Made-up Name');
  f.server.seen.length = 0;
  const sent = await sendPackReport(f.editor, word, f.server.send);
  expect(sent.day).toBe(f.world.date);
  const again = await sendPackReport(f.editor, word, f.server.send);
  expect(again).toEqual(sent);
  const posts = f.server.seen.filter((one) => one.method === 'POST');
  expect(posts).toHaveLength(1);
  for (const one of f.server.seen) expect(JSON.stringify(one)).not.toMatch(/Made-up|example/u);
  expect(await readPackReports(f.editor, f.server.send)).toEqual([sent]);
});

test('a world with no report reads as none, and the latest comes first', async () => {
  const f = await packService();
  expect(await readPackReports(f.editor, f.server.send)).toEqual([]);
  await sendPackReport(f.editor, report('First'), f.server.send);
  await sendPackReport(f.editor, report('Second'), f.server.send);
  expect((await readPackReports(f.editor, f.server.send)).map((one) => one.note)).toEqual(['Second', 'First']);
});

test('the teacher reports an item, named only by choice', async () => {
  const f = await packService();
  await show(<WorldReportForm pack={source} editor={f.editor} send={f.server.send} />, 'en');
  expect(rendered().root.findByProps({ testID: 'report-send' }).props.disabled).toBe(true);
  await press(`report-item-${source.items[0].id}`);
  await press('report-kind-page');
  await type('report-note', 'Made-up: the page is 26');
  expect(shown('report-name')).toBe(false);
  await press('report-send');
  await drain();
  expect(shown('report-sent')).toBe(true);
  const [first] = await readPackReports(f.editor, f.server.send);
  expect(first).toMatchObject({ kind: 'page', name: null, release: '2026.7', note: 'Made-up: the page is 26' });
  await press(`report-item-${source.items[0].id}`);
  await type('report-note', 'Made-up: another');
  await press('report-credit');
  expect(rendered().root.findByProps({ testID: 'report-send' }).props.disabled).toBe(true);
  await type('report-name', 'Made-up Name');
  await press('report-send');
  await drain();
  const [latest] = await readPackReports(f.editor, f.server.send);
  expect(latest.name).toBe('Made-up Name');
});

test('a failed send says so, keeps the words, and drops an earlier sent line', async () => {
  const f = await packService();
  let failing = false;
  const send: typeof f.server.send = (request) =>
    failing && request.method === 'POST'
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : f.server.send(request);
  await show(<WorldReportForm pack={source} editor={f.editor} send={send} />, 'en');
  await press(`report-item-${source.items[0].id}`);
  await type('report-note', 'Made-up one');
  await press('report-send');
  await drain();
  failing = true;
  await press(`report-item-${source.items[0].id}`);
  await type('report-note', 'Made-up two');
  await press('report-send');
  await drain();
  expect(shown('report-sent')).toBe(false);
  expect(said()).toContain('was not sent');
  expect(said()).toContain('Made-up two');
});

test('the curators read each report, its credit as chosen, filtered by release', async () => {
  const f = await packService();
  await sendPackReport(f.editor, report('Made-up one'), f.server.send);
  await sendPackReport(f.editor, report('Made-up two', 'Made-up Name', '2026.8'), f.server.send);
  await show(inbox(f), 'en');
  await drain();
  expect(rows()).toHaveLength(2);
  expect(said()).toContain('Made-up two');
  expect(said()).toContain('Made-up Name');
  expect(said()).toContain('No credit asked');
  expect(said()).toContain(source.id);
  await press(`reports-filter-${source.id}@2026.7`);
  expect(rows()).toHaveLength(1);
  expect(said()).not.toContain('Made-up Name');
});

test('a failed read says so, and reading again finds them', async () => {
  const f = await packService();
  await sendPackReport(f.editor, report('Made-up one'), f.server.send);
  let failing = true;
  const send: typeof f.server.send = (request) =>
    failing ? Promise.resolve({ status: 500, body: null, retryAfter: null }) : f.server.send(request);
  await show(<ReportsPage {...f.editor} send={send} dayText={(day) => day} />, 'en');
  await drain();
  expect(said()).toContain('could not be read');
  failing = false;
  await press('reports-reload');
  await drain();
  expect(rows()).toHaveLength(1);
});
