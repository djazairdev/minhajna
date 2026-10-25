// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Layer files (#226, answers 337 and 338). A district layer comes inside a
// signed file, signed by a key that may sign packs; a school layer comes
// as it is, a file or a QR code of at most 16 KB, from the coordinator, who
// builds it from one class's changes. Each kind comes only its own way, so
// an unsigned file can never pass for an inspector's distribution. Both are
// read as untrusted: every field is checked, only the format's fields are
// kept, and a problem is a fixed code, never the file's own text.

import { courseDecisions } from './lineage.ts';
import { isOneLine } from './calendar-notice-read.ts';
import { canonicalJson } from './canonical.ts';
import type { Context } from './context.ts';
import type { Day } from './day.ts';
import { PACK_ID } from './pack.ts';
import { keySigns } from './pack-update.ts';
import { parsePackId } from './pack-catalogue.ts';
import { changesFor, type PlanChange } from './plan-layer.ts';
import { at, isFields, Reader, type Fields } from './read.ts';
import type { CountryProfile } from './reference.ts';
import {
  openSigned,
  readVersion,
  SIGNED_BYTES,
  SIGNED_FORMAT,
  utf8Length,
  type SignedProblem,
  type TrustedKey,
  type Verifier,
} from './signed-read.ts';
import { opId, type AddedLayer, type LayerLevel, type LayerOp, type PlanLayer } from './variant-layers.ts';

export const PLAN_LAYER_FORMAT = 'minhajna.plan-layer';

/** The most a layer file may hold, signed or not, in UTF-8 bytes. */
export const LAYER_BYTES = SIGNED_BYTES;

const LAYER_ID = /^[a-z0-9-]{3,64}$/;
const REF = /^[A-Za-z0-9._~-]{1,256}$/;
const OPS_MAX = 200;
const OP_KINDS = ['move', 'budget', 'split', 'add', 'skip', 'join'] as const;

export type LayerProblem = SignedProblem | 'level' | 'signer';

export type LayerRead =
  | { readonly ok: true; readonly added: AddedLayer; readonly signer?: TrustedKey }
  | { readonly ok: false; readonly problem: LayerProblem };

function readOp(reader: Reader, raw: unknown, path: string): LayerOp | undefined {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const ref = (key: string): string => reader.requiredText(raw, key, path, REF);
  const place = (): string | null => (raw['before'] === null ? null : ref('before'));
  const title = (value: unknown, key: string): string => {
    if (!isOneLine(value, 160)) reader.fail(at(path, key), value === undefined ? 'required' : 'invalid');
    return typeof value === 'string' ? value : '';
  };
  const sessions = (): number => {
    const value = reader.requiredNumber(raw, 'sessions', path, true);
    if (value !== undefined && value > 60) reader.fail(at(path, 'sessions'), 'invalid');
    return value ?? 0;
  };
  const pair = (key: string): readonly [unknown, unknown] => {
    const value: unknown = raw[key];
    if (!Array.isArray(value) || value.length !== 2) {
      reader.fail(at(path, key), value === undefined ? 'required' : 'invalid');
      return ['', ''];
    }
    return [value[0] as unknown, value[1] as unknown];
  };
  switch (reader.oneOf(raw, 'kind', path, OP_KINDS)) {
    case undefined:
      return undefined;
    case 'move':
      return { kind: 'move', item: ref('item'), before: place() };
    case 'budget':
      return { kind: 'budget', item: ref('item'), sessions: sessions() };
    case 'split': {
      const [first, second] = pair('titles');
      return { kind: 'split', item: ref('item'), titles: [title(first, 'titles'), title(second, 'titles')] };
    }
    case 'add':
      return { kind: 'add', title: title(raw['title'], 'title'), sessions: sessions(), before: place() };
    case 'skip':
      return { kind: 'skip', item: ref('item') };
    case 'join': {
      const [first, second] = pair('items').map((id) => (typeof id === 'string' && REF.test(id) ? id : '')) as [
        string,
        string,
      ];
      if (first === '' || second === '' || first === second) reader.fail(at(path, 'items'), 'invalid');
      return { kind: 'join', items: [first, second] };
    }
  }
}

/** Reads a layer from a layer file's payload, for the country the app is built for. */
export function parsePlanLayer(input: unknown, profile: CountryProfile): PlanLayer | LayerProblem {
  if (!isFields(input) || input['format'] !== PLAN_LAYER_FORMAT) return 'invalid';
  if (readVersion(input['version'])?.major !== 1) return 'version';
  const reader = new Reader();
  const level = reader.oneOf(input, 'level', '', ['district', 'school'] as const);
  const id = reader.requiredText(input, 'id', '', LAYER_ID);
  const pack = reader.requiredText(input, 'pack', '', PACK_ID);
  if (input['country'] !== profile.code || parsePackId(pack)?.country !== profile.code) reader.fail('pack', 'invalid');
  const text = (key: string, limit: number, required: boolean): string | undefined => {
    const value = input[key];
    if (value === undefined && !required) return undefined;
    if (!isOneLine(value, limit)) reader.fail(key, 'invalid');
    return typeof value === 'string' ? value : undefined;
  };
  const title = text('title', 160, true) ?? '';
  const by = text('by', 160, true) ?? '';
  const note = text('note', 500, false);
  const made = reader.day(input, 'made', '');
  const operations = reader.list(input, 'operations', '', (raw, path) => readOp(reader, raw, path), {
    nonEmpty: true,
  });
  if (operations.length > OPS_MAX) reader.fail('operations', 'invalid');
  if (reader.problems.length > 0 || level === undefined || made === undefined) return 'payload';
  return { level, id, pack, title, by, ...(note !== undefined && { note }), made, operations };
}

function parsed(text: string): Fields | null {
  const bytes = text.length > LAYER_BYTES ? null : utf8Length(text);
  if (bytes === null || bytes > LAYER_BYTES) return null;
  try {
    const raw = JSON.parse(text) as unknown;
    return isFields(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Reads a layer file: a district layer in a file signed by a key that may
 * sign packs, or a school layer as it is; either the other way is refused.
 */
export async function readLayerFile(
  text: string,
  keys: readonly TrustedKey[],
  verify: Verifier,
  profile: CountryProfile,
): Promise<LayerRead> {
  const raw = parsed(text);
  if (raw === null) return { ok: false, problem: 'invalid' };
  if (raw['format'] === SIGNED_FORMAT) {
    const opened = await openSigned(text, keys, verify, LAYER_BYTES);
    if (!opened.ok) return { ok: false, problem: opened.problem };
    if (!keySigns(opened.key, 'packs')) return { ok: false, problem: 'signer' };
    const layer = parsePlanLayer(opened.payload, profile);
    if (typeof layer === 'string') return { ok: false, problem: layer === 'invalid' ? 'payload' : layer };
    if (layer.level !== 'district') return { ok: false, problem: 'level' };
    return { ok: true, added: { layer, signed: { key: opened.key.id, file: text } }, signer: opened.key };
  }
  const layer = parsePlanLayer(raw, profile);
  if (typeof layer === 'string') return { ok: false, problem: layer };
  if (layer.level !== 'school') return { ok: false, problem: 'level' };
  return { ok: true, added: { layer } };
}

/** What the coordinator gives a school layer: an ID from `newId`, the words, and the day. */
export interface LayerAbout {
  readonly id: string;
  readonly title: string;
  readonly by: string;
  readonly note?: string;
  readonly made: Day;
}

/**
 * A school layer from a class's changes in force, in their order. Each
 * change's ID becomes its operation's, in every item it names, so an item
 * one added or split keeps its place in the others; an alignment loses the
 * class it named, which only this teacher has, and stays a move.
 */
export function layerFromChanges(context: Context, courseId: string, about: LayerAbout): PlanLayer {
  const pack = context.state.courses.get(courseId)?.pack?.id;
  const changes = changesFor(courseDecisions(context, courseId), courseId);
  if (pack === undefined || changes.length === 0)
    throw new RangeError('A layer needs a class with changes to its pack');
  const level: LayerLevel = 'school';
  const ids = new Map(changes.map((change, index) => [change.id, opId({ level, id: about.id }, index)]));
  const ref = (id: string): string =>
    id
      .split('~')
      .map((part) => ids.get(part) ?? part)
      .join('~');
  const opOf = (change: PlanChange): LayerOp[] => {
    switch (change.kind) {
      case 'move':
        return [{ kind: 'move', item: ref(change.item), before: change.before === null ? null : ref(change.before) }];
      case 'budget':
        return [{ kind: 'budget', item: ref(change.item), sessions: change.sessions }];
      case 'split':
        return [{ kind: 'split', item: ref(change.item), titles: change.titles }];
      case 'add':
        return [
          {
            kind: 'add',
            title: change.title,
            sessions: change.sessions,
            before: change.before === null ? null : ref(change.before),
          },
        ];
      case 'skip':
        return [{ kind: 'skip', item: ref(change.item) }];
      case 'join':
        return [{ kind: 'join', items: [ref(change.items[0]), ref(change.items[1])] }];
      case 'undo':
        return [];
    }
  };
  const { note, ...rest } = about;
  return { level, ...rest, pack, ...(note !== undefined && { note }), operations: changes.flatMap(opOf) };
}

/**
 * A school layer as the file the coordinator shares, or null when another
 * teacher could not read it back: not a school layer, too long, or over a
 * limit of the format.
 */
export function layerFile(layer: PlanLayer, profile: CountryProfile): string | null {
  if (layer.level !== 'school') return null;
  const payload = { format: PLAN_LAYER_FORMAT, version: { major: 1, minor: 0 }, country: profile.code, ...layer };
  const text = JSON.stringify(payload);
  const read = parsed(text) === null ? null : parsePlanLayer(payload, profile);
  return read !== null && typeof read !== 'string' && canonicalJson(read) === canonicalJson(layer) ? text : null;
}

/**
 * Whether a layer that came from another device or a backup is what it
 * says: a district layer must be its signed file's, signed by the key it
 * names, which may sign packs; a school layer has no file and reads back.
 */
export async function addedLayerHolds(
  added: AddedLayer,
  keys: readonly TrustedKey[],
  verify: Verifier,
  profile: CountryProfile,
): Promise<boolean> {
  const { layer, signed } = added;
  if (signed === undefined) return layer.level === 'school' && layerFile(layer, profile) !== null;
  if (layer.level !== 'district') return false;
  const opened = await openSigned(signed.file, keys, verify, LAYER_BYTES);
  if (!opened.ok || opened.key.id !== signed.key || !keySigns(opened.key, 'packs')) return false;
  const read = parsePlanLayer(opened.payload, profile);
  return typeof read !== 'string' && canonicalJson(read) === canonicalJson(layer);
}
