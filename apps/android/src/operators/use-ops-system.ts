// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What Ops-Console reads (#618, answer 655): the server's description, as
// use-ops-read.ts reads every operators' page.

import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { readSystem } from './ops-system';
import { useOpsRead } from './use-ops-read';

/** The server's description, a problem reading it, and a way to read again. */
export function useOpsSystem(world: Pick<OpenWorld, 'world'>, send: Send = worldRequest) {
  const { value, ...rest } = useOpsRead(() => readSystem(world.world, send));
  return { view: value, ...rest };
}
