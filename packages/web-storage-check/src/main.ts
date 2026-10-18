// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// This UI never renders entries or exception messages, only an allowlisted report.

import { run, reopen, type Result } from './check.ts';
import { clear } from './database.ts';
import { capabilities, storageStatus } from './environment.ts';
import { messages, type Message } from './text.ts';

function field<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error('page-structure');
  return element as T;
}

let language = 'ar';
let result: Result | null = null;
let failure: string | null = null;
let cache: 'cacheReady' | 'cacheWaiting' | 'cacheUnavailable' = 'cacheWaiting';
let status: Message = 'ready';
const build = fetch('./build.json')
  .then(async (response) => {
    const value: unknown = await response.json();
    return typeof value === 'object' &&
      value !== null &&
      'sha256' in value &&
      typeof value.sha256 === 'string' &&
      /^[0-9a-f]{64}$/.test(value.sha256)
      ? value.sha256
      : 'unavailable';
  })
  .catch(() => 'unavailable');

function translate(): void {
  const text = messages(language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = text.title;
  for (const element of document.querySelectorAll<HTMLElement>('[data-text]')) {
    const key = element.dataset['text'] as Message;
    element.textContent = text[key];
  }
  field('status').textContent = text[status];
  field('offline-status').textContent = text[cache];
}

async function report(requestPersistence = false): Promise<void> {
  const storage = await storageStatus(requestPersistence);
  field<HTMLTextAreaElement>('report').value = JSON.stringify(
    {
      diagnostic: 'minhajna-web-storage-check/1',
      syntheticOnly: true,
      buildSha256: await build,
      browser: navigator.userAgent,
      operatingSystem: field<HTMLSelectElement>('platform').value,
      capabilities: capabilities(),
      storage,
      offlineFiles: cache === 'cacheReady',
      measurement: result,
      error: failure,
      limits: [
        'Not a backup or eviction guarantee',
        'No production key lifecycle tested',
        'Cross-browser/Windows matrix needs separate runs',
      ],
    },
    null,
    2,
  );
}

/** Do not copy arbitrary exception text: it might contain application input. */
function safeCode(error: unknown): string {
  const allowed = [
    'blocked',
    'HistoryError',
    'DataCloneError',
    'AbortError',
    'UnknownError',
    'delete-failed',
    'no-saved-run',
    'changed-run',
    'metadata',
    'count',
    'state',
    'row-order',
    'entry-order',
    'reference',
    'profile',
    'calendar',
    'test-passphrase',
    'QuotaExceededError',
    'SecurityError',
    'OperationError',
    'NotAllowedError',
    'InvalidStateError',
    'transaction-aborted',
    'transaction-error',
  ];
  if (error instanceof Error) {
    if (allowed.includes(error.name)) return error.name;
    if (allowed.includes(error.message)) return error.message;
  }
  return 'check-failed';
}

async function action(kind: 'run' | 'reopen'): Promise<void> {
  const password = field<HTMLInputElement>('passphrase');
  if (!password.reportValidity()) return;
  const passphrase = password.value;
  password.value = '';
  const level = field<HTMLSelectElement>('level').value === 'primary' ? 'primary' : 'cem';
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) button.disabled = true;
  status = 'working';
  failure = null;
  result = null;
  translate();
  await report();
  try {
    const available = capabilities();
    if (!available['secureContext'] || !available['indexedDB'] || !available['webCrypto'])
      throw new Error('SecurityError');
    result = await (kind === 'run' ? run(passphrase, level) : reopen(passphrase));
    status = 'success';
  } catch (error) {
    failure = safeCode(error);
    status = 'failed';
  } finally {
    for (const button of document.querySelectorAll<HTMLButtonElement>('button')) button.disabled = false;
    translate();
    await report();
  }
}

async function offline(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!('serviceWorker' in navigator)) throw new Error('unsupported');
    await navigator.serviceWorker.register('./sw.js', { type: 'module', scope: './' });
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('worker-timeout')), 8000);
      }),
    ]);
    cache = 'cacheReady';
  } catch {
    cache = 'cacheUnavailable';
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  translate();
  await report();
}

field('language').addEventListener('change', () => {
  language = field<HTMLSelectElement>('language').value;
  translate();
});
field('run').addEventListener('click', () => {
  void action('run');
});
field('reopen').addEventListener('click', () => {
  void action('reopen');
});
field('platform').addEventListener('change', () => {
  void report();
});
field('persist').addEventListener('click', () => {
  void report(true).then(() => {
    status = 'persistDone';
    translate();
  });
});
field('clear').addEventListener('click', () => {
  if (!confirm(messages(language).confirmClear)) return;
  void clear(() => {
    status = 'clearWaiting';
    translate();
  })
    .then(async () => {
      result = null;
      failure = null;
      status = 'cleared';
      translate();
      await report();
    })
    .catch(async (error: unknown) => {
      failure = safeCode(error);
      status = 'failed';
      translate();
      await report();
    });
});
field('copy').addEventListener('click', () => {
  const copy =
    navigator.clipboard === undefined
      ? Promise.reject(new Error('clipboard'))
      : navigator.clipboard.writeText(field<HTMLTextAreaElement>('report').value);
  void copy
    .then(() => {
      status = 'copied';
      translate();
    })
    .catch(() => {
      status = 'copyFailed';
      translate();
      field<HTMLTextAreaElement>('report').select();
    });
});
translate();
void report();
void offline();
