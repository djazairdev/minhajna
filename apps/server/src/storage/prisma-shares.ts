// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The schools' shares of the totals in PostgreSQL (#596, answer 628), through
// Prisma's client, under the memory store's rules: each share kept by its
// world, day and ID as JSON, a share sent again replacing the first in its
// place, at most MAX_SHARES a day, which shares sent at the same moment may
// pass by a few. Erasing a world erases its shares in the database itself, so
// forgetting a world here does nothing more.

import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { Share } from '../totals/share-read.js';
import { MAX_SHARES, type ShareKept, type ShareStore } from '../totals/share-store.js';

const toDate = (day: string): Date => new Date(`${day}T00:00:00Z`);

export class PrismaShareStore implements ShareStore {
  constructor(private readonly client: PrismaClient) {}

  async put(world: string, share: Share): Promise<ShareKept> {
    const key = { worldId: world, day: toDate(share.day), id: share.id };
    const body = share as unknown as Prisma.InputJsonObject;
    if ((await this.client.share.updateMany({ where: key, data: { body } })).count > 0) return 'replaced';
    if ((await this.client.share.count({ where: { worldId: world, day: toDate(share.day) } })) >= MAX_SHARES) {
      return 'full';
    }
    try {
      await this.client.share.create({ data: { ...key, body } });
      return 'added';
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
      if (error.code === 'P2003') return 'no-world';
      if (error.code === 'P2002') return this.put(world, share);
      throw error;
    }
  }

  async shares(world: string, day: string): Promise<Share[]> {
    const rows = await this.client.share.findMany({
      where: { worldId: world, day: toDate(day) },
      orderBy: { seq: 'asc' },
    });
    return rows.map((row) => row.body as unknown as Share);
  }

  forget(): Promise<void> {
    return Promise.resolve();
  }
}
