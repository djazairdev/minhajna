// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's records and their history, together: every change is an
// event added to the history, and the state is rebuilt from it. Erasing a
// pupil's data writes its fact first, then restates the class's records
// without them and erases the rest, so an erasure the app could not finish
// is finished when the history opens again (answer 473).

import type { Day } from './day.ts';
import { HistoryLog, type Entry, type HistoryDeps, type HistoryStore } from './history.ts';
import { eventOf, layerOf, type RecordEvent } from './events.ts';
import { departed, departureDay, pupilEntries, withoutPupil } from './pupil-erase.ts';
import { recordKey } from './record-keys.ts';
import { restatements, sharedKey } from './restated.ts';
import { buildState, type State } from './state.ts';

/**
 * The teacher's records and their history. Every change is stored before
 * the promise resolves, so nothing is lost (PRD §6.8).
 */
export class RecordBook {
  readonly #log: HistoryLog;
  #state: State;

  private constructor(log: HistoryLog) {
    this.#log = log;
    this.#state = buildState(log.entries);
  }

  /**
   * Opens a stored history, but only one that verifies (`HistoryLog.open`), and finishes any pupil's erasure the
   * app stopped in. One that cannot finish leaves the records as they are, never the history unopened.
   */
  static async open(store: HistoryStore, deps: HistoryDeps): Promise<RecordBook> {
    const book = new RecordBook(await HistoryLog.open(store, deps));
    for (const entry of [...book.#log.entries]) {
      if (eventOf(entry)?.kind === 'pupil.erased') await book.#finish(entry).catch(() => undefined);
    }
    return book;
  }

  get state(): State {
    return this.#state;
  }

  get entries(): readonly Entry[] {
    return this.#log.entries;
  }

  /**
   * Records one event and rebuilds the state. Rebuilding from the whole
   * history keeps one path from history to screen. A year's history is a few
   * thousand entries, which rebuild in milliseconds.
   */
  async record(day: Day, event: RecordEvent): Promise<Entry> {
    const entry = await this.#log.append(day, layerOf(event), event.kind, event);
    this.#state = buildState(this.#log.entries);
    return entry;
  }

  async recordAll(day: Day, events: readonly RecordEvent[]): Promise<Entry[]> {
    const entries: Entry[] = [];
    for (const event of events) entries.push(await this.record(day, event));
    return entries;
  }

  /**
   * Erases whole records: the entries must hold every version of each record
   * they touch, such as a session's record and its corrections, a roll call
   * and its corrections, or a pupil and their movements. Erasing one version
   * alone would bring the one before it back (PRD §5.5). An entry a
   * restatement replaced counts no more, so it may go alone.
   */
  async erase(day: Day, ids: readonly string[]): Promise<Entry> {
    const named = new Set(ids);
    const { replaced } = restatements(this.#log.entries);
    const touched = new Set<string>();
    for (const id of named) {
      const entry = this.#log.entries.find((candidate) => candidate.id === id);
      const event = entry === undefined ? null : eventOf(entry);
      if (event === null) throw new RangeError('An erasure names an entry that holds no record');
      if (!replaced.has(id)) touched.add(recordKey(event));
    }
    for (const entry of this.#log.entries) {
      const event = replaced.has(entry.id) ? null : eventOf(entry);
      if (event !== null && !named.has(entry.id) && touched.has(recordKey(event))) {
        throw new RangeError('An erasure must cover every version of each record it touches');
      }
    }
    const erasure = await this.#log.erase(day, [...named]);
    this.#state = buildState(this.#log.entries);
    return erasure;
  }

  /**
   * Erases the data of a pupil whose departure the director confirmed (R-5.5-13, answer 473). Returns the fact the
   * history keeps: the class and the entries erased. Tried again after a failure, it finishes the fact already
   * written rather than writing another.
   */
  async erasePupil(day: Day, pupilId: string): Promise<Entry> {
    const pupil = this.#state.pupils.get(pupilId);
    if (pupil === undefined) throw new RangeError('Unknown pupil');
    if (!departed(pupil, day))
      throw new RangeError('Only the data of a pupil who left, the departure confirmed, is erased');
    const own = this.#log.entries.find((entry) => {
      const event = eventOf(entry);
      return event?.kind === 'pupil.set' && event.pupil.id === pupilId;
    });
    const started = this.#log.entries.find((entry) => {
      const event = eventOf(entry);
      return event?.kind === 'pupil.erased' && own !== undefined && event.erased.entries.includes(own.id);
    });
    if (started !== undefined) {
      await this.#finish(started);
      return started;
    }
    const entries = pupilEntries(this.#log.entries, restatements(this.#log.entries), pupilId);
    const erased = { classId: pupil.classId, entries, left: departureDay(pupil) ?? day };
    const fact = await this.record(day, { kind: 'pupil.erased', erased });
    await this.#finish(fact);
    return fact;
  }

  /**
   * Finishes an erasure from its fact, on the fact's day: restates each shared version not restated yet, while the
   * pupil's own entry still names them, then erases what is left, the private layer first and the pupil's own
   * layer last. What was recorded about the pupil after the fact goes too. A shared version that could not be
   * restated is never erased.
   */
  async #finish(fact: Entry): Promise<void> {
    const event = eventOf(fact);
    if (event?.kind !== 'pupil.erased') return;
    const listed = new Set(event.erased.entries);
    const own = this.#log.entries
      .filter((entry) => listed.has(entry.id) && entry.seq < fact.seq)
      .map(eventOf)
      .find((one) => one?.kind === 'pupil.set');
    const now = new Set(
      own?.kind === 'pupil.set' ? pupilEntries(this.#log.entries, restatements(this.#log.entries), own.pupil.id) : [],
    );
    const held = () =>
      this.#log.entries.filter(
        (entry) => entry.content !== null && ((listed.has(entry.id) && entry.seq < fact.seq) || now.has(entry.id)),
      );
    if (own?.kind === 'pupil.set') {
      const restated = restatements(this.#log.entries);
      for (const entry of held()) {
        const before = restated.replaced.has(entry.id) ? null : eventOf(entry);
        const after = before && withoutPupil(before, own.pupil.id, (restated.of.get(entry.id) ?? entry).id);
        if (after) await this.#log.append(fact.day, layerOf(after), after.kind, after);
      }
      this.#state = buildState(this.#log.entries);
    }
    const { replaced } = restatements(this.#log.entries);
    const left = held().filter((entry) => {
      const one = eventOf(entry);
      return one !== null && (sharedKey(one) === null || replaced.has(entry.id));
    });
    const layers = [...new Set(left.map((entry) => entry.layer))].sort(
      (a, b) => Number(a === 'pupil-records') - Number(b === 'pupil-records'),
    );
    for (const layer of layers) {
      await this.erase(
        fact.day,
        left.filter((entry) => entry.layer === layer).map((entry) => entry.id),
      );
    }
  }
}
