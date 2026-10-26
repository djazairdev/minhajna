// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The web's stand-in for React Native's view tags (#250): findNodeHandle
// gives a mounted element a number, and the interface module focuses the
// element by it, so a sheet's focus returns where it was on a PC too. A tag
// holds its element weakly and is forgotten once used.

const tags = new Map<number, WeakRef<HTMLElement>>();
let last = 0;

/** A number for the element React Native Web mounted, or null for anything else. */
export function tagOf(target: unknown): number | null {
  if (!(target instanceof HTMLElement) || !target.isConnected) return null;
  last += 1;
  tags.set(last, new WeakRef(target));
  return last;
}

/** Focuses the tagged element, if it is still on the page. */
export function focusTag(tag: number): void {
  const element = tags.get(tag)?.deref();
  tags.delete(tag);
  if (element?.isConnected === true) element.focus();
}
