// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world's calendar in a demo world (#608, answer 624), over the made-up
// calendar of reference-fixtures.ts: a draft becomes the release after the
// latest, a release that does not read refused, signed with the world's key as
// a file naming the world, of at most the bytes a signed update may weigh; the
// files travel sealed on the world's calendar stream and open with its secret
// only, the heaviest file of Arabic names sealed whole and a file missing a
// batch dropped; an update counts when its file opens with a world key that
// signs calendars and names this world, reads against the country and year, and
// is after the bundled release, the first for each release counting, which its
// publisher can tell; the updates lie over the bundled calendar in the order of
// their releases, and a draft made over them publishes as the next; the
// announced days are the later terms' ends and each exam window's first day, in
// any layer, after the date; and a file naming a world or signed with a world's
// key is told apart. Every key and entry is made up.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  announcedDaysOf,
  draftUpdate,
  DRAFT_NAME_MOST,
  EMPTY_DRAFT,
  namesWorld,
  nextRelease,
  sealWorldCalendar,
  setDraftEntry,
  SIGNED_BYTES,
  takeOutDraftEntry,
  worldCalendar,
  worldCalendarFile,
  worldCalendarFiles,
  worldCalendarPlace,
  worldCalendarUpdates,
  worldSignedFile,
  updateCounts,
  updatePayload,
  WORLD_CALENDAR_BATCHES,
  type CalendarEntry,
  type CalendarUpdate,
  type WorldSigner,
} from '../src/index.ts';
import { d } from './fixtures.ts';
import { reference } from './reference-fixtures.ts';
import { makeTestKey, nodeVerifier, signedFile } from './signed-fixtures.ts';
import { cipher, mac } from './world-crypto.ts';
import { signWith, worldKeys } from './world-signing.ts';

const base = reference.calendar;
const { country: profile, year } = reference;
const exams = base.find((one) => one.id === 'exams-1')!;
const moved: CalendarEntry = { ...exams, from: d('2026-12-13'), to: d('2026-12-17') };
const keys = worldKeys('WRLDA');
const world = { world: keys.world, trusted: keys.trusted };
const calendar = { release: '2026.1', year };
const sign = (update: CalendarUpdate, signed = keys) => worldCalendarFile(signed, 'world-ministry', update, signWith);
const moving = draftUpdate(
  setDraftEntry(base, EMPTY_DRAFT, moved, 'A made-up reason'),
  profile,
  year,
  '2026.1',
  d('2026-11-20'),
);
const fixed: WorldSigner = () => Promise.resolve('A'.repeat(96));
const added: CalendarEntry = {
  id: 'world-0011223344556677',
  layer: 'national',
  from: d('2027-03-01'),
  to: d('2027-03-02'),
  effect: 'marker',
  name: { ar: 'يوم دراسي' },
  source: 'A made-up notice',
  confidence: 'expected',
};
const removing = draftUpdate(takeOutDraftEntry(base, EMPTY_DRAFT, 'storm'), profile, year, '2026.2', d('2026-11-21'));

describe('the world’s calendar update', () => {
  it('is the release after the latest, published on the world’s date', () => {
    assert.deepEqual([nextRelease('2026.3'), nextRelease('2026.9')], ['2026.4', '2026.10']);
    for (const odd of ['2027', '2026.x', '']) assert.throws(() => nextRelease(odd), RangeError);
    assert.deepEqual(moving, {
      country: 'dz',
      year: year.id,
      release: '2026.2',
      published: d('2026-11-20'),
      entries: [{ ...moved, moved: { from: exams.from, to: exams.to, reason: 'A made-up reason' } }],
      removed: [],
    });
    assert.deepEqual([removing.release, removing.removed], ['2026.3', ['storm']]);
  });

  it('is signed as a file naming the world, and refused when heavier than a signed update may be', async () => {
    const file = await sign(moving);
    assert.equal((JSON.parse(file) as { world: string }).world, 'WRLDA');
    assert.deepEqual(await worldCalendarUpdates([file], world, nodeVerifier, calendar, profile), [moving]);
    const padded = (length: number) => ({ ...moving, entries: [{ ...moved, source: 'x'.repeat(length) }] });
    const sized = async (length: number) =>
      Buffer.byteLength(await worldSignedFile(keys, 'world-ministry', updatePayload(padded(length)), fixed));
    const most = 10 + SIGNED_BYTES - (await sized(10));
    assert.equal(await sized(most), SIGNED_BYTES);
    const signFixed = (length: number) => worldCalendarFile(keys, 'world-ministry', padded(length), fixed);
    assert.equal(Buffer.byteLength(await signFixed(most)), SIGNED_BYTES);
    await assert.rejects(signFixed(most + 1), RangeError);
  });

  it('travels sealed on the world’s calendar stream, which opens with its secret only', async () => {
    const sealing = new Uint8Array(randomBytes(32));
    const place = await worldCalendarPlace(sealing, mac);
    assert.deepEqual(await worldCalendarPlace(sealing, mac), place);
    const files = [await sign(moving), await sign(removing)];
    const first = await sealWorldCalendar(place, files[0]!, 0, cipher);
    const batches = [...first, ...(await sealWorldCalendar(place, files[1]!, first.length, cipher))];
    assert.deepEqual(await worldCalendarFiles(place, batches, cipher), files);
    const elsewhere = await worldCalendarPlace(new Uint8Array(randomBytes(32)), mac);
    assert.notEqual(elsewhere.stream, place.stream);
    assert.deepEqual(await worldCalendarFiles(elsewhere, batches, cipher).catch(() => []), []);
  });

  it('seals the heaviest file of Arabic names whole, and drops a file missing a batch', async () => {
    const place = await worldCalendarPlace(new Uint8Array(randomBytes(32)), mac);
    const named = (count: number) => ({
      ...moving,
      entries: Array.from({ length: count }, (_, at) => ({
        ...added,
        id: `world-${String(at).padStart(16, '0')}`,
        name: { ar: 'عطلة مختلقة '.repeat(10).slice(0, DRAFT_NAME_MOST) },
      })),
    });
    let count = 1;
    while (
      Buffer.byteLength(await worldSignedFile(keys, 'world-ministry', updatePayload(named(count + 1)), fixed)) <=
      SIGNED_BYTES
    )
      count += 1;
    const heavy = await worldCalendarFile(keys, 'world-ministry', named(count), fixed);
    assert.ok(Buffer.byteLength(heavy) > SIGNED_BYTES - 400);
    const sealed = await sealWorldCalendar(place, heavy, 0, cipher);
    assert.ok(sealed.length > 1 && sealed.length <= WORLD_CALENDAR_BATCHES);
    const after = await sign(removing);
    const next = await sealWorldCalendar(place, after, sealed.length, cipher);
    assert.deepEqual(await worldCalendarFiles(place, [...sealed, ...next], cipher), [heavy, after]);
    const gap = sealed.filter((batch) => batch.number !== 1);
    assert.deepEqual(await worldCalendarFiles(place, [...gap, ...next], cipher), [after]);
  });
});

describe('the world’s calendar as devices read it', () => {
  it('keeps the updates its calendar key signs after the bundled release, the first for each', async () => {
    const other = worldKeys('WRLDB');
    const packsOnly = { ...world, trusted: world.trusted.map((key) => ({ ...key, signs: ['packs' as const] })) };
    const again = { ...moving, entries: [{ ...moved, source: 'Another made-up notice' }] };
    const files = [
      'not a file',
      await sign(removing),
      await sign({ ...moving, release: '2026.1' }),
      await sign(moving, other),
      signedFile(makeTestKey(), JSON.parse(updatePayload(moving)) as unknown),
      await sign({ ...moving, year: '2027-2028' }),
      await sign(moving),
      await sign(again),
    ];
    const updates = await worldCalendarUpdates(files, world, nodeVerifier, calendar, profile);
    assert.deepEqual(updates, [moving, removing]);
    assert.deepEqual(
      [moving, again, { ...moving, release: '2026.4' }].map((one) => updateCounts(updates, one)),
      [true, false, false],
    );
    assert.deepEqual(await worldCalendarUpdates(files, packsOnly, nodeVerifier, calendar, profile), []);
  });

  it('lays the updates over the bundled calendar in the order of their releases', () => {
    const late = { ...removing, release: '2026.1' };
    const laid = worldCalendar(base, '2026.1', [removing, late, moving]);
    assert.equal(laid.release, '2026.3');
    assert.equal(
      laid.entries.some((one) => one.id === 'storm'),
      false,
    );
    assert.deepEqual(laid.entries.find((one) => one.id === exams.id)?.from, d('2026-12-13'));
    assert.deepEqual(worldCalendar(base, '2026.1', []), { entries: [...base], release: '2026.1' });
  });

  it('publishes a draft made over the world’s calendar as the release after its latest', async () => {
    const laid = worldCalendar(base, '2026.1', [moving]);
    const kept = laid.entries.find((one) => one.id === exams.id)!;
    const draft = setDraftEntry(laid.entries, EMPTY_DRAFT, { ...kept, source: 'A later made-up notice' });
    const later = draftUpdate(draft, profile, year, laid.release, d('2026-12-06'));
    assert.equal(later.release, '2026.3');
    const files = [await sign(moving), await sign(later)];
    const updates = await worldCalendarUpdates(files, world, nodeVerifier, calendar, profile);
    assert.deepEqual(updates, [moving, later]);
    const now = worldCalendar(base, '2026.1', updates).entries.find((one) => one.id === exams.id);
    assert.deepEqual([now?.from, now?.source], [d('2026-12-13'), 'A later made-up notice']);
  });

  it('announces the later terms’ ends and each exam window’s first day, in any layer, after the date', () => {
    const zone = { ...exams, id: 'zone-exams', layer: 'zone' as const, zone: '16', from: d('2027-02-01') };
    const entries = [...base, { ...zone, to: d('2027-02-03') }];
    assert.deepEqual(announcedDaysOf(year, entries, d('2026-12-01')), [
      d('2026-12-06'),
      d('2027-02-01'),
      d('2027-03-18'),
      d('2027-06-10'),
    ]);
    assert.deepEqual(announcedDaysOf(year, entries, d('2026-12-06')), [
      d('2027-02-01'),
      d('2027-03-18'),
      d('2027-06-10'),
    ]);
    const laid = worldCalendar(base, '2026.1', [moving]).entries;
    assert.deepEqual(announcedDaysOf(year, laid, d('2026-12-06'))[0], d('2026-12-13'));
  });

  it('tells apart a file that names a world or is signed with a world’s key', async () => {
    const plain = signedFile(makeTestKey(), { made: 'up' });
    const worldKeyed = JSON.stringify({ ...(JSON.parse(plain) as object), key: 'world-ministry' });
    assert.deepEqual([await sign(moving), worldKeyed, plain, 'null', '5', 'not a file'].map(namesWorld), [
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});
