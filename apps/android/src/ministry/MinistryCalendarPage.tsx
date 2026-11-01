// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's calendar page with publishing (#608, answer 624): the page
// keys its draft afresh over each release the world holds
// (MinistryCalendar.tsx), while publishing, which outlives that, lives here:
// the page offers to publish once the world's keys are held, says while it
// publishes and why it could not, and once the release is put, the world's
// calendar is read again and the release is said, on the phone and on a PC
// alike.

import { useEffect, useEffectEvent } from 'react';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import type { Day } from '@minhajna/core';
import type { ReferenceResult } from '../reference';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { useSaid } from '../week/useSaid';
import { useCalendarPublish } from './calendar-publish';
import { MinistryCalendar } from './MinistryCalendar';

export type MinistryCalendarPageProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  /** The world's keys and sealing key, held while it is open; without them nothing is published. */
  readonly held: HeldWorld | null;
  /** The reference data with the world's calendar. */
  readonly reference: Extract<ReferenceResult, { ok: true }>;
  readonly kit: Pick<WorldKit, 'random' | 'mac' | 'cipher' | 'verify' | 'sign'>;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** After a release is put: the world's calendar is read again. */
  readonly onPublished: () => void;
};

/** The Ministry's calendar page, publishing its draft to the world. */
export function MinistryCalendarPage({
  world,
  held,
  reference,
  kit,
  send,
  dayText,
  onPublished,
}: MinistryCalendarPageProps) {
  const t = useDeviceText();
  const publishing = useCalendarPublish(world, held, reference, kit, onPublished, send);
  const { say, region } = useSaid('', 'ministry-publish-said');
  const problem = publishing.problem === null ? null : t(publishing.problem.words);
  const done = useEffectEvent(() => {
    if (publishing.published !== null)
      say(t('demo.ministryCalendar.publish.done', { release: isolate(publishing.published.release) }));
  });
  useEffect(() => {
    if (publishing.published !== null) done();
  }, [publishing.published]);
  const failed = useEffectEvent(() => {
    if (problem !== null && !onPc()) say(problem);
  });
  useEffect(() => {
    if (publishing.problem !== null) failed();
  }, [publishing.problem]);
  return (
    <>
      <MinistryCalendar
        key={`${world.world}@${reference.calendar.release}`}
        world={world}
        reference={reference}
        kit={kit}
        dayText={dayText}
        publish={
          publishing.ready
            ? {
                busy: publishing.busy,
                problem,
                problems: publishing.problem?.count ?? 0,
                onPublish: publishing.publish,
                justPublished: publishing.published?.release === reference.calendar.release,
              }
            : undefined
        }
      />
      {region}
    </>
  );
}
