// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// React Native's global error handler, which the browser lacks (#250): the
// app's crash reports set it as on the phone (#249). An error nothing caught
// reaches the handler as fatal, as it would stop the app on the phone. A
// promise refused with nobody waiting does not, as React Native on the phone
// does not send it there; the browser still logs both.

type Handler = (error: unknown, isFatal?: boolean) => void;

let handler: Handler = () => undefined;

const errorUtils = {
  getGlobalHandler: (): Handler => handler,
  setGlobalHandler(next: Handler) {
    handler = next;
  },
};

Object.assign(globalThis, { ErrorUtils: errorUtils });
addEventListener('error', (event) => {
  if (event.error instanceof Error) handler(event.error, true);
});
