// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Only a future authenticated school-space adapter may install this
// projection. The provider is not authentication. No preview route or
// setting supplies it, so it cannot enable institution mode (PRD §7.1).

import type { Day, TeacherCover } from '@minhajna/core';
import { createContext, useContext } from 'react';

/** No source means no school cover; a teacher cannot create assignments through this read-only port. */
export const SchoolCoverSource = createContext<((day: Day) => readonly TeacherCover[]) | null>(null);

const none: readonly TeacherCover[] = [];

/** A revoked or unavailable school-space source fails closed, without retaining its previous projection. */
export function useSchoolCover(day: Day): readonly TeacherCover[] {
  const source = useContext(SchoolCoverSource);
  try {
    return source?.(day).filter((row) => row.session.day === day) ?? none;
  } catch {
    return none;
  }
}
