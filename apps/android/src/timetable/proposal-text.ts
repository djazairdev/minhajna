// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's proposal in plain words (#578, D-TT-proposal, answer 606): a
// session's slot, its day and times, class, group and subject, then its room;
// and the checks of a move against the standing version, each a line: the
// teacher, the class and, when the move gives one, the room free at the new
// time or not, or that the session loses its room when the move gives none, the
// class's hours kept or changed, and whether the move holds in both weeks or
// only in week A or B, and that a session taught to several classes together
// would be split. Names are isolated so a name in other letters keeps its
// place.

import type { ImportedSession } from '@minhajna/core';
import type { TFunction } from 'i18next';
import { isolate } from '../week/grid-labels';
import { spanText } from './grid-text';
import type { WaitingProposal } from './proposal-session';

/** A session's slot: day and times, class, group and subject, and room. */
export function slotText(t: TFunction, one: ImportedSession): string {
  const lesson = [one.class, one.group, one.subject].filter((name) => name !== '').map(isolate);
  const room = one.room === '' ? [] : [t('ttProposal.room', { room: isolate(one.room) })];
  return [`${t(`week.days.${one.day}`)} ${spanText(one.start, one.end)}`, ...lesson, ...room].join(' · ');
}

/** The checks of a move whose session was found, one line each. */
export function checkLines(t: TFunction, one: WaitingProposal): string[] {
  if (one.now === null || one.moved === null) return [];
  const [teacher, of, room] = [isolate(one.teacher), isolate(one.now.class), isolate(one.moved.room)];
  const clash = (kind: WaitingProposal['clashes'][number]) => one.clashes.includes(kind);
  const lines = [
    t(clash('teacher') ? 'ttProposal.teacherBusy' : 'ttProposal.teacherFree', { teacher }),
    t(clash('class') ? 'ttProposal.classBusy' : 'ttProposal.classFree', { class: of }),
  ];
  if (one.moved.room !== '') lines.push(t(clash('room') ? 'ttProposal.roomBusy' : 'ttProposal.roomFree', { room }));
  if (one.moved.room === '' && one.now.room !== '')
    lines.push(t('ttProposal.roomDropped', { room: isolate(one.now.room) }));
  lines.push(t(one.hours ? 'ttProposal.hoursSame' : 'ttProposal.hoursChanged', { class: of }));
  const week = { both: 'ttProposal.weekBoth', A: 'ttProposal.weekA', B: 'ttProposal.weekB' } as const;
  lines.push(t(week[one.now.week]));
  if (one.joint) lines.push(t('ttProposal.joint'));
  return lines;
}
