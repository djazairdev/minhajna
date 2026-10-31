// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' map of the school key (#571, answer 599), as the design draws it:
// the holder devices on one side, this one named as the director's and the
// others by the first four characters of their ID; the school key in the
// middle, with what it opens on the other side; who never holds it under
// them; and under the key the recovery, from its two parts, or that none is
// made yet. The same facts are written out in groups, which a screen reader
// reads and the phone shows alone, each box with a line about it for the
// panel of the box chosen, the key's as the design's labelled rows: who holds
// it, what it opens, who never holds it. Right to left, the holders stand on
// the right.

import type { KeysFacts } from '@minhajna/core';
import type { TFunction } from 'i18next';
import type { MapLink, MapNode, MapSpec } from '../drawing/drawing-kit';

/** A box of the map, with what the panel says of it, in labelled rows when it has them. */
export interface KeysBox {
  readonly id: string;
  readonly label: string;
  readonly about: string;
  readonly rows?: readonly { readonly label: string; readonly value: string }[];
}

/** A group of boxes as the page writes them out. */
export interface KeysGroup {
  readonly id: 'holders' | 'opens' | 'none' | 'recovery';
  readonly label: string;
  readonly boxes: readonly KeysBox[];
}

/** The map, its groups written out, and the box the panel opens on. */
export interface KeysMap {
  readonly spec: MapSpec;
  readonly groups: readonly KeysGroup[];
  readonly key: KeysBox;
}

const WIDTH = 640;
const BOX = 150;
const ROW = 64;
const OPENS = ['weeks', 'pupils', 'status'] as const;
const NONE = ['servers', 'ministry', 'inspector', 'timetable'] as const;

/** A fingerprint spelled out, character by character, for a screen reader. */
export const spelled = (fingerprint: string) => [...fingerprint].join(' ');

/** D-Keys' map of a keyring, in the screen's words and direction. */
export function keysMap(t: TFunction, facts: KeysFacts, school: string, rightToLeft: boolean): KeysMap {
  const box = (id: string, label: string, about: string): KeysBox => ({ id, label, about });
  const holders = facts.devices.map((id) =>
    id === facts.own
      ? box(`holder-${id}`, t('demo.keys.box.own'), t('demo.keys.about.own'))
      : box(`holder-${id}`, t('demo.keys.box.device', { id: id.slice(0, 4) }), t('demo.keys.about.device')),
  );
  const opens = OPENS.map((one) => box(`opens-${one}`, t(`demo.keys.box.${one}`), t(`demo.keys.about.${one}`)));
  const none = NONE.map((one) => box(`none-${one}`, t(`demo.keys.box.${one}`), t(`demo.keys.about.${one}`)));
  const made = facts.recoveries.length > 0;
  const recovery = [
    box(
      'part-school',
      t('demo.keys.box.schoolPart'),
      t(made ? 'demo.keys.about.schoolPart' : 'demo.keys.about.notMade'),
    ),
    box(
      'part-directorate',
      t('demo.keys.box.directoratePart'),
      t(made ? 'demo.keys.about.directoratePart' : 'demo.keys.about.notMade'),
    ),
    box(
      'recovery',
      t(made ? 'demo.keys.box.recovery' : 'demo.keys.box.noRecovery'),
      t(made ? 'demo.keys.about.recovery' : 'demo.keys.about.notMade'),
    ),
  ];
  const key: KeysBox = {
    ...box('key', t('demo.keys.box.key', { school }), t('demo.keys.count', { number: facts.devices.length })),
    rows: [
      { label: t('demo.keys.row.holds'), value: t('demo.keys.count', { number: facts.devices.length }) },
      { label: t('demo.keys.row.opens'), value: t('demo.keys.row.opensValue') },
      { label: t('demo.keys.row.notHeld'), value: t('demo.keys.row.notHeldValue') },
    ],
  };
  const at = (x: number) => (rightToLeft ? WIDTH - BOX - x : x);
  const place = (one: KeysBox, x: number, y: number): MapNode => ({ id: one.id, label: one.label, x: at(x), y });
  const nodes: MapNode[] = [
    ...holders.map((one, row) => place(one, 0, row * ROW)),
    place(key, 245, ROW),
    ...opens.map((one, row) => place(one, 490, row * ROW)),
    ...none.map((one, row) => place(one, 490, (OPENS.length + 1 + row) * ROW)),
    ...recovery.slice(0, 2).map((one, row) => place(one, 0, (Math.max(holders.length, 3) + 1 + row) * ROW)),
    place(recovery[2], 245, (Math.max(holders.length, 3) + 1) * ROW),
  ];
  const links: MapLink[] = [
    ...holders.map((one) => ({ from: one.id, to: 'key', label: t('demo.keys.link.holds') })),
    ...opens.map((one) => ({ from: 'key', to: one.id, label: t('demo.keys.link.opens') })),
    ...(made
      ? [
          ...recovery.slice(0, 2).map((one) => ({ from: one.id, to: 'recovery' })),
          { from: 'recovery', to: 'key', label: t('demo.keys.link.recovers') },
        ]
      : []),
  ];
  return {
    spec: { label: t('demo.keys.map'), nodes, links },
    groups: [
      { id: 'holders', label: t('demo.keys.group.holders'), boxes: [key, ...holders] },
      { id: 'opens', label: t('demo.keys.group.opens'), boxes: opens },
      { id: 'none', label: t('demo.keys.group.none'), boxes: none },
      { id: 'recovery', label: t('demo.keys.group.recovery'), boxes: recovery },
    ],
    key,
  };
}
