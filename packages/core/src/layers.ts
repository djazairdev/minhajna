// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every record belongs to a layer, and the layer travels with it. Every sync,
// export and share goes through `mayTravel`, so a private note can never slip
// into a statement (PRD §5.4, engineering rules).
//
// The device layer holds the teacher card's personal fields. They never leave
// the device: not to the teacher's other devices, nor the export, nor anyone
// else. Only the documents made on the device print them (PRD §3.2, §5.6).
//
// Only the teacher's own routes take whole history entries. A route that
// leaves the teacher takes records: the current version of each one, never
// its entry. An entry's day and its place in the history would show when the
// record was made, such as the day a session was confirmed (PRD §7.6).

export const LAYERS = [
  'device',
  'private',
  'pupil-records',
  'lesson-record',
  'shared-statement',
  'official-snapshot',
  'totals',
] as const;

export type Layer = (typeof LAYERS)[number];

// Insights (PRD §1.6) and totals above the school (PRD §5.10) are not routes.
// They carry only figures formed later from the records, never entries or
// records, so nothing here sends to them.
export const ROUTES = [
  /** The teacher's own devices: their encrypted sync and backup. */
  'own-devices',
  /** The teacher's own full export, the Minhajna archive. */
  'full-export',
  /** The one-page printout of a seating plan, for example for a substitute (PRD §3.4). */
  'seating-plan-printout',
  /** The documents and files the teacher makes: journal, texts book, roll-call book, CSV. */
  'documents',
  /** Progress statements (PRD §3.10). */
  'statement',
  /** Handover packages, with no pupil data. */
  'handover',
  /** A handover by direct transfer, when the teacher chooses to include pupil data. */
  'handover-direct',
  /** The school's copy, in the national system (PRD §5.8). */
  'school-space',
] as const;

export type Route = (typeof ROUTES)[number];

/** The routes that stay with the teacher. Only they take whole history entries. */
export const OWN_ROUTES = ['own-devices', 'full-export'] as const satisfies readonly Route[];

export type OwnRoute = (typeof OWN_ROUTES)[number];

/** The routes that leave the teacher. They take records, never history entries. */
export type OutboundRoute = Exclude<Route, OwnRoute>;

const ALLOWED: Readonly<Record<Route, readonly Layer[]>> = {
  'own-devices': ['private', 'pupil-records', 'lesson-record', 'shared-statement', 'official-snapshot'],
  'full-export': ['private', 'pupil-records', 'lesson-record', 'shared-statement', 'official-snapshot'],
  'seating-plan-printout': [],
  documents: ['device', 'pupil-records', 'lesson-record'],
  statement: ['lesson-record'],
  handover: ['lesson-record'],
  'handover-direct': ['pupil-records', 'lesson-record'],
  'school-space': ['pupil-records', 'lesson-record', 'official-snapshot'],
};

// A route may take one kind of record from a layer it otherwise refuses. The
// seating-plan printout takes no whole layer: only the plan, the pupils'
// names and the class they sit in. Roll calls, movements and everything else
// private stay off it (PRD §3.4).
const ALLOWED_KINDS: Readonly<Partial<Record<Route, readonly string[]>>> = {
  'seating-plan-printout': ['seating.set', 'pupil.set', 'class.set'],
};

/** Whether a whole layer may travel on `route`. A route that does not exist takes nothing. */
export function mayTravel(layer: Layer, route: Route): boolean {
  return Object.hasOwn(ALLOWED, route) && ALLOWED[route].includes(layer);
}

/** Whether a record of this layer and kind may travel on `route`. */
export function mayTravelAs(layer: Layer, kind: string, route: Route): boolean {
  return mayTravel(layer, route) || (ALLOWED_KINDS[route]?.includes(kind) ?? false);
}

export function isOwnRoute(route: Route): route is OwnRoute {
  return (OWN_ROUTES as readonly Route[]).includes(route);
}

/**
 * Keeps the history entries that may travel on one of the teacher's own
 * routes. A route that leaves the teacher takes records instead
 * (`recordsForRoute`), and is refused here.
 *
 * Checked at run time too, for callers outside TypeScript, such as an app bridge.
 */
export function forRoute<T extends { readonly layer: Layer; readonly kind: string }>(
  entries: readonly T[],
  route: OwnRoute,
): T[] {
  if (!isOwnRoute(route)) throw new RangeError("Only the teacher's own routes take history entries");
  return entries.filter((entry) => mayTravelAs(entry.layer, entry.kind, route));
}
