// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up page for the files tests: the file dialog gives the next file
// queued, or closes with none, or closes saying nothing, as some browsers
// do, until the page has its focus back; each download is recorded with
// its name and content. Nothing touches the computer's own files.

type Handler = () => void;

export const queued: (File | null | 'silent')[] = [];
const focusHandlers = new Set<Handler>();

/** The page has its focus back, as when the teacher leaves a dialog. */
export function focusPage(): void {
  focusHandlers.forEach((handler) => handler());
}
export const downloads: { name: string; file: Blob }[] = [];
const urls = new Map<string, Blob>();

class FakeInput {
  type = '';
  accept = '';
  files: File[] | null = null;
  readonly handlers = new Map<string, Handler>();

  addEventListener(kind: string, handler: Handler) {
    this.handlers.set(kind, handler);
  }

  click() {
    const next = queued.shift() ?? null;
    if (next === 'silent') return;
    if (next === null) this.handlers.get('cancel')?.();
    else {
      this.files = [next];
      this.handlers.get('change')?.();
    }
  }
}

class FakeLink {
  href = '';
  download = '';
  rel = '';

  click() {
    const file = urls.get(this.href);
    if (file !== undefined) downloads.push({ name: this.download, file });
  }
}

Object.assign(globalThis, {
  document: { createElement: (tag: string) => (tag === 'input' ? new FakeInput() : new FakeLink()) },
  window: {
    addEventListener: (kind: string, handler: Handler) => kind === 'focus' && focusHandlers.add(handler),
    removeEventListener: (kind: string, handler: Handler) => kind === 'focus' && focusHandlers.delete(handler),
  },
});
Object.assign(URL, {
  createObjectURL: (blob: Blob) => {
    const url = `blob:test/${urls.size}`;
    urls.set(url, blob);
    return url;
  },
  revokeObjectURL: (url: string) => void urls.delete(url),
});
