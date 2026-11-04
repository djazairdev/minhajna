// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's exam thresholds (N-Threshold, #605, §7.10, R-7.10-14,
// R-7.10-25, answers 539, 549, 638 and 639), and what is published of them
// (N-Published, #606, answer 640): the committee's page for the
// national exams (CommitteePage.tsx), over the classes of every seeded school,
// whose pinned packs give each subject's plan, and the Ministry's totals: the
// nation's figure, with each wilaya's only to give the range, never named.

import { NATIONAL_COMMITTEE, type CalendarUpdate, type Day } from '@minhajna/core';
import { useMemo } from 'react';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { seededWorld } from '../director/director-world';
import type { TermReference } from '../director/seeded-fill';
import { readMinistryTotals } from '../directorate/totals-read';
import { worldRequest } from '../network/world-network';
import type { ReferenceResult } from '../reference';
import { CommitteePage } from '../threshold/CommitteePage';
import { PublishedCuts } from '../threshold/PublishedCuts';

export type MinistryThresholdsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
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

/** The committees of the national exams, or what is published of them. */
export function MinistryThresholds(props: MinistryThresholdsProps & { readonly published?: boolean }) {
  const Page = props.published === true ? PublishedCuts : CommitteePage;
  const { world, held, reference, bundled, kit, send = worldRequest, dayText, updates } = props;
  const schools = useMemo(() => seededWorld(world.world, bundled).schools, [world.world, bundled]);
  const read = async (day: Day) => {
    const figures = await readMinistryTotals(world.world, day, send);
    return figures === null ? null : { ...figures.national, wilayas: figures.directorates.map(([, one]) => one) };
  };
  return (
    <Page
      world={world.world}
      date={world.date}
      level="national"
      scope={NATIONAL_COMMITTEE}
      held={held}
      reference={reference}
      schools={schools}
      packs={bundled.packs}
      read={read}
      kit={kit}
      send={send}
      dayText={dayText}
      updates={updates}
    />
  );
}
