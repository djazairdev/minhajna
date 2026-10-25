// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The last steps in the app, for a problem report (#249, answer 483): the
// names of the last screens opened, never their content or parameters, kept
// in memory since the app opened and never stored, so they go when it
// closes. A screen opened twice in a row counts once. Native code holds the
// same names in memory, for a crash report if the app stops (answer 483).

import native from '../native/NativeMinhajnaCrash';

/** How many screens a report names. */
export const STEPS_KEPT = 10;

const steps: string[] = [];

/** Notes the screen now shown, by its route name. */
export function recordStep(name: string | undefined): void {
  if (name === undefined || steps[steps.length - 1] === name) return;
  steps.push(name);
  if (steps.length > STEPS_KEPT) steps.shift();
  native.steps([...steps]);
}

/** The last screens opened, oldest first. */
export function recentSteps(): readonly string[] {
  return [...steps];
}

/** Forgets every step, as a new start of the app does. */
export function clearSteps(): void {
  steps.length = 0;
  native.steps([]);
}
