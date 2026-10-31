// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The calendar input module on a PC (#250, part 3, answer 506), on a made-up
// page: an update, a timetable's CSV or a statement comes as a picked file
// within the phone's limits, each dialog offering its own file types, a
// statement PDF gives only its link, the camera is never asked for, a short
// key's code has no quiet zone, and a shared file keeps the phone's names and
// is never downloaded in place of sharing. The files are made up.

import './support/fake-dom.ts';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { accepted, downloads, queued } from './support/fake-dom.ts';
import { decoded } from './support/qr-read.ts';

const { default: CalendarInput, statementText } = await import('../src/native/CalendarInput.ts');

const UPDATE = '{"calendar":"made-up","note":"\u0639\u0637\u0644\u0629"}';

function pdf(body: string): File {
  return new File([`%PDF-1.7\n1 0 obj << /URI (${body}) >>\n%%EOF`], 'statement.pdf');
}

/** Rows with the four-cell white zone the screen draws around them. */
function zoned(rows: string[]): string[] {
  const blank = '0'.repeat(rows.length + 8);
  return [...Array<string>(4).fill(blank), ...rows.map((row) => `0000${row}0000`), ...Array<string>(4).fill(blank)];
}

beforeEach(() => {
  queued.length = 0;
  downloads.length = 0;
});

describe('the calendar input module on a PC', () => {
  it('reads an update as strict UTF-8 within 1 MB, and nothing when the dialog closes', async () => {
    queued.push(new File([UPDATE], 'update.json'));
    assert.equal(await CalendarInput.readFile(), UPDATE);
    queued.push(new File([new Uint8Array([0x7b, 0xe1, 0x7d])], 'cp1256.json'));
    await assert.rejects(CalendarInput.readFile(), { code: 'E_CALENDAR_INPUT' });
    queued.push(new File([new Uint8Array(1_048_577)], 'big.json'));
    await assert.rejects(CalendarInput.readFile(), { code: 'E_CALENDAR_INPUT' });
    queued.push(null);
    assert.equal(await CalendarInput.readFile(), null);
  });

  it('reads a timetable from a CSV dialog as strict UTF-8 within 1 MB', async () => {
    accepted.length = 0;
    queued.push(new File(['class,day\n4AM2,sunday\n'], 'timetable.csv'));
    assert.equal(await CalendarInput.readTable(), 'class,day\n4AM2,sunday\n');
    assert.equal(accepted[0], '.csv,text/csv,text/comma-separated-values,text/plain');
    queued.push(new File([new Uint8Array([0x63, 0xe1, 0x0a])], 'cp1256.csv'));
    await assert.rejects(CalendarInput.readTable(), { code: 'E_CALENDAR_INPUT' });
    queued.push(new File([new Uint8Array(1_048_577).fill(0x61)], 'big.csv'));
    await assert.rejects(CalendarInput.readTable(), { code: 'E_CALENDAR_INPUT' });
    queued.push(null);
    assert.equal(await CalendarInput.readTable(), null);
  });

  it("takes a statement PDF's link and nothing else from it", async () => {
    queued.push(pdf('minhajna-statement:eyJhIjoxfQ=='));
    assert.equal(await CalendarInput.readStatement(), 'minhajna-statement:eyJhIjoxfQ==');
    queued.push(pdf('https://example.invalid'));
    assert.equal(await CalendarInput.readStatement(), 'minhajna-statement:');
    const long = `minhajna-statement:${'A'.repeat(87_385)}`;
    assert.equal(statementText(new TextEncoder().encode(`%PDF-1.7 ${long}`)), 'minhajna-statement:');
    queued.push(new File([UPDATE], 'statement.json'));
    assert.equal(await CalendarInput.readStatement(), UPDATE);
    queued.push(new File([new Uint8Array(8_388_609)], 'big.pdf'));
    await assert.rejects(CalendarInput.readStatement(), { code: 'E_CALENDAR_INPUT' });
  });

  it('asks for no camera, and draws a short key with no quiet zone', async () => {
    await assert.rejects(CalendarInput.scanQr('Scan', 'Point', 'Cancel', true), { code: 'E_CALENDAR_CAMERA' });
    const rows = CalendarInput.qrRows('made-up-key').split('\n');
    assert.equal(rows.length, 21);
    assert.ok(rows[0]?.startsWith('1111111'));
    for (const key of ['made-up-key', '\u0645'.repeat(50)]) {
      assert.equal(decoded(zoned(CalendarInput.qrRows(key).split('\n'))), key);
    }
    assert.throws(() => CalendarInput.qrRows(''));
    assert.throws(() => CalendarInput.qrRows('k'.repeat(201)));
  });

  it("shares a file under the phone's names only, and fails where the browser cannot share it", async () => {
    await assert.rejects(CalendarInput.shareText('calendar-update.json', UPDATE, 'Update'), {
      code: 'E_CALENDAR_SHARE',
    });
    const shared: File[] = [];
    Object.assign(navigator, {
      canShare: () => true,
      share: (data: { files: File[] }) => void shared.push(...data.files),
    });
    try {
      await CalendarInput.shareText('calendar-update.json', UPDATE, 'Update');
      assert.equal(shared[0]?.name, 'calendar-update.json');
      assert.equal(await shared[0]?.text(), UPDATE);
      for (const name of ['Update.json', '../a.json', 'a.txt', `${'a'.repeat(65)}.json`]) {
        await assert.rejects(CalendarInput.shareText(name, UPDATE, 'Update'), { code: 'E_CALENDAR_SHARE' });
      }
      await assert.rejects(CalendarInput.shareText('a.json', UPDATE, 't'.repeat(501)), { code: 'E_CALENDAR_SHARE' });
    } finally {
      Reflect.deleteProperty(navigator, 'canShare');
      Reflect.deleteProperty(navigator, 'share');
    }
    assert.equal(downloads.length, 0);
  });
});
