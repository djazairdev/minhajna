// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's drawing kit (#600, answer 574), which the PC's start hands the app.

import type { DrawingKit } from '../../../android/src/drawing/drawing-kit';
import { Chart } from './chart.tsx';
import { FlowMap } from './map.tsx';

export const drawing: DrawingKit = { Chart, Map: FlowMap };
