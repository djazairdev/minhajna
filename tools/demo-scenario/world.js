// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo server as a scenario's devices meet it (#629), each as the app's
// world session does (apps/android/src/demo/world-session.ts): starting draws
// a new code, works out the world's pass and sealing key from it, makes the
// world's stand-in signing key for calendars and plan packs, seals it with the
// world's kind, and sends it with the world's date, the first term's end in
// the bundled calendar, and its announced days, each later term's end and each
// exam window's first day; an ID already taken draws a new code. Joining works
// out the same secrets from the code and opens the sealed keys. Only the
// starter token moves the date. An answer the app would not take throws, with
// the request and the status. The new world's days and its signer's holder
// copy the app's, which the app keeps beside its native modules; the tests
// keep the holder the same, and a change to how the app dates a world must be
// made here too.

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  makeWorldCode,
  openWorldKeys,
  parseCountryProfile,
  parseSchoolCalendar,
  sealWorldKeys,
  worldSecrets,
} from '@minhajna/core';
import { worldKit } from './kit.js';

const SIGNER = 'world-ministry';
export const HOLDER = {
  ar:
    '\u0627\u0644\u0648\u0632\u0627\u0631\u0629 \u0641\u064a ' +
    '\u0627\u0644\u0639\u0627\u0644\u0645 \u0627\u0644\u062a\u062c\u0631\u064a\u0628\u064a',
  fr: 'Le ministère du monde de démonstration',
  en: 'The demo world’s ministry',
};

const data = (name) => JSON.parse(readFileSync(new URL(`../../data/dz/${name}`, import.meta.url), 'utf8'));

/** A new world's date and announced days, from the bundled calendar, as the app works them out. */
export function worldDays() {
  const profile = parseCountryProfile(data('profile.json'));
  const calendar = profile.ok ? parseSchoolCalendar(data('calendar-2026-2027.json'), profile.value) : profile;
  if (!calendar.ok) throw new RangeError('The bundled calendar does not read');
  const [first, ...later] = calendar.value.year.terms;
  const exams = calendar.value.entries.filter((entry) => entry.effect === 'exam').map((entry) => entry.from);
  const days = [...later.map((term) => term.to), ...exams].filter((day) => day > first.to);
  return { date: first.to, announcedDays: [...new Set(days)].sort() };
}

/** One request to the demo server: its status, and its body when it is JSON. */
export async function call(server, method, path, { body, pass, starter } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (pass !== undefined) headers['x-world-pass'] = pass;
  if (starter !== undefined) headers.authorization = `Bearer ${starter}`;
  const answer = await globalThis.fetch(new URL(path, server), { method, headers, body: JSON.stringify(body) });
  const text = await answer.text();
  try {
    return { status: answer.status, body: JSON.parse(text) };
  } catch {
    return { status: answer.status, body: null };
  }
}

/** The error for an answer the app would not take. */
const refused = (what, answer) => new Error(`${what}: the demo server answered ${answer.status}`);

/** Starts a world of a kind: its code, ID, pass, date, starter token and signer's fingerprint. */
export async function startWorld(server, kind, days = worldDays()) {
  for (let tries = 0; tries < 3; tries += 1) {
    const code = makeWorldCode(worldKit.random);
    const secrets = await worldSecrets(code, worldKit.kdf, worldKit.mac);
    const pair = await worldKit.newPair();
    const trusted = [
      { id: SIGNER, holder: HOLDER, spki: pair.spki, fingerprint: pair.fingerprint, signs: ['calendar', 'packs'] },
    ];
    const keys = { world: secrets.world, kind, trusted, private: { [SIGNER]: pair.pkcs8 } };
    const sealed = await sealWorldKeys(keys, secrets, worldKit.cipher, worldKit);
    const body = { world: secrets.world, sealed, ...days, pass: secrets.pass };
    const answer = await call(server, 'POST', '/worlds', { body });
    if (answer.status === 409) continue;
    if (answer.status !== 201 || typeof answer.body?.starter !== 'string') throw refused('Starting a world', answer);
    const world = { code, world: secrets.world, pass: secrets.pass, kind, signer: pair.fingerprint };
    return { ...world, date: days.date, starter: answer.body.starter };
  }
  throw new Error('Starting a world: every code drawn was taken');
}

/** Joins the world a code names: its ID, pass, kind, date and signer's fingerprint, as the opened keys give them. */
export async function joinWorld(server, code) {
  const secrets = await worldSecrets(code, worldKit.kdf, worldKit.mac);
  const answer = await call(server, 'GET', `/worlds/${secrets.world}`, { pass: secrets.pass });
  if (answer.status !== 200 || typeof answer.body?.sealed !== 'string') throw refused('Joining a world', answer);
  const keys = await openWorldKeys(answer.body.sealed, secrets, worldKit.cipher);
  if (keys === null) throw new Error('Joining a world: its sealed keys do not open with its code');
  const signer = keys.trusted.find((key) => key.id === SIGNER)?.fingerprint;
  return { code, world: secrets.world, pass: secrets.pass, kind: keys.kind, date: answer.body.date, signer };
}

/** The world's date, as a joined device reads it. */
export async function dateOf(server, { world, pass }) {
  const answer = await call(server, 'GET', `/worlds/${world}/date`, { pass });
  if (answer.status !== 200 || typeof answer.body?.date !== 'string') throw refused('Reading the date', answer);
  return answer.body.date;
}

/** Asks to move the world's date, with the starter token when the device holds one: the status, and the new date. */
export async function moveDate(server, { world, pass, starter }) {
  const answer = await call(server, 'POST', `/worlds/${world}/date`, { pass, starter: starter ?? undefined });
  return { status: answer.status, date: answer.status === 200 ? answer.body?.date : null };
}
