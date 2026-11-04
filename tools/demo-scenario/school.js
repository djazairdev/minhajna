// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { appAccess } from './device.js';
import { JOIN_ACTIONS, JOIN_STEPS } from './school-join.js';

export const SCHOOL = {
  name: 'A school joins, signs its weeks and sends its term',
  kind: 'national',
  access: appAccess,
  actions: { ...JOIN_ACTIONS },
  steps: [...JOIN_STEPS],
};
