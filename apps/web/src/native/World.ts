// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's own history on the web (#558). Until the browser keeps a
// world's records in their own database under their own key (#558, part
// 2), a PC enters no world: entering and every call inside a world are
// refused, leaving or erasing one finds nothing to do, and the teacher's
// own history is never touched.

import type { Spec } from '../../../android/src/native/NativeMinhajnaWorld';
import { refused } from './files/picked.ts';

const notYet = () => Promise.reject(refused('E_WORLD', 'A PC does not enter a demo world yet'));

const World: Spec = {
  enterWorld: notYet,
  leaveWorld: () => Promise.resolve(),
  loadHistory: notYet,
  appendEntry: notYet,
  eraseContent: notYet,
  eraseWorld: () => Promise.resolve(),
};

export default World;
