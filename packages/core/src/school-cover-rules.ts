// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isDay, isWithin } from './day.ts';
import { compareSlots } from './records.ts';
import type { CoverAuthority, CoverChoice, CoverRole, CoverSession, SchoolCover } from './school-cover.ts';

/** The adapter must fail closed when national school membership is absent or revoked. */
export function coverAccess(authority: CoverAuthority, roles: readonly CoverRole[]): void {
  const held = authority.members.get(authority.actorId);
  if (!authority.nationalSystem || held === undefined || !roles.some((role) => held.includes(role))) {
    throw new RangeError('School cover access is unavailable');
  }
}

/** A school session is resolved by its stable ID, never supplied as editable teacher text. */
export function coverSession(authority: CoverAuthority, id: string): CoverSession {
  const matches = authority.sessions.filter((one) => one.id === id && one.schoolId === authority.schoolId);
  const session = matches.length === 1 ? matches[0] : undefined;
  if (
    session === undefined ||
    !isDay(session.day) ||
    !isWithin(session.day, authority.year.from, authority.year.to) ||
    !authority.members.get(session.teacherId)?.includes('teacher') ||
    !['morning', 'afternoon'].includes(session.slot.half) ||
    !Number.isSafeInteger(session.slot.index) ||
    session.slot.index < 1 ||
    session.id.trim() === '' ||
    session.classId.trim() === '' ||
    session.className.trim() === '' ||
    session.level.trim() === '' ||
    session.className.length > 100
  )
    throw new RangeError('No such school session');
  const { schoolId, teacherId, classId, className, level, day, slot } = session;
  return { id, schoolId, teacherId, classId, className, level, day, slot: { half: slot.half, index: slot.index } };
}

const sameSlot = (a: CoverSession, b: CoverSession) => a.day === b.day && compareSlots(a.slot, b.slot) === 0;

/** Only known fields are kept, and a colleague must actually be free in the supplied school timetable. */
export function coverChoice(
  authority: CoverAuthority,
  session: CoverSession,
  choice: CoverChoice,
  current: readonly SchoolCover[],
): CoverChoice {
  if (choice.kind === 'release') {
    if (
      authority.sessions.some(
        (one) =>
          one.schoolId === session.schoolId &&
          one.classId === session.classId &&
          one.day === session.day &&
          compareSlots(one.slot, session.slot) > 0,
      )
    ) {
      throw new RangeError('Only the last session may release pupils');
    }
    return { kind: choice.kind };
  }
  if (choice.kind === 'swap' || choice.kind === 'move') {
    const other = coverSession(authority, choice.sessionId);
    if (other.id === session.id) throw new RangeError('A timetable change needs a different session');
    return { kind: choice.kind, sessionId: other.id };
  }
  if (!['supervision', 'study-room', 'colleague', 'merge'].includes(choice.kind)) {
    throw new RangeError('Unknown cover choice');
  }
  if ('teacherId' in choice && choice.teacherId !== undefined) {
    if (choice.teacherId === session.teacherId || !authority.members.get(choice.teacherId)?.includes('teacher')) {
      throw new RangeError('No eligible colleague');
    }
    const busy = authority.sessions.filter(
      (one) => one.schoolId === authority.schoolId && one.teacherId === choice.teacherId && sameSlot(one, session),
    );
    if (choice.kind === 'merge') {
      if (!busy.some((one) => one.classId === choice.classId)) throw new RangeError('No matching class to merge');
    } else if (busy.length > 0) throw new RangeError('The colleague already has a session');
    if (
      current.some(
        (one) =>
          one.session.id !== session.id &&
          sameSlot(one.session, session) &&
          'teacherId' in one.choice &&
          one.choice.teacherId === choice.teacherId,
      )
    ) {
      throw new RangeError('The colleague already has cover');
    }
  } else if (choice.kind === 'colleague' || choice.kind === 'merge') {
    throw new RangeError('A colleague is required');
  }
  return choice.kind === 'merge'
    ? { kind: choice.kind, teacherId: choice.teacherId, classId: choice.classId }
    : ({
        kind: choice.kind,
        ...('teacherId' in choice && choice.teacherId !== undefined && { teacherId: choice.teacherId }),
      } as CoverChoice);
}

/** The teacher assigned a staffed cover, or none for an unstaffed arrangement. */
export function coverGiver(cover: SchoolCover): string | undefined {
  return 'teacherId' in cover.choice ? cover.choice.teacherId : undefined;
}
