// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The files module on a PC (#250, part 3), on a made-up page: files made
// from text, plain or AES-256 in WinZip's AE-2 form as the phone writes
// them, downloaded and forgotten; a picked text file read in Excel's
// encodings and refused when it is binary or too large; a picked archive's
// one file read back, and refused as the phone refuses it; the browser's
// save dialog used where it has one, its closing said; sharing refused,
// never a download, where the browser cannot share the file; and a file
// dialog that closes saying nothing replaced once the teacher is back in
// the page. The texts and passwords are made up.

import './support/fake-dom.ts';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { downloads, focusPage, queued } from './support/fake-dom.ts';

const { default: Files } = await import('../src/native/Files.ts');

const PASSWORD = 'made up password';
const BACKUP = '{"entries":[],"note":"\u0645"}';

async function picked(file: Blob, name: string) {
  queued.push(new File([file], name));
  const opened = await Files.openZip();
  assert.ok(opened !== null);
  return opened.token;
}

async function made(token: string): Promise<Blob> {
  await Files.saveFile(token);
  const last = downloads.at(-1);
  assert.ok(last !== undefined);
  return last.file;
}

/** The AES extra fields of an archive: version, vendor, strength and the method inside. */
function aesFields(bytes: Uint8Array): string[] {
  const found: string[] = [];
  for (let at = 0; at + 11 <= bytes.length; at++) {
    if (bytes[at] === 0x01 && bytes[at + 1] === 0x99 && bytes[at + 2] === 7 && bytes[at + 3] === 0) {
      const vendor = String.fromCharCode(bytes[at + 6] ?? 0, bytes[at + 7] ?? 0);
      found.push(`AE-${bytes[at + 4]} ${vendor} ${bytes[at + 8]} ${bytes[at + 9]}`);
    }
  }
  return found;
}

beforeEach(() => {
  queued.length = 0;
  downloads.length = 0;
});

describe('the files module on a PC', () => {
  it('makes a plain file and an AES-256 one as the phone does, then downloads and forgets each', async () => {
    const plain = await Files.makeText(BACKUP, 'backup.json', '');
    const file = await made(plain);
    assert.equal(downloads.at(-1)?.name, 'backup.json');
    assert.equal(await file.text(), BACKUP);
    await assert.rejects(Files.saveFile(plain), { code: 'E_FILE' });
    const sealed = await made(await Files.makeText(BACKUP, 'backup.json', PASSWORD));
    assert.equal(downloads.at(-1)?.name, 'backup.json.zip');
    const bytes = new Uint8Array(await sealed.arrayBuffer());
    assert.deepEqual([...new Set(aesFields(bytes))], ['AE-2 AE 3 8']);
    assert.ok(!new TextDecoder('latin1').decode(bytes).includes('entries'));
    const token = await picked(sealed, 'backup.json.zip');
    assert.equal(await Files.readZip(token, 'backup.json', PASSWORD, true), BACKUP);
  });

  it('zips several texts, each named once and with no folder', async () => {
    const zip = await made(await Files.makeZip(['a.json', 'b.csv'], ['{}', 'x;y'], 'export', ''));
    const token = await picked(zip, 'export.zip');
    assert.equal(await Files.readZip(token, 'b.csv', '', false), 'x;y');
    await assert.rejects(Files.makeZip(['a.json', 'a.json'], ['1', '2'], 'export', ''), { code: 'E_FILE_NAME' });
    await assert.rejects(Files.makeZip(['dir/a.json'], ['1'], 'export', ''), { code: 'E_FILE_NAME' });
    await assert.rejects(Files.makeZip([], [], 'export', ''), { code: 'E_FILE_NAME' });
    await assert.rejects(Files.makeText('x', '.hidden', ''), { code: 'E_FILE_NAME' });
  });

  it('refuses a picked archive as the phone refuses it', async () => {
    const sealed = await made(await Files.makeText(BACKUP, 'backup.json', PASSWORD));
    const token = await picked(sealed, 'backup.zip');
    await assert.rejects(Files.readZip(token, 'backup.json', 'not the password', true), { code: 'E_ZIP_PASSWORD' });
    await assert.rejects(Files.readZip(token, 'backup.json', '', true), { code: 'E_ZIP_PASSWORD' });
    await assert.rejects(Files.readZip(token, 'other.json', PASSWORD, true), { code: 'E_ZIP_NOT_ARCHIVE' });
    const bytes = new Uint8Array(await sealed.arrayBuffer());
    const data = 30 + (bytes[26] ?? 0) + (bytes[28] ?? 0) + 16 + 2;
    bytes[data] = (bytes[data] ?? 0) ^ 1;
    const changed = await picked(new Blob([bytes]), 'changed.zip');
    await assert.rejects(Files.readZip(changed, 'backup.json', PASSWORD, true), { code: 'E_ZIP_CHANGED' });
    const plain = await picked(await made(await Files.makeZip(['backup.json'], [BACKUP], 'plain', '')), 'plain.zip');
    await assert.rejects(Files.readZip(plain, 'backup.json', '', true), { code: 'E_ZIP_PLAIN' });
    const junk = await picked(new Blob(['not an archive']), 'junk.zip');
    await assert.rejects(Files.readZip(junk, 'backup.json', '', false), { code: 'E_ZIP_NOT_ARCHIVE' });
    queued.push(new File([new Uint8Array(16 * 1024 * 1024 + 1)], 'big.zip'));
    await assert.rejects(Files.openZip(), { code: 'E_ZIP_TOO_LARGE' });
    Files.dropFile(token);
    await assert.rejects(Files.readZip(token, 'backup.json', PASSWORD, true), { code: 'E_FILE' });
  });

  it("reads a picked text file in Excel's encodings, refusing binary or large files", async () => {
    const word = '\u0645\u0639\u0644\u0645';
    queued.push(new File([new Uint8Array([0xff, 0xfe, 0x45, 0x06])], 'u16.txt'));
    assert.equal(await Files.openText(), '\u0645');
    queued.push(new File([`${word};1`], 'utf8.csv'));
    assert.equal(await Files.openText(), `${word};1`);
    queued.push(new File([new Uint8Array([0xe3, 0xda, 0xe1, 0xe3])], 'cp1256.csv'));
    assert.equal(await Files.openText(), word);
    queued.push(new File(['%PDF-1.7'], 'a.pdf'));
    await assert.rejects(Files.openText(), { code: 'E_FILE_BINARY' });
    queued.push(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.csv'));
    await assert.rejects(Files.openText(), { code: 'E_FILE_SIZE' });
    queued.push(null);
    assert.equal(await Files.openText(), null);
  });
});

describe('saving and picking on a PC', () => {
  function savePicker(outcome: 'saved' | 'AbortError' | 'SecurityError' | 'broken') {
    const written: Blob[] = [];
    const picker = () => {
      if (outcome === 'AbortError' || outcome === 'SecurityError') {
        return Promise.reject(Object.assign(new Error(outcome), { name: outcome }));
      }
      return Promise.resolve({
        createWritable: () =>
          Promise.resolve({
            write: (data: Blob) => (outcome === 'broken' ? Promise.reject(new Error('disk')) : void written.push(data)),
            close: () => Promise.resolve(),
            abort: () => Promise.resolve(),
          }),
      });
    };
    Object.assign(globalThis, { showSaveFilePicker: picker });
    return written;
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
  });

  it("saves through the browser's save dialog, and says when it is closed", async () => {
    const written = savePicker('saved');
    assert.equal(await Files.saveFile(await Files.makeText(BACKUP, 'backup.json', '')), true);
    assert.equal(await written[0]?.text(), BACKUP);
    savePicker('AbortError');
    assert.equal(await Files.saveFile(await Files.makeText(BACKUP, 'backup.json', '')), false);
    assert.equal(downloads.length, 0);
    savePicker('broken');
    await assert.rejects(Files.saveFile(await Files.makeText(BACKUP, 'backup.json', '')), { code: 'E_FILE' });
    savePicker('SecurityError');
    assert.equal(await Files.saveFile(await Files.makeText(BACKUP, 'backup.json', '')), true);
    assert.equal(downloads.at(-1)?.name, 'backup.json');
  });

  it('shares only where the browser shares the file, and never downloads in its place', async () => {
    await assert.rejects(Files.shareFile(await Files.makeText(BACKUP, 'backup.json', ''), 'Send'), { code: 'E_FILE' });
    const shared: File[] = [];
    let outcome = 'shared';
    Object.assign(navigator, {
      canShare: () => true,
      share: (data: { files: File[] }) => {
        if (outcome !== 'shared') return Promise.reject(Object.assign(new Error(outcome), { name: outcome }));
        shared.push(...data.files);
        return Promise.resolve();
      },
    });
    try {
      await Files.shareFile(await Files.makeText(BACKUP, 'backup.json', ''), 'Send');
      assert.equal(await shared[0]?.text(), BACKUP);
      outcome = 'AbortError';
      await Files.shareFile(await Files.makeText(BACKUP, 'backup.json', ''), 'Send');
      outcome = 'NotAllowedError';
      const zip = await Files.makeText(BACKUP, 'backup.json', PASSWORD);
      await assert.rejects(Files.shareFile(zip, 'Send'), { code: 'E_FILE' });
    } finally {
      Reflect.deleteProperty(navigator, 'canShare');
      Reflect.deleteProperty(navigator, 'share');
    }
    assert.equal(downloads.length, 0);
  });

  it('lets a new pick replace a dialog the teacher left, and refuses one while it is open', async () => {
    queued.push('silent');
    const left = Files.openText();
    await assert.rejects(Files.openText(), { code: 'E_FILE_BUSY' });
    focusPage();
    queued.push(new File(['x;y'], 'next.csv'));
    assert.equal(await Files.openText(), 'x;y');
    assert.equal(await left, null);
  });
});
