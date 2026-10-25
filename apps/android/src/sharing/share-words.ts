// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A share in words (#439, answer 486), as «سجل المشاركة», «إلى من؟» and the
// activity log write it: the class by its name, or a dash once it is gone;
// how it left; and the role it went to, never a person.

import type { ShareHow, ShareRole, State } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { isolate } from '../week/grid-labels';

/** The class a share's course belongs to, isolated, or a dash once gone. */
export function shareClass(state: State, courseId: string): string {
  const classId = state.courses.get(courseId)?.classId;
  const name = classId === undefined ? undefined : state.classes.get(classId)?.name;
  return name === undefined ? '—' : isolate(name);
}

/** «طباعة», «PDF», «رمز QR» or «ملف موقّع». */
export const shareHow = (t: Translate, how: ShareHow) => t(`statement.how.${how}`);

/** «للمدير» and the like. */
export const shareTo = (t: Translate, role: ShareRole) => t(`statement.to.${role}`);
