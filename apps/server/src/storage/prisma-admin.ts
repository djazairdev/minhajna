// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The admin log and the problem reports in PostgreSQL (#619, answer 656),
// through Prisma's client, under the memory store's rules (admin-store.ts): the
// log's lines by day, action and detail, the oldest of their kind dropped past
// 1,000, and a report marked fixed erased with its line in one transaction,
// refused as busy past its waits (in-turn.ts), its first lock taken in raw SQL
// so a wait for it is told as busy; each report kept by its world and ID with
// its token's hash, at most MAX_PROBLEMS a world, which reports sent at the
// same moment may pass by a few. Erasing a world erases its reports in the
// database itself.

import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import {
  MAX_ADMIN_LINES,
  MAX_PROBLEMS,
  type AdminAction,
  type AdminDetail,
  type AdminLine,
  type AdminStore,
  type Problem,
  type ProblemPart,
  type StoredProblem,
} from '../admin/admin-store.js';
import { toDate, toDay } from './days.js';
import { inTurn, type StoreOptions } from './in-turn.js';

type Client = Pick<PrismaClient, 'adminLine' | '$executeRaw'>;

/** Adds a line, and drops the oldest of its kind past the cap. */
async function addLine(client: Client, line: AdminLine): Promise<void> {
  const detail = line.detail as unknown as Prisma.InputJsonObject;
  await client.adminLine.create({ data: { day: toDate(line.day), action: line.action, detail } });
  const fix = line.action === 'problem.fixed';
  await client.$executeRaw`
    DELETE FROM admin_line
    WHERE (action = 'problem.fixed') = ${fix} AND seq <= (
      SELECT seq FROM admin_line WHERE (action = 'problem.fixed') = ${fix}
      ORDER BY seq DESC OFFSET ${MAX_ADMIN_LINES} LIMIT 1)`;
}

export class PrismaAdminStore implements AdminStore {
  constructor(
    private readonly client: PrismaClient,
    private readonly options: StoreOptions = {},
  ) {}

  log(line: AdminLine): Promise<void> {
    return addLine(this.client, line);
  }

  async lines(most: number): Promise<AdminLine[]> {
    const rows = await this.client.adminLine.findMany({ orderBy: { seq: 'desc' }, take: most });
    return rows.map((row) => ({
      day: toDay(row.day),
      action: row.action as AdminAction,
      detail: row.detail as unknown as AdminDetail,
    }));
  }

  async addProblem(world: string, problem: StoredProblem): Promise<'added' | 'full' | 'no-world'> {
    if ((await this.client.problem.count({ where: { worldId: world } })) >= MAX_PROBLEMS) return 'full';
    const { received, ...rest } = problem;
    try {
      await this.client.problem.create({ data: { ...rest, worldId: world, received: toDate(received) } });
      return 'added';
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') return 'no-world';
      throw error;
    }
  }

  async problems(world: string): Promise<Problem[]> {
    const rows = await this.client.problem.findMany({
      where: { worldId: world },
      orderBy: { seq: 'desc' },
      select: { id: true, part: true, note: true, version: true, received: true },
    });
    return rows.map((row) => ({ ...row, part: row.part as ProblemPart, received: toDay(row.received) }));
  }

  fixProblem(world: string, id: string, line: AdminLine): Promise<boolean> {
    return inTurn(this.client, this.options, async (tx) => {
      const erased = await tx.$executeRaw`DELETE FROM problem WHERE "worldId" = ${world} AND id = ${id}`;
      if (erased === 0) return false;
      await addLine(tx, line);
      return true;
    });
  }

  async deleteProblem(world: string, id: string, tokenHash: string): Promise<boolean> {
    return (await this.client.problem.deleteMany({ where: { worldId: world, id, tokenHash } })).count > 0;
  }

  async sweep(before: string): Promise<void> {
    await this.client.adminLine.deleteMany({ where: { day: { lt: toDate(before) } } });
    await this.client.problem.deleteMany({ where: { received: { lt: toDate(before) } } });
  }
}
