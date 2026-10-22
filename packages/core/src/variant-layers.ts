// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// District and school layers (#226, PRD §4.2, R-4.2-15, R-4.2-16): variants
// of the national plan, never official, between the pack and the class's
// own changes. Each is a list of operations over one pack, any release of
// it, made as a class's changes are and applied the same way, district
// first, then school, then the class's own; an operation that no longer
// fits is left out. A district layer is an inspector's distribution,
// credited and used with their consent, which the curators sign; a school
// layer is one class's changes, which the subject's coordinator shares as
// it is, unverified (answer 337). Taking a layer in switches nothing on:
// each class has its own switch at each level, one layer at a time
// (answer 338), and switching one off brings its items back as they are
// below it, while recorded sessions never change.
//
// A layer is never changed once taken in: a revised one comes under a new
// ID. Its operations take IDs from the layer and their place in it, so an
// item one adds or splits has the same ID on every device.

import { inherited } from './lineage.ts';
import { canonicalJson } from './canonical.ts';
import type { Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import type { PlanChange } from './plan-layer.ts';
import type { State } from './state.ts';

export const LAYER_LEVELS = ['district', 'school'] as const;

export type LayerLevel = (typeof LAYER_LEVELS)[number];

type Unplaced<T> = T extends unknown ? Omit<T, 'id' | 'courseId' | 'day' | 'seq'> : never;

/** One operation of a layer: a class's change without its ID, class or place, and never an undo. */
export type LayerOp = Unplaced<Exclude<PlanChange, { readonly kind: 'undo' }>>;

export interface PlanLayer {
  readonly level: LayerLevel;
  /** Lowercase letters, digits and hyphens; a school layer's is random. */
  readonly id: string;
  /** The ID of the pack it changes, whatever the release. */
  readonly pack: string;
  readonly title: string;
  /** Who made it: the inspector, named with their consent, or the coordinator who shared it. */
  readonly by: string;
  readonly note?: string;
  readonly made: Day;
  readonly operations: readonly LayerOp[];
}

/** A layer as the teacher took it in; a district layer keeps its signed file, to pass on as it came. */
export interface AddedLayer {
  readonly layer: PlanLayer;
  readonly signed?: { readonly key: string; readonly file: string };
}

/** Which layer a class has on at one level; null once switched off. */
export interface LayerSwitch {
  readonly courseId: string;
  readonly level: LayerLevel;
  readonly layer: string | null;
}

/** The layers a class has on, district first, and every layer taken in for its pack, whose items keep their titles. */
export interface CourseLayers {
  readonly on: readonly PlanLayer[];
  readonly known: readonly PlanLayer[];
}

export const NO_LAYERS: CourseLayers = { on: [], known: [] };

export function layerKey(layer: Pick<PlanLayer, 'level' | 'id'>): string {
  return `${layer.level}:${layer.id}`;
}

export function switchKey(courseId: string, level: LayerLevel): string {
  return `${courseId}/${level}`;
}

/** The ID an operation takes as a change. */
export function opId(layer: Pick<PlanLayer, 'level' | 'id'>, index: number): string {
  return `${layer.level === 'district' ? 'd' : 's'}.${layer.id}.${index + 1}`;
}

/** A layer's operations as changes of a course, in the layer's order. */
export function layerChanges(layer: PlanLayer, courseId: string): PlanChange[] {
  return layer.operations.map((op, index): PlanChange => ({ ...op, id: opId(layer, index), courseId, seq: index + 1 }));
}

type LayerState = Pick<State, 'courses' | 'layers' | 'layerSwitches'>;

/** A course's layers: none for a class without a pack. */
export function courseLayers(state: LayerState, courseId: string): CourseLayers {
  const pack = state.courses.get(courseId)?.pack?.id;
  if (pack === undefined) return NO_LAYERS;
  const known = state.layers.flatMap(({ layer }) => (layer.pack === pack ? [layer] : []));
  const on = LAYER_LEVELS.flatMap((level) => {
    const key = inherited(state, courseId, (id) => state.layerSwitches.get(switchKey(id, level)))?.layer;
    return known.filter((layer) => layer.level === level && layerKey(layer) === key);
  });
  return { on, known };
}

/**
 * Whether a layer can be taken in: 'held' when the teacher has it as it
 * is, 'clash' when another layer has its ID, which an unverified copy can
 * do, and 'new' otherwise.
 */
export function layerAddStatus(state: LayerState, layer: PlanLayer): 'new' | 'held' | 'clash' {
  const same = state.layers.find((one) => layerKey(one.layer) === layerKey(layer));
  if (same === undefined) return 'new';
  return canonicalJson(same.layer) === canonicalJson(layer) ? 'held' : 'clash';
}

/** Whether a layer comes as its level does: a district layer with its signed file, a school layer without. */
export function signedAsItsLevel(added: AddedLayer): boolean {
  return (added.layer.level === 'district') === (added.signed !== undefined);
}

/** The record of taking a layer in; refused for one the teacher already has, or a district layer without its file. */
export function addLayer(state: LayerState, added: AddedLayer): RecordEvent {
  const key = layerKey(added.layer);
  if (state.layers.some(({ layer }) => layerKey(layer) === key)) throw new RangeError('This layer is already taken in');
  if (!signedAsItsLevel(added)) throw new RangeError('A district layer comes signed, a school layer unsigned');
  return { kind: 'layer.added', added };
}

/** The record of switching a class's layer at one level: on for a layer of its pack, or off with null. */
export function switchLayer(state: LayerState, courseId: string, level: LayerLevel, key: string | null): RecordEvent {
  const pack = state.courses.get(courseId)?.pack?.id;
  if (pack === undefined) throw new RangeError('A class without a pack has no plan to layer');
  const fits = state.layers.some(
    ({ layer }) => layerKey(layer) === key && layer.level === level && layer.pack === pack,
  );
  if (key !== null && !fits) throw new RangeError("This layer is not one of the class's pack at this level");
  return { kind: 'layer.switched', switched: { courseId, level, layer: key } };
}
