// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a native part not yet built for the web answers (#250, answer 501):
// a refusal with its own code, so the screen that asked says the step
// failed, as it does for any refused step, and nothing is pretended.

/** A refused promise, coded `E_WEB_NOT_YET`, for the part named. */
export function notYet<T>(part: string): Promise<T> {
  return Promise.reject(Object.assign(new Error(`${part} is not on the web yet`), { code: 'E_WEB_NOT_YET' }));
}
