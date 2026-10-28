// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's updates (#250, R-6.6-06, answers 516 and 517), through
// the offline worker: it reads the server's build.json and notes past every
// cache, as an install checks them, and installs a build only by its
// checksum. The version and version code come from the notes, which the
// checksum covers, and a build is offered only when the worker finds it
// newer than the installed one, so no older build, and no other build of
// the same version, is ever offered. Before installing, the page keeps the
// version it ran, so the next opening can say what was installed, even
// when the worker finishes after the page stopped waiting; once the worker
// has the new build, every page of the app reloads into it. Offline, with
// no worker yet, or on any failure, nothing is offered.

import type { Spec } from '../../../android/src/native/NativeMinhajnaUpdate';
import Build from './Build';
import { dropSetting, readSetting, writeSetting } from './web-settings';

/** How long the worker may take to read the server, and to install a build. */
const CHECK_MS = 20_000;
const INSTALL_MS = 300_000;

/** The installed version, kept as an update begins. */
type Before = { from: string; fromSha256: string };

function worker(): ServiceWorker | null {
  return typeof navigator === 'undefined' ? null : (navigator.serviceWorker?.controller ?? null);
}

/** Asks the worker, and waits for its answer at most `ms`. */
function ask(message: object, ms: number): Promise<unknown> {
  const target = worker();
  if (target === null) return Promise.reject(new Error('No offline worker'));
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error('The offline worker did not answer')), ms);
    channel.port1.onmessage = (event: MessageEvent<{ ok: boolean; value?: unknown; error?: string }>) => {
      clearTimeout(timer);
      if (event.data.ok) resolve(event.data.value);
      else reject(new Error(event.data.error ?? 'The update failed'));
    };
    target.postMessage(message, [channel.port2]);
  });
}

if (typeof navigator !== 'undefined') {
  navigator.serviceWorker?.addEventListener('message', (event: MessageEvent<{ kind?: string }>) => {
    if (event.data?.kind === 'updated') location.reload();
  });
}

const Update: Spec = {
  async available() {
    if (navigator.onLine === false || worker() === null) return null;
    try {
      const latest = (await ask({ kind: 'check' }, CHECK_MS)) as { newer?: unknown };
      return latest.newer === true ? JSON.stringify(latest) : null;
    } catch {
      return null;
    }
  },
  async install(sha256) {
    const current = await Build.describe();
    const before: Before = { from: current.version, fromSha256: current.apkSha256 };
    writeSetting('updated', JSON.stringify(before));
    await ask({ kind: 'update', sha256 }, INSTALL_MS);
    location.reload();
  },
  async installed() {
    const kept = readSetting('updated');
    if (kept === null) return null;
    try {
      const before = JSON.parse(kept) as Before;
      const now = await Build.describe();
      if (now.apkSha256 === before.fromSha256) {
        dropSetting('updated');
        return null;
      }
      return JSON.stringify({ from: before.from, version: now.version, sha256: now.apkSha256 });
    } catch {
      dropSetting('updated');
      return null;
    }
  },
  forget: () => dropSetting('updated'),
};

export default Update;
