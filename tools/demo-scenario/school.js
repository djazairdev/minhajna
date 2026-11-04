// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { appAccess } from './device.js';
import { GRANT_ACTIONS, GRANT_STEPS } from './school-grant.js';
import { JOIN_ACTIONS, JOIN_STEPS } from './school-join.js';
import { TERM_ACTIONS, TERM_STEPS } from './school-term.js';
import { WEEK_ACTIONS, WEEK_STEPS } from './school-weeks.js';

export const SCHOOL = {
  name: 'A school joins, signs its weeks and sends its term',
  kind: 'national',
  access: appAccess,
  actions: { ...JOIN_ACTIONS, ...WEEK_ACTIONS, ...GRANT_ACTIONS, ...TERM_ACTIONS },
  steps: [...JOIN_STEPS, ...WEEK_STEPS, ...GRANT_STEPS, ...TERM_STEPS],
};
