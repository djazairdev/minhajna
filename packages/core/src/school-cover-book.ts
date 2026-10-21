// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// This is a school-space domain boundary, not an authentication system.
// No preview build constructs one. A future authenticated adapter must own
// its separate encrypted store, membership, timetable and deployment gate.
// PRD §7.1, §7.7 and §7.8; never the teacher's ordinary RecordBook.
// Mutation dates are the school's processing dates. An adapter must never
// forward a teacher's private confirmation-entry date or history (§7.6).

import { canonicalJson } from './canonical.ts';
import { isDay, type Day } from './day.ts';
import { HistoryLog, type HistoryDeps, type HistoryStore } from './history.ts';
import { compareSlots } from './records.ts';
import { coverAccess, coverChoice, coverGiver, coverSession } from './school-cover-rules.ts';
import type {
  CoverAuthority,
  CoverChoice,
  CoverEvent,
  CoverSession,
  CoverSheetRow,
  SchoolCover,
  TeacherCover,
} from './school-cover.ts';

const managers = ['director', 'deputy'] as const;
const readers = ['director', 'deputy', 'teacher'] as const;
const clone = <T>(value: T): T => JSON.parse(canonicalJson(value)) as T;
const projection = (session: CoverSession): TeacherCover['session'] => {
  const { id, schoolId, classId, className, level, day, slot } = session;
  return { id, schoolId, classId, className, level, day, slot: { ...slot } };
};

/** Append-only school cover; authority is rechecked at each operation, including queued writes. */
export class SchoolCoverBook {
  readonly #log: HistoryLog;
  readonly #authority: () => CoverAuthority;
  #queue: Promise<unknown> = Promise.resolve();

  private constructor(log: HistoryLog, authority: () => CoverAuthority) {
    this.#log = log;
    const schoolId = authority().schoolId;
    this.#authority = () => {
      const next = authority();
      if (next.schoolId !== schoolId) throw new RangeError('Wrong school membership');
      return next;
    };
  }

  /** A school-key holder opens the authoritative book; other roles receive projections, never this store or its key. */
  static async open(store: HistoryStore, deps: HistoryDeps, authority: () => CoverAuthority): Promise<SchoolCoverBook> {
    coverAccess(authority(), managers);
    const book = new SchoolCoverBook(await HistoryLog.open(store, deps), authority);
    coverAccess(book.#authority(), managers);
    book.#current();
    return book;
  }

  #current(): SchoolCover[] {
    const schoolId = this.#authority().schoolId;
    const rows = new Map<string, SchoolCover>();
    for (const entry of this.#log.entries) {
      const event = entry.content?.body as CoverEvent | undefined;
      if (!event || event.schoolId !== schoolId || event.kind !== entry.kind) throw new RangeError('Wrong cover store');
      switch (event.kind) {
        case 'cover.set':
          rows.set(event.cover.session.id, event.cover);
          break;
        case 'cover.cancelled':
          rows.delete(event.sessionId);
          break;
        case 'cover.completed':
        case 'cover.reopened': {
          const old = rows.get(event.sessionId);
          if (old === undefined) throw new RangeError('No such cover');
          rows.set(event.sessionId, { ...old, completed: event.kind === 'cover.completed' });
          break;
        }
        default:
          throw new RangeError('Unknown cover event');
      }
    }
    return [...rows.values()].sort(
      (a, b) =>
        a.session.day.localeCompare(b.session.day) ||
        compareSlots(a.session.slot, b.session.slot) ||
        a.session.id.localeCompare(b.session.id),
    );
  }

  #write(day: Day, work: (authority: CoverAuthority, current: SchoolCover[]) => CoverEvent | null): Promise<void> {
    const next = this.#queue.then(async () => {
      if (!isDay(day)) throw new RangeError('A history date has no clock time');
      const authority = this.#authority();
      coverAccess(authority, readers);
      const event = work(authority, this.#current());
      if (event !== null) await this.#log.append(day, 'lesson-record', event.kind, event);
    });
    this.#queue = next.catch(() => undefined);
    return next;
  }

  /** The director marks a session needing cover; supervision is the initial, still unassigned choice. */
  need(sessionId: string, day: Day): Promise<void> {
    return this.#write(day, (authority, current) => {
      coverAccess(authority, managers);
      const session = coverSession(authority, sessionId);
      if (current.some((one) => one.session.id === sessionId)) return null;
      return {
        kind: 'cover.set',
        schoolId: authority.schoolId,
        actorId: authority.actorId,
        cover: { session, choice: { kind: 'supervision' }, assigned: false, completed: false },
      };
    });
  }

  /** Assign or correct a marked session. A completed teacher record cannot be overwritten by management. */
  assign(sessionId: string, choice: CoverChoice, day: Day): Promise<void> {
    const draft = clone(choice);
    return this.#write(day, (authority, current) => {
      coverAccess(authority, managers);
      const old = current.find((one) => one.session.id === sessionId);
      if (old === undefined || old.completed) throw new RangeError('Cover is missing or already confirmed');
      const session = coverSession(authority, sessionId);
      const cover = {
        session,
        choice: coverChoice(authority, session, draft, current),
        assigned: true,
        completed: false,
      };
      if (canonicalJson(old) === canonicalJson(cover)) return null;
      return { kind: 'cover.set', schoolId: authority.schoolId, actorId: authority.actorId, cover };
    });
  }

  /** Cancel an unconfirmed assignment without erasing its previous versions or recording a reason. */
  cancel(sessionId: string, day: Day): Promise<void> {
    return this.#write(day, (authority, current) => {
      coverAccess(authority, managers);
      const old = current.find((one) => one.session.id === sessionId);
      if (old === undefined || old.completed) throw new RangeError('Cover is missing or already confirmed');
      return { kind: 'cover.cancelled', schoolId: authority.schoolId, actorId: authority.actorId, sessionId };
    });
  }

  /** The assigned teacher confirms their own cover, or withdraws that confirmation; nobody records a reason. */
  confirm(sessionId: string, completed: boolean, day: Day): Promise<void> {
    return this.#write(day, (authority, current) => {
      const old = current.find((one) => one.session.id === sessionId);
      if (
        old === undefined ||
        !old.assigned ||
        coverGiver(old) !== authority.actorId ||
        (completed && old.session.day > day)
      )
        throw new RangeError('No confirmable cover');
      if (old.completed === completed) return null;
      return {
        kind: completed ? 'cover.completed' : 'cover.reopened',
        schoolId: authority.schoolId,
        actorId: authority.actorId,
        sessionId,
      };
    });
  }

  /** Only this authenticated teacher's given and received cover, never their colleagues' other sessions. */
  teacherRows(day: Day): readonly TeacherCover[] {
    const authority = this.#authority();
    coverAccess(authority, readers);
    return this.#current().flatMap((cover): TeacherCover[] => {
      const given = coverGiver(cover) === authority.actorId;
      if (cover.session.day !== day || (!given && cover.session.teacherId !== authority.actorId)) return [];
      return [
        {
          session: projection(cover.session),
          direction: given ? 'given' : 'received',
          choice: cover.choice.kind,
          assigned: cover.assigned,
          completed: cover.completed,
        },
      ];
    });
  }

  /** Supervisors receive only the day's arrangements, without the holder's identity or any history. */
  dailySheet(day: Day): readonly CoverSheetRow[] {
    const authority = this.#authority();
    coverAccess(authority, [...managers, 'supervisor']);
    return this.#current()
      .filter((one) => one.session.day === day)
      .map((cover) => {
        return {
          session: projection(cover.session),
          choice: clone(cover.choice),
          assigned: cover.assigned,
          completed: cover.completed,
        };
      });
  }

  /** Management sees actual confirmed cover for fair distribution, not counts of teachers' absences. */
  givenCover(): readonly { readonly teacherId: string; readonly session: TeacherCover['session'] }[] {
    coverAccess(this.#authority(), managers);
    return this.#current().flatMap((cover) => {
      const teacherId = coverGiver(cover);
      return !cover.completed || teacherId === undefined ? [] : [{ teacherId, session: projection(cover.session) }];
    });
  }

  /** Management selects dated sessions from the school's timetable, never from teacher-entered cover text. */
  sessions(day: Day): readonly CoverSession[] {
    const authority = this.#authority();
    coverAccess(authority, managers);
    return authority.sessions
      .filter((one) => one.schoolId === authority.schoolId && one.day === day)
      .map((one) => coverSession(authority, one.id));
  }

  /** Only currently valid arrangements are offered; saving revalidates them against the latest school state. */
  choices(sessionId: string, kind: CoverChoice['kind']): readonly CoverChoice[] {
    const authority = this.#authority();
    coverAccess(authority, managers);
    const session = coverSession(authority, sessionId);
    const staff = [...authority.members].filter(([, roles]) => roles.includes('teacher')).map(([id]) => id);
    const targets = authority.sessions.filter((one) => one.schoolId === authority.schoolId && one.id !== sessionId);
    const proposals: CoverChoice[] =
      kind === 'release'
        ? [{ kind }]
        : kind === 'swap' || kind === 'move'
          ? targets.map((one) => ({ kind, sessionId: one.id }))
          : kind === 'merge'
            ? targets
                .filter((one) => one.day === session.day && compareSlots(one.slot, session.slot) === 0)
                .map((one) => ({ kind, teacherId: one.teacherId, classId: one.classId }))
            : [
                ...(kind === 'supervision' || kind === 'study-room' ? [{ kind }] : []),
                ...staff.map((teacherId) => ({ kind, teacherId })),
              ];
    const current = this.#current();
    const offered = new Map<string, CoverChoice>();
    for (const proposal of proposals) {
      try {
        const valid = coverChoice(authority, session, proposal, current);
        offered.set(canonicalJson(valid), valid);
      } catch {
        continue;
      }
    }
    return [...offered.values()];
  }
}
