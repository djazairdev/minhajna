// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pack desk in PostgreSQL (#612, answer 767), through Prisma's client,
// under the memory store's rules (pack-store.ts): one account for each role of
// a world, and each release's steps by revision, a step and its replacing of
// later ones in one transaction, at most MAX_PACK_STEPS a world, which steps
// taken at the same moment may pass by a few. Erasing a world erases them in
// the database itself.

import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { PackRole, PackStep } from '../packs/pack-rules.js';
import { MAX_PACK_STEPS, type PackStore } from '../packs/pack-store.js';
import { toDate, toDay } from './days.js';

type Row = Awaited<ReturnType<PrismaClient['packStep']['findFirstOrThrow']>>;

const stepOf = ({ packId, supersededBy, day, role, stage, ...row }: Row): PackStep => ({
  id: packId,
  release: row.release,
  revision: row.revision,
  stage: stage as PackStep['stage'],
  role: role as PackRole,
  status: row.status,
  digest: row.digest,
  by: supersededBy,
  day: toDay(day),
  signature: row.signature,
});

const noWorld = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

export class PrismaPackStore implements PackStore {
  constructor(private readonly client: PrismaClient) {}

  async setAccount(worldId: string, role: PackRole, tokenHash: string): Promise<boolean> {
    try {
      await this.client.packAccount.upsert({
        where: { worldId_role: { worldId, role } },
        create: { worldId, role, tokenHash },
        update: { tokenHash },
      });
      return true;
    } catch (error) {
      if (noWorld(error)) return false;
      throw error;
    }
  }

  async accountRole(worldId: string, tokenHash: string): Promise<PackRole | undefined> {
    const row = await this.client.packAccount.findFirst({ where: { worldId, tokenHash } });
    return row?.role as PackRole | undefined;
  }

  async putStep(worldId: string, step: PackStep, again = true): Promise<'kept' | 'full' | 'no-world'> {
    const { id: packId, release, revision } = step;
    const replaced = { packId, release, revision: { gte: revision } };
    const others = await this.client.packStep.count({ where: { worldId, NOT: replaced } });
    if (others >= MAX_PACK_STEPS) return 'full';
    const data = {
      release,
      revision,
      stage: step.stage,
      role: step.role,
      status: step.status,
      digest: step.digest,
      supersededBy: step.by,
      day: toDate(step.day),
      signature: step.signature,
    };
    try {
      await this.client.$transaction([
        this.client.packStep.deleteMany({ where: { worldId, ...replaced } }),
        this.client.packStep.create({ data: { worldId, packId, ...data } }),
      ]);
      return 'kept';
    } catch (error) {
      if (noWorld(error)) return 'no-world';
      if (again && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.putStep(worldId, step, false);
      }
      throw error;
    }
  }

  async latestSteps(worldId: string): Promise<PackStep[]> {
    const rows = await this.client.packStep.findMany({
      where: { worldId },
      distinct: ['packId', 'release'],
      orderBy: [{ packId: 'asc' }, { release: 'asc' }, { revision: 'desc' }],
    });
    return rows.map(stepOf);
  }

  forget(): Promise<void> {
    return Promise.resolve();
  }
}
