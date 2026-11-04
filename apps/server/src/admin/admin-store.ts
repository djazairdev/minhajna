// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators keep (#619, §6.7, answer 656): the admin log and the
// problem reports, in memory here and in PostgreSQL through
// storage/prisma-admin.ts. The admin log is the server's own: a line for each
// administrative action, by the UTC day it was taken, never a clock time or a
// name, for 12 months; reports marked fixed keep their newest 1,000 lines and
// every other action its newest 1,000, the oldest dropped first, so marking
// reports fixed can never push the server's own lines out. A problem report is
// a world's, as the app shapes it: the part of the app, a note whose pupils'
// names the device already replaced, and the app's version, kept with the UTC
// day it came and the hash of the token its sender may delete it with, until it
// is marked fixed or deleted, 12 months at most, and erased with its world; a
// world keeps at most 200, and reports sent at the same moment may pass that by
// a few. The container logs its restore tests here itself, through the database
// (container/restore-test.sh, #620). Security logs are kept apart, in
// security-log.ts.

/** The administrative actions the log names. */
export const ADMIN_ACTIONS = ['server.started', 'worlds.erased', 'problem.fixed', 'restore.tested'] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** What a line says of its action, in fixed fields, naming nobody. */
export type AdminDetail = Readonly<Record<string, string | number | readonly string[]>>;

export interface AdminLine {
  readonly day: string;
  readonly action: AdminAction;
  readonly detail: AdminDetail;
}

/** The lines kept for reports marked fixed, and for every other action together. */
export const MAX_ADMIN_LINES = 1000;
/** The lines the console is answered, newest first. */
export const ADMIN_SHOWN = 200;
/** How long the admin log and problem reports are kept, in days. */
export const KEPT_DAYS = 365;

/** The parts of the app a report may name, as the app's own report lists them. */
export const PROBLEM_PARTS = ['today', 'classes', 'roll', 'marks', 'plan', 'documents', 'settings', 'other'] as const;
export type ProblemPart = (typeof PROBLEM_PARTS)[number];
export const MAX_PROBLEMS = 200;
export const NOTE_LIMIT = 1000;

export interface Problem {
  readonly id: string;
  readonly part: ProblemPart;
  readonly note: string;
  readonly version: string;
  readonly received: string;
}

export interface StoredProblem extends Problem {
  readonly tokenHash: string;
}

export interface AdminStore {
  log(line: AdminLine): Promise<void>;
  /** The newest lines, newest first. */
  lines(most: number): Promise<AdminLine[]>;
  addProblem(world: string, problem: StoredProblem): Promise<'added' | 'full' | 'no-world'>;
  /** A world's reports, newest first. */
  problems(world: string): Promise<Problem[]>;
  /** Erases a report marked fixed and logs the line, together; false when the world has none of that id. */
  fixProblem(world: string, id: string, line: AdminLine): Promise<boolean>;
  /** Erases a report its sender deletes; false when none matches the id and the token's hash. */
  deleteProblem(world: string, id: string, tokenHash: string): Promise<boolean>;
  /** Erases the lines and the reports from before a day, and the reports of the worlds erased. */
  sweep(before: string, worlds: readonly string[]): Promise<void>;
}

export const ADMIN_STORE = Symbol('AdminStore');

/** The day a number of days before another, in UTC. */
export function daysBefore(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

/** Whether a line's action counts with the reports marked fixed. */
export const isFix = (line: Pick<AdminLine, 'action'>) => line.action === 'problem.fixed';

export class MemoryAdminStore implements AdminStore {
  private kept: AdminLine[] = [];
  private readonly reports = new Map<string, StoredProblem[]>();

  /** Takes whether a world is still kept, so no report outlives a world erased while it came. */
  constructor(private readonly hasWorld: (world: string) => Promise<boolean> = () => Promise.resolve(true)) {}

  log(line: AdminLine): Promise<void> {
    this.kept.push(line);
    const alike = this.kept.filter((one) => isFix(one) === isFix(line));
    if (alike.length > MAX_ADMIN_LINES) {
      const dropped = new Set(alike.slice(0, alike.length - MAX_ADMIN_LINES));
      this.kept = this.kept.filter((one) => !dropped.has(one));
    }
    return Promise.resolve();
  }

  lines(most: number): Promise<AdminLine[]> {
    return Promise.resolve(most > 0 ? this.kept.slice(-most).reverse() : []);
  }

  async addProblem(world: string, problem: StoredProblem): Promise<'added' | 'full' | 'no-world'> {
    if (!(await this.hasWorld(world))) return 'no-world';
    const list = this.reports.get(world) ?? [];
    if (list.length >= MAX_PROBLEMS) return 'full';
    this.reports.set(world, [...list, problem]);
    return 'added';
  }

  problems(world: string): Promise<Problem[]> {
    const list = this.reports.get(world) ?? [];
    const shown = list.map(({ id, part, note, version, received }) => ({ id, part, note, version, received }));
    return Promise.resolve(shown.reverse());
  }

  async fixProblem(world: string, id: string, line: AdminLine): Promise<boolean> {
    if (!this.drop(world, (one) => one.id === id)) return false;
    await this.log(line);
    return true;
  }

  deleteProblem(world: string, id: string, tokenHash: string): Promise<boolean> {
    return Promise.resolve(this.drop(world, (one) => one.id === id && one.tokenHash === tokenHash));
  }

  sweep(before: string, worlds: readonly string[]): Promise<void> {
    this.kept = this.kept.filter((line) => line.day >= before);
    for (const world of worlds) this.reports.delete(world);
    for (const [world, list] of this.reports)
      this.keep(
        world,
        list.filter((one) => one.received >= before),
      );
    return Promise.resolve();
  }

  private drop(world: string, matches: (one: StoredProblem) => boolean): boolean {
    const list = this.reports.get(world) ?? [];
    const left = list.filter((one) => !matches(one));
    this.keep(world, left);
    return left.length < list.length;
  }

  private keep(world: string, list: StoredProblem[]): void {
    if (list.length > 0) this.reports.set(world, list);
    else this.reports.delete(world);
  }
}
