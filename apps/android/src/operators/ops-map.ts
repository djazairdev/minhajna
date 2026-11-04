// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ops-Console's map of the demo server (#618, answer 655), drawn only from what
// the server says of itself (ops-system.ts), so a part it does not report is
// not drawn and no line is added by hand. Outside, at the top, the teachers'
// devices and browsers, and outside services beside them, closed; inside, under
// the devices, the gateway, then the batch store, then the storage; the totals
// on one side of the store, with the directorates' and the Ministry's screens
// under them, and the state's stand-ins on the other, with the backups under
// them only while the database is set to archive, and the observatory above
// them, whose figures go back to the devices; the store, the totals, the
// stand-ins and the observatory each keep what they hold in the storage. A line
// that does not pass, to outside services, is faint and struck through. Left to
// right, the boxes are mirrored. The same boxes and lines are written out in
// two groups, which a screen reader reads and the phone shows alone, each with
// its facts for the panel of the one chosen in labelled rows and a note.

import type { TFunction } from 'i18next';
import type { MapLink, MapNode, MapSpec } from '../drawing/drawing-kit';
import type { ServerPart, SystemView } from './ops-system';

export type OpsBox = 'devices' | 'outside' | ServerPart | 'storage' | 'screens' | 'backups';
export type OpsLine =
  | 'batches'
  | 'back'
  | 'kept'
  | 'shares'
  | 'totals'
  | 'exports'
  | 'sendings'
  | 'figures'
  | 'rows'
  | 'held'
  | 'receipts'
  | 'sendingsKept'
  | 'copies'
  | 'closed';
export type OpsId = OpsBox | `line.${OpsLine}`;

/** A box or a line as the page writes it out, with what the panel says of it. */
export interface OpsItem {
  readonly id: OpsId;
  readonly label: string;
  /** A box's line under its name. */
  readonly sub?: string;
  readonly rows: readonly { readonly key: string; readonly label: string; readonly value: string }[];
  readonly note?: string;
}

/** The map, and its boxes and lines written out. */
export interface OpsMap {
  readonly spec: MapSpec;
  readonly boxes: readonly OpsItem[];
  readonly lines: readonly OpsItem[];
}

const WIDTH = 708;
const BOX = 170;
/** Where each box stands, right to left; the totals' and stand-ins' lines enter the storage's sides. */
const PLACES: Readonly<Record<OpsBox, readonly [number, number]>> = {
  devices: [269, 24],
  outside: [13, 24],
  gateway: [269, 150],
  relay: [269, 290],
  totals: [13, 360],
  standins: [525, 360],
  observatory: [525, 200],
  storage: [269, 430],
  screens: [13, 590],
  backups: [525, 590],
};
/** Each line, from and to; it is drawn when both its boxes are. */
const LINES: readonly (readonly [OpsLine, OpsBox, OpsBox])[] = [
  ['batches', 'devices', 'gateway'],
  ['back', 'gateway', 'devices'],
  ['kept', 'gateway', 'relay'],
  ['shares', 'gateway', 'totals'],
  ['totals', 'totals', 'screens'],
  ['exports', 'gateway', 'standins'],
  ['sendings', 'gateway', 'observatory'],
  ['figures', 'observatory', 'devices'],
  ['rows', 'relay', 'storage'],
  ['held', 'totals', 'storage'],
  ['receipts', 'standins', 'storage'],
  ['sendingsKept', 'observatory', 'storage'],
  ['copies', 'storage', 'backups'],
  ['closed', 'gateway', 'outside'],
];
/** The rows a box's panel has, and a line's. */
const BOX_ROWS = ['holds', 'sees', 'never'] as const;
const LINE_ROWS = ['carries', 'sees'] as const;

/** The catalogue's words by keys made up from the ids, which the typed keys cannot follow. */
type Words = (key: string, options?: Readonly<Record<string, unknown>>) => string;

/** The boxes the server's description gives, in the order they are written out. */
export function opsBoxes(view: SystemView): OpsBox[] {
  const archived = view.storage === 'postgresql' && view.database === 'ok' && view.archive === 'on';
  const parts = new Set<OpsBox>(view.parts);
  const runs = (box: OpsBox) => parts.has(box);
  return [
    'devices',
    ...(runs('gateway') ? (['gateway'] as const) : []),
    ...(['relay', 'totals', 'standins', 'observatory'] as const).filter(runs),
    'storage',
    ...(runs('totals') ? (['screens'] as const) : []),
    ...(archived ? (['backups'] as const) : []),
    'outside',
  ];
}

/** Ops-Console's map, in the screen's words and direction. */
export function opsMap(t: TFunction, view: SystemView, rightToLeft: boolean): OpsMap {
  const word = t as unknown as Words;
  const boxes = opsBoxes(view);
  const kind = view.storage === 'memory' ? 'memory' : 'postgresql';
  const facts = (id: string, rows: readonly string[]) =>
    rows.map((row) => ({ key: row, label: word(`demo.ops.row.${row}`), value: word(`demo.ops.facts.${id}.${row}`) }));
  const boxItems = boxes.map((id): OpsItem => {
    const key = id === 'storage' ? `storage.${kind}` : id;
    return {
      id,
      label: word(`demo.ops.box.${id}`),
      sub: word(`demo.ops.sub.${key}`),
      rows: facts(key, BOX_ROWS),
      note: word(`demo.ops.note.${key}`),
    };
  });
  const shown = LINES.filter(([, from, to]) => boxes.includes(from) && boxes.includes(to));
  const lineItems = shown.map(([id]): OpsItem => ({
    id: `line.${id}`,
    label: word(`demo.ops.line.${id}`),
    rows: facts(`line.${id}`, LINE_ROWS),
  }));
  const nodes: MapNode[] = boxes.map((id) => {
    const [x, y] = PLACES[id];
    return { id, label: word(`demo.ops.box.${id}`), x: rightToLeft ? x : WIDTH - BOX - x, y };
  });
  const links: MapLink[] = shown.map(([id, from, to]) => ({
    from,
    to,
    label: word(`demo.ops.line.${id}`),
    ...(id === 'closed' ? { idle: true } : {}),
  }));
  return { spec: { label: t('demo.ops.map'), nodes, links }, boxes: boxItems, lines: lineItems };
}
