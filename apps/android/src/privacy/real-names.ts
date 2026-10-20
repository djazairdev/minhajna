// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Real class lists (#211, answer 274). The prior declaration to the ANPDP
// is the Ministry's to file, as the body that will run the system; the
// project builds the software and tests it with made-up data only. So the
// project's preview and pilot builds keep this switch off, and keep asking
// for made-up names. The build the Ministry runs sets its declaration's
// reference here: then, once the app lock is set, the class lists take
// pupils' real names, and the notices say how they are protected and under
// which declaration. Before the PIN is chosen, nothing asks for real names.

/** The build's ANPDP declaration, or null for the project's own builds. */
export type RealNamesBuild = { readonly declaration: string } | null;

/** Set only in the build the Ministry runs, to its declaration's reference. */
export const REAL_NAMES: RealNamesBuild = null;

/** The build's declaration reference, which the privacy notice states; null without one. */
export function buildDeclaration(build: RealNamesBuild): string | null {
  const reference = build?.declaration.trim() ?? '';
  return reference === '' ? null : reference;
}

/** The declaration under which real names may be typed: only in a build that carries one, and only once the lock is set. */
export function realNamesDeclaration(build: RealNamesBuild, lockSet: boolean): string | null {
  return lockSet ? buildDeclaration(build) : null;
}
