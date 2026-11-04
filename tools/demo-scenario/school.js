// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario at the school (#630, answer 722), through the app's own sessions
// (device.js): a school joins and its timetable reaches its teachers
// (school-join.js).

import { appAccess } from './device.js';
import { JOIN_ACTIONS, JOIN_STEPS } from './school-join.js';

export const SCHOOL = {
  name: 'A school joins and its timetable reaches its teachers',
  kind: 'national',
  access: appAccess,
  actions: JOIN_ACTIONS,
  steps: JOIN_STEPS,
};
