// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Only the profile and calendar are public reference data. The roster,
// timetable and full-year plan are invented, never a Ministry curriculum.

import { type PlanPack, type Pupil, type RecordEvent, type Reference, type Session } from '../src/index.ts';
import { cemEvents, primaryEvents } from './demo-class.ts';

/** The two demo timetables exercise per-session and per-half-day roll call. */
export type DemoLevel = 'cem' | 'primary';

/** A separate example pack, never an official or published plan release. */
export function demoPackId(level: DemoLevel): string {
  return level === 'cem' ? 'dz.cem.1am.math.demo-year' : 'dz.primary.5ap.language.demo-year';
}

/** Forty-five invented pupils; repeated names deliberately test identity by ID. */
function roster(seeds: readonly Pupil[], level: DemoLevel): Pupil[] {
  return Array.from({ length: 45 }, (_, index) => {
    const seed = seeds[index % seeds.length];
    if (seed === undefined) throw new Error('The demo roster needs invented seed pupils');
    return {
      ...seed,
      id: `demo-${String(index + 1).padStart(2, '0')}`,
      registration: `000000${String(index + 1).padStart(4, '0')}`,
      groups: level === 'cem' ? [index < 23 ? 'g-1' : 'g-2'] : [],
      movements: index < seeds.length ? seed.movements : [],
    };
  });
}

/** Reuses the small demo's shapes, with setup dated inside the requested year. */
export function demoSetup(ref: Reference, level: DemoLevel): RecordEvent[] {
  const source = level === 'cem' ? cemEvents() : primaryEvents();
  const seeds = source.flatMap((event) => (event.kind === 'pupil.set' ? [event.pupil] : []));
  const setup = source
    .filter((event) => event.kind !== 'pupil.set')
    .map((event): RecordEvent => {
      if (event.kind === 'course.set') {
        return {
          ...event,
          course: { ...event.course, year: ref.year.id, pack: { id: demoPackId(level), release: '2026.1' } },
        };
      }
      if (event.kind === 'timetable.set') return { ...event, version: { ...event.version, from: ref.year.from } };
      return event;
    });
  return [...setup, ...roster(seeds, level).map((pupil): RecordEvent => ({ kind: 'pupil.set', pupil }))];
}

/** Enough invented one-session items for every activity and TD group all year. */
export function demoPack(sessions: readonly Session[], level: DemoLevel): PlanPack {
  return {
    format: 1,
    id: demoPackId(level),
    release: '2026.1',
    status: 'example',
    licence: 'full-text',
    language: 'en',
    anchor: { kind: 'budgets', unit: 'sessions' },
    provenance: { issuer: 'Made up for load tests', edition: 'demo-year-1' },
    stageTemplates: [{ id: 'demo', stages: ['Introduction', 'Practice', 'Review'] }],
    items: sessions.map((session, index) => ({
      id: `demo-item-${index + 1}`,
      kind: session.sessionType === 'td' ? 'td' : 'lesson',
      title: `Invented load-test activity ${index + 1}`,
      budget: 1,
      stages: 'demo',
      ...(session.activity !== undefined && { activity: session.activity }),
    })),
    merges: [],
  };
}
