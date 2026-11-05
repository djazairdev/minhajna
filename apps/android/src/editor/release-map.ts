// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release's map of who holds what (#614, PRD section 5.2, answer 768): the
// curators' account keeping the draft, the two reviewers comparing it, the
// Ministry's account for an Official pack, the server taking each step and
// seeing no content, the sealed national space, and the teachers' phones, which
// alone hold their pins, layers and progress. A line waiting on a later stage
// is drawn idle; the Ministry's is dashed, as it runs only for an Official
// pack. Right to left, the boxes are mirrored. The same boxes and lines are
// written out, which a screen reader reads and the phone shows alone.

import type { PackStage } from '@minhajna/core';
import type { TFunction } from 'i18next';
import type { MapLink, MapNode, MapSpec } from '../drawing/drawing-kit';

const WIDTH = 708;
const BOXES = {
  curators: [0, 0],
  reviewers: [0, 150],
  ministry: [0, 300],
  server: [270, 0],
  space: [270, 300],
  teachers: [540, 300],
} as const;
type Box = keyof typeof BOXES;

const LINES: readonly (readonly [Box, Box, string, PackStage | null])[] = [
  ['curators', 'server', 'steps', null],
  ['curators', 'reviewers', 'draft', 'under-review'],
  ['reviewers', 'curators', 'verdict', 'under-review'],
  ['ministry', 'server', 'official', 'published'],
  ['curators', 'space', 'sealed', null],
  ['space', 'teachers', 'signed', 'published'],
];

const REACHED: Readonly<Record<PackStage, readonly PackStage[]>> = {
  draft: [],
  'under-review': ['under-review'],
  published: ['under-review', 'published'],
  superseded: ['under-review', 'published'],
  withdrawn: ['under-review'],
};

export interface ReleaseMap {
  readonly spec: MapSpec;
  readonly boxes: readonly { readonly id: string; readonly label: string; readonly holds: string }[];
  readonly lines: readonly { readonly id: string; readonly text: string; readonly now: boolean }[];
}

/** The map for a release at this stage, and its boxes and lines written out. */
export function releaseMap(t: TFunction, stage: PackStage, rightToLeft: boolean): ReleaseMap {
  const word = (key: string): string => t(`editorDesk.map.${key}` as never);
  const nodes: MapNode[] = (Object.keys(BOXES) as Box[]).map((id) => ({
    id,
    label: word(`${id}.label`),
    x: rightToLeft ? WIDTH - 168 - BOXES[id][0] : BOXES[id][0],
    y: BOXES[id][1],
  }));
  const now = ([, , , needs]: (typeof LINES)[number]) => needs === null || REACHED[stage].includes(needs);
  const links: MapLink[] = LINES.map((line) => ({
    from: line[0],
    to: line[1],
    label: word(`line.${line[2]}`),
    ...(line[0] === 'ministry' ? { conditional: true } : {}),
    ...(now(line) ? {} : { idle: true }),
  }));
  return {
    spec: { label: word('label'), nodes, links },
    boxes: nodes.map(({ id, label }) => ({ id, label, holds: word(`${id}.holds`) })),
    lines: LINES.map((line) => ({
      id: line[2],
      text: t('editorDesk.map.written', {
        from: word(`${line[0]}.label`),
        to: word(`${line[1]}.label`),
        what: word(`line.${line[2]}`),
      }),
      now: now(line),
    })),
  };
}
