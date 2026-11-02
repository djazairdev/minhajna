// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Synthetic source packs for the editor tests and local visual review.

import type { PlanPack } from '@minhajna/core';

export const source: PlanPack = {
  format: 1,
  id: 'dz.cem.3am.math.example',
  release: '2026.1',
  status: 'example',
  licence: 'structure-only',
  language: 'ar',
  anchor: { kind: 'budgets', unit: 'sessions' },
  provenance: { issuer: 'Made-up issuer', edition: 'Made-up edition' },
  stageTemplates: [{ id: 'standard', stages: ['Synthetic start', 'Synthetic practice'] }],
  items: [{ id: 'lesson', kind: 'lesson', title: 'درس مختلق للمراجعة', budget: 2, sourcePage: 3, stages: 'standard' }],
  merges: [],
};

export const weekly: PlanPack = {
  ...source,
  anchor: { kind: 'weeks' },
  activities: [{ code: 'reading', name: { ar: 'قراءة مختلقة', kab: 'Synthetic name' }, sessions: 2 }],
  items: [{ ...source.items[0], week: 1, activity: 'reading' }],
};
