// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo server's answer that a world is gone (#619): a 404 whose message
// says no world has this ID and pass, which the server gives for an erased
// world and a wrong pass alike, unlike a 404 for a path it does not know.

import type { WorldAnswer } from '../network/world-network';
import { failed } from './world-session';

/** The server's word for a world ID and pass that open nothing. */
const NO_WORLD = 'no world has this id and pass';

/** Throws the server's answer that the world is gone as the world erased, E_NO_SUCH_WORLD. */
export function goneWorld(answer: WorldAnswer): void {
  if (answer.status === 404 && (answer.body as { message?: unknown } | null)?.message === NO_WORLD)
    throw failed('The world was erased', 'E_NO_SUCH_WORLD');
}
