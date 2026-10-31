// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The routes of the PC's workspaces in a demo world (#562, answer 576): each
// role above the teacher sees its own pages and no other's, as the design's
// boards for it list them, with the log of their own actions for the director
// and the preparer (§7.8), the Ministry's calendar, and the operators' logs
// from the plan, and the world's own page last, with its code and its date.
// The teacher and the inspector keep the world's home until their own world
// modes come. The pages are kept in the world's state, never in the
// teacher's navigator or a URL, so leaving the world forgets them; each one
// fills as its part of the demo lands.

import type { WorldRole } from './world-mode';

/** A page of a workspace. */
export type WorldPage =
  | 'dashboard'
  | 'thresholds'
  | 'cover'
  | 'records'
  | 'delivery'
  | 'access'
  | 'timetable'
  | 'codes'
  | 'keys'
  | 'exchange'
  | 'log'
  | 'totals'
  | 'grants'
  | 'published'
  | 'calendar'
  | 'packs'
  | 'releases'
  | 'reports'
  | 'reviews'
  | 'map'
  | 'admin'
  | 'problems'
  | 'security'
  | 'insights'
  | 'payload'
  | 'world';

/** The roles with a workspace of their own. */
export type WorkspaceRole = Exclude<WorldRole, 'inspector' | 'teacher'>;

/** Each workspace's pages, in the order its board lists them, then the role's log and the world's page. */
export const ROLE_PAGES: Readonly<Record<WorkspaceRole, readonly WorldPage[]>> = {
  ministry: ['thresholds', 'totals', 'published', 'calendar', 'world'],
  directorate: ['thresholds', 'totals', 'grants', 'world'],
  director: [
    'dashboard',
    'thresholds',
    'cover',
    'records',
    'delivery',
    'access',
    'timetable',
    'codes',
    'keys',
    'exchange',
    'log',
    'world',
  ],
  preparer: ['timetable', 'log', 'world'],
  curator: ['packs', 'releases', 'reports', 'reviews', 'world'],
  operator: ['map', 'admin', 'problems', 'security', 'world'],
  observatory: ['insights', 'payload', 'world'],
};

/** The roles the project runs, whose boards carry the project's name rather than a deployment's. */
export const PROJECT_ROLES: readonly WorkspaceRole[] = ['curator', 'observatory'];

/** Whether the role has a workspace of its own. */
export function hasWorkspace(role: WorldRole): role is WorkspaceRole {
  return Object.hasOwn(ROLE_PAGES, role);
}
