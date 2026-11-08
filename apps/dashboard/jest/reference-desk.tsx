// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference opened for its tests: the bundled profile, a made-up edit code
// already set on the made-up directory, the page past its gate, and the
// middle school's option codes in the draft the directory keeps.

import { ReferencePage } from '../src/ReferencePage';
import { bundledFiles, readDashboardReference } from '../src/reference';
import { choose } from './dashboard-world';
import type { FakeDirectory } from './fake-directory';
import { press, show, type } from '../../android/jest/ministry-page';

const read = readDashboardReference(bundledFiles);
if (read === null) throw new Error('The bundled reference does not read');

/** The bundled country profile. */
export const { profile } = read;

/** Chooses a value in one of the page's selects. */
export const pick = (field: string, value: string) => choose(press, field, value);

/** Opens N-Reference past its gate, with a made-up code. */
export async function openReference(directory: FakeDirectory) {
  directory.referenceCode = 'ministry-made-up';
  await show(<ReferencePage profile={profile} onBack={() => undefined} />);
  await type('gate-code', 'ministry-made-up');
  await press('gate-open');
}

/** The middle school's option codes in the directory's draft. */
export const cemOptions = (directory: FakeDirectory) =>
  directory.draft?.levels.find((one) => one.code === 'cem')?.options.map((one) => one.code);
