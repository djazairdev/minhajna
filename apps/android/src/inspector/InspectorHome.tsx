// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspector's cards on their home in a national world (#593, #594): their
// key, posted in their directorate's space (InspectorKey.tsx), then I-Grant,
// the grants relayed to this phone (InspectorGrants.tsx), whose schools the
// world's seed names and whose classes count sessions by the country's
// calendar for the world's school (school-mine-session.ts), with no timetable
// on the inspector's phone to order classes or split the day by its bells.

import type { Day, DemoSchool } from '@minhajna/core';
import { useMemo } from 'react';
import { View } from 'react-native';
import { seededWorld } from '../director/director-world';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { spacing } from '../design/tokens';
import type { ReferenceResult } from '../reference';
import { deliveryReading, type MineCalendar } from '../week/school-mine-session';
import { InspectorGrants } from './InspectorGrants';
import { InspectorKey } from './InspectorKey';

export type InspectorHomeProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: Pick<DemoSchool, 'directorateId'>;
  readonly reference: Extract<ReferenceResult, { ok: true }>;
  readonly mine: MineCalendar;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
};

/** The inspector's key and the grants relayed to their phone. */
export function InspectorHome({ world, school, reference, mine, kit, send, dayText }: InspectorHomeProps) {
  const schools = useMemo(() => seededWorld(world.world, reference).schools, [world.world, reference]);
  const reading = useMemo(() => deliveryReading(mine, [], []), [mine]);
  return (
    <View style={{ gap: spacing['space-12'] }}>
      <InspectorKey world={world} directorate={school.directorateId} kit={kit} send={send} />
      <InspectorGrants
        world={world}
        directorate={school.directorateId}
        schools={schools}
        reading={reading}
        workingDays={reference.profile.workingDays}
        kit={kit}
        send={send}
        dayText={dayText}
      />
    </View>
  );
}
