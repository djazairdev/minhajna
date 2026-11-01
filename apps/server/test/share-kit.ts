// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up school's share of the totals (#596), in the shape the core
// prepares, for the shares' tests: one subject with one plan item, its ID from
// a number, for a day and a count of teachers.

import type { Share } from '../src/totals/share-read.js';

/** A made-up share, its ID from `at`. */
export const madeUpShare = (at: number, day = '2026-12-06', teachers = 3): Share => ({
  format: 'minhajna/total-share/1',
  id: at.toString(16).padStart(64, '0'),
  day,
  directorate: 'dir-01',
  subjects: {
    math: {
      teachers,
      vacantPosts: 0,
      hoursWithoutTeacher: 0,
      classes: 4,
      cover: 1,
      closed: 2,
      reached: 1800,
      runLong: 1,
      items: { 'item-01': { sessions: 12, merged: 0, skipped: 1, retaught: 0 } },
    },
  },
});
