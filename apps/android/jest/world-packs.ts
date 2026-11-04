// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo server's pack desk for the app's tests (#612), on the server's own
// code: its memory store, its rules for each step, and the world's CA key.

import { takePackStep } from '../../server/src/packs/pack-desk';
import { PACK_ROLES, type PackRole } from '../../server/src/packs/pack-rules';
import { MemoryPackStore } from '../../server/src/packs/pack-store';
import { hashToken, newStarterToken } from '../../server/src/worlds/world-rules';

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

export interface PackDeskRequest {
  readonly world: string;
  readonly date: string;
  readonly method: string;
  /** The path's segment after `packs`. */
  readonly segment: string;
  readonly authorization: string | undefined;
  /** Whether the request carries the world's starter token. */
  readonly starter: boolean;
  readonly body: unknown;
  readonly caKey: () => string;
}

export class WorldPackDesk {
  store = new MemoryPackStore();

  reset(): void {
    this.store = new MemoryPackStore();
  }

  async route({ world, date, method, segment, authorization, starter, body, caKey }: PackDeskRequest) {
    if (segment === 'accounts' && method === 'POST') {
      const role = (body as { role?: PackRole } | null)?.role;
      if (!starter) return reply(403, {});
      if (role === undefined || !PACK_ROLES.includes(role)) return reply(400, {});
      const token = newStarterToken();
      await this.store.setAccount(world, role, hashToken(token));
      return reply(201, { role, token });
    }
    if (segment === 'steps' && method === 'GET') return reply(200, { steps: await this.store.latestSteps(world) });
    const held = /^Bearer (.+)$/.exec(authorization ?? '')?.[1];
    const role = held === undefined ? undefined : await this.store.accountRole(world, hashToken(held));
    if (role === undefined) return reply(403, {});
    if (segment === 'account' && method === 'GET') return reply(200, { role });
    if (segment !== 'steps' || method !== 'POST') return reply(404, {});
    const taken = await takePackStep(this.store, { world, date, caKey: caKey() }, role, body);
    if ('step' in taken) return reply(201, taken.step);
    const status = { shape: 400, role: 403, gone: 404, full: 507, date: 409, revision: 409 }[taken.refused];
    return reply(status, { problem: taken.refused, message: taken.message });
  }
}
