// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The progress statement in words (#438, Share, R-3.10-03 to R-3.10-07): every
// field it carries, and nothing it does not, so the screen and the printed page
// say what leaves. The class by its section, subject, year of study and school
// year; the last unit completed; the last resource and whether the whole class
// finished it; the delay in whole sessions, with plan weeks for a week pack,
// and the buffer used and left when the pack has one; the sessions not held, by
// calendar causes and «أخرى», with the TD ones among them; the pack by its ID
// and release, a teacher's own list as such. The pack's names come from the
// profile; its ID and release are written as they leave.

import type { CountryProfile, ProgressStatement } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { frontDate } from '../documents/front-tables';
import { gradeName, localized } from '../setup/names';
import { isolate } from '../week/grid-labels';

/** One field: its label, then its lines, the first the value and any others notes on it. */
export interface StatementLine {
  readonly id: 'unit' | 'resource' | 'delay' | 'notHeld' | 'pack';
  readonly label: string;
  readonly lines: readonly string[];
}

/** The subject's name in the interface language, or its code. */
function subjectName(profile: CountryProfile, code: string): string {
  const subject = profile.subjects.find((one) => one.code === code);
  return subject === undefined ? code : localized(subject.name);
}

/** «4م1 · اللغة العربية · السنة الرابعة متوسط · 2026-2027», with the stream when the class has one. */
export function statementClass(profile: CountryProfile, statement: ProgressStatement): string {
  const { section, subject, grade, year, stream } = statement.class;
  return [
    isolate(section),
    subjectName(profile, subject),
    gradeName(profile, grade),
    ...(stream === undefined ? [] : [isolate(stream)]),
    isolate(year),
  ].join(' · ');
}

/** The statement's day as its page heads it, such as «04/10/2026». */
export const statementDay = (statement: ProgressStatement) => frontDate(statement.day);

/** Every field the statement carries, in the design's order. */
export function statementLines(t: Translate, profile: CountryProfile, statement: ProgressStatement): StatementLine[] {
  const { lastUnit, lastResource, delay, notHeld, td, pack } = statement;
  const sessions = (count: number) => t('count.sessions', { count });
  const behind =
    delay.sessions === 0
      ? t('statement.noDelay')
      : delay.weeks === null
        ? sessions(delay.sessions)
        : t('statement.delayWeeks', {
            weeks: t('count.weeks', { count: delay.weeks }),
            sessions: sessions(delay.sessions),
          });
  const losses = (value: typeof notHeld) => ({ calendar: value.calendar, other: value.other });
  const own = pack.release === 'own';
  return [
    {
      id: 'unit',
      label: t('statement.unit'),
      lines: [lastUnit === null ? t('statement.noUnit') : isolate(lastUnit.title)],
    },
    {
      id: 'resource',
      label: t('statement.resource'),
      lines:
        lastResource === null
          ? [t('statement.noResource')]
          : [isolate(lastResource.title), t(lastResource.status === 'done' ? 'statement.done' : 'statement.started')],
    },
    {
      id: 'delay',
      label: t('statement.delay'),
      lines: [
        behind,
        ...(delay.bufferUsed + delay.bufferLeft > 0
          ? [t('statement.buffer', { used: sessions(delay.bufferUsed), left: sessions(delay.bufferLeft) })]
          : []),
      ],
    },
    {
      id: 'notHeld',
      label: t('statement.notHeld'),
      lines: [
        t('statement.losses', losses(notHeld)),
        ...(td.calendar + td.other > 0 ? [t('statement.td', losses(td))] : []),
      ],
    },
    {
      id: 'pack',
      label: t('statement.pack'),
      lines: [
        `${subjectName(profile, statement.class.subject)} · ${gradeName(profile, statement.class.grade)}`,
        own ? t('statement.ownList') : isolate(`${pack.id} · ${pack.release}`),
      ],
    },
  ];
}
