// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directorate's exam thresholds (M-Threshold, #604, answer 638): the
// committee's page for the directorate's own exams (CommitteePage.tsx), over
// the classes of the directorate's schools as the world seeds them, whose
// pinned packs give each subject's plan, and the directorate's totals.

import type { CalendarUpdate, Day, DemoSchool } from '@minhajna/core';
import { useMemo } from 'react';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { seededWorld } from '../director/director-world';
import type { TermReference } from '../director/seeded-fill';
import { worldRequest } from '../network/world-network';
import type { ReferenceResult } from '../reference';
import { CommitteePage } from '../threshold/CommitteePage';
import { readTotals } from './totals-read';

export type DirectorateThresholdsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  /** The school whose directorate this is, as the world seeds it. */
  readonly school: Pick<DemoSchool, 'directorateId'>;
  readonly held: HeldWorld | null;
  readonly reference: TermReference;
  /** The bundled reference data, whose packs the seeded classes pin. */
  readonly bundled: Extract<ReferenceResult, { ok: true }>;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
};

/** The committees of the directorate's own exams. */
export function DirectorateThresholds(props: DirectorateThresholdsProps) {
  const { world, school, held, reference, bundled, kit, send = worldRequest, dayText, updates } = props;
  const directorate = school.directorateId;
  const schools = useMemo(
    () => seededWorld(world.world, bundled).schools.filter((one) => one.directorateId === directorate),
    [world.world, bundled, directorate],
  );
  return (
    <CommitteePage
      world={world.world}
      date={world.date}
      level="directorate"
      scope={directorate}
      held={held}
      reference={reference}
      schools={schools}
      packs={bundled.packs}
      read={(day) => readTotals(world.world, day, directorate, send)}
      kit={kit}
      send={send}
      dayText={dayText}
      updates={updates}
    />
  );
}
