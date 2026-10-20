// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { calendarImpact, type CalendarEntry, type CalendarMutation } from '@minhajna/core';
import { useRef, useState } from 'react';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useCalendarSave } from './useCalendarSave';

/** One reviewed draft, tied to its durable state; every edit invalidates it synchronously. */
export function useCalendarPreview(create: () => CalendarMutation, onSaved: (entry: CalendarEntry) => void) {
  const data = useAppData();
  const writer = useCalendarSave();
  const [shown, setShown] = useState<ReturnType<typeof prepare> | null>(null);
  const prepared = useRef<typeof shown>(null);
  const [invalid, setInvalid] = useState(false);
  function prepare() {
    const event = create();
    if (event.kind !== 'calendar.set') throw new RangeError('An editor sets an entry');
    return {
      event,
      entry: event.entry,
      impact: calendarImpact(coreContext(data), event, data.today()),
      state: data.state,
    };
  }
  const change = (work: () => void) => {
    if (writer.isBusy()) return;
    prepared.current = null;
    setShown(null);
    setInvalid(false);
    work();
  };
  const preview = () => {
    if (writer.isBusy()) return;
    try {
      const next = prepare();
      prepared.current = next;
      setShown(next);
      setInvalid(false);
    } catch {
      prepared.current = null;
      setShown(null);
      setInvalid(true);
    }
  };
  const save = async () => {
    const next = prepared.current;
    if (next !== null && (await writer.save(next.event, next.state))) onSaved(next.entry);
  };
  return { ...writer, shown, invalid, change, preview, save };
}
