// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario above the school, what the Ministry publishes (#631, answer
// 722): the Ministry publishes the calendar with a made-up closure and a
// made-up exam day, as its calendar page does, and the same draft again changes
// nothing; the directorate reads the release laid over the bundled calendar,
// and the server announces the new day. The device that started the world makes
// the pack-editor accounts, a curator's device signs in with the token it
// shows, drafts the next release of the pack a teacher's class starts on, which
// passes the page's checks, and cannot publish it with no approval or with one,
// nor by claiming the Ministry. The Ministry's account publishes it as
// Official, and another device reads it so; national-plans.js takes it to the
// teacher.

import { appModule } from './app.js';
import { classOf, refusal, see } from './school-join.js';

const { publishCalendar } = await appModule('ministry/calendar-publish.ts');
const { readWorldCalendar } = await appModule('demo/world-calendar-read.ts');
const { makePackAccount, signInPackAccount } = await appModule('editor/pack-account.ts');
const { changePackRelease, readPackReleases } = await appModule('editor/pack-release-session.ts');
const { releaseHistory, reviewRelease } = await appModule('editor/release-checks.ts');

const CLOSURE = {
  id: 'made-up-national-closure',
  layer: 'national',
  from: '2027-05-03',
  to: '2027-05-03',
  effect: 'closure',
  name: { ar: 'Made-up closure', en: 'Made-up closure', fr: 'Made-up closure' },
  source: 'Made-up calendar',
  confidence: 'announced',
};

/** The title the release gives its first lesson. */
export const RETITLED = 'Made-up new title';

/** A made-up exam day the bundled calendar does not announce, which a release makes one. */
export const NEW_DAY = '2027-05-02';

const EXAM_DAY = { ...CLOSURE, id: 'made-up-exam-day', from: NEW_DAY, to: NEW_DAY, effect: 'exam' };

/** The next release of the pack a teacher's 4AM class starts on, each item naming its source's page, one retitled. */
function packOf(stage, device) {
  const pin = classOf(stage, device, 'a').packs.arabic;
  const pack = stage.reference.packs.find((one) => one.id === pin.id && one.release === pin.release);
  const lesson = pack.items.findIndex((one) => one.kind === 'lesson');
  return {
    ...pack,
    release: `${pin.release.split('.')[0]}.${Number(pin.release.split('.')[1]) + 1}`,
    status: 'community',
    provenance: { issuer: 'Made-up issuer', edition: 'Made-up edition' },
    migration: { from: pin.release, entries: [] },
    items: pack.items.map((one, at) => ({
      ...one,
      sourcePage: 1,
      ...(at === lesson ? { title: RETITLED } : {}),
    })),
  };
}

const editorOf = (stage, device, accounts) => ({
  world: { world: device.world, kind: 'national', date: device.date },
  held: device.held,
  profile: stage.reference.profile,
  kit: stage.kit,
  accounts,
});

async function publishTheCalendar(stage, device) {
  const { reference, kit, send } = stage;
  const draft = { entries: [CLOSURE, EXAM_DAY], removed: [] };
  const publishing = { held: device.held, date: device.date, reference, draft, kit };
  const first = await publishCalendar(publishing, send);
  const again = await publishCalendar(publishing, send);
  see(first.release === again.release, 'the same draft made another release');
  stage.paper.set('calendar', first.release);
}

async function seeCalendar(stage, device) {
  const { reference, kit, send, paper } = stage;
  const { calendar, updates } = await readWorldCalendar(device.held, reference, kit, send);
  see(calendar.release === paper.get('calendar'), `the world reads release ${calendar.release}`);
  see(
    calendar.entries.some((one) => one.id === CLOSURE.id),
    'the closure did not reach the directorate',
  );
  see(updates.length === 2, `the world holds ${updates.length} releases, the seeded one and this`);
  paper.set('world calendar', calendar);
  const { body } = await send({ method: 'GET', path: `/worlds/${device.world}/date` });
  see(body.announcedDays.includes(NEW_DAY), 'the server does not announce the release’s new day');
}

async function makeAccounts(stage, device) {
  const { send, paper } = stage;
  const accounts = {
    curator: await makePackAccount(device.world, device.starter, 'curator', send),
    ministry: await makePackAccount(device.world, device.starter, 'ministry', send),
  };
  paper.set('accounts', accounts);
}

async function signIn(stage, device) {
  const { send, paper } = stage;
  const { curator } = paper.get('accounts');
  const role = await signInPackAccount(device.world, curator, send);
  see(role === 'curator', `the curator’s token signs in as ${role}`);
}

const reviewing = (role, name) => ({ stage: 'under-review', review: { role, verdict: 'approved', name, note: '' } });

async function draftPack(stage, device) {
  const { send, paper } = stage;
  const editor = editorOf(stage, device, { curator: paper.get('accounts').curator });
  const pack = packOf(stage, device);
  const target = (current) => ({ id: pack.id, release: pack.release, revision: current?.revision ?? 0 });
  const take = (current, change) => changePackRelease(editor, 'curator', target(current), change, send);
  let release = await take(null, { stage: 'draft', pack });
  release = await take(release, { stage: 'under-review' });
  const records = await readPackReleases(editor, send);
  const history = releaseHistory(pack, stage.reference.packs, records, false);
  const figures = { main: '', td: '', minutes: '', source: '' };
  const weeks = String(Math.max(0, ...pack.items.map((one) => one.week ?? 0)) || '');
  const { blockers, lines } = reviewRelease(pack, history, stage.reference, weeks, figures);
  const held = lines.filter((one) => one.state !== 'pass').map((one) => `${one.id}: ${one.state}`);
  see(blockers === 0, `the page's checks hold ${blockers} blockers: ${held}`);
  const early = async () => refusal(take(release, { stage: 'published' }));
  see((await early()) === 'E_PACK_REVIEW', 'a release with no approval was published');
  release = await take(release, reviewing('curator', 'Made-up Curator'));
  see((await early()) === 'E_PACK_REVIEW', 'a release with one approval was published');
  release = await take(release, reviewing('maintainer', 'Made-up Maintainer'));
  const claimed = { ...editor, accounts: { ministry: paper.get('accounts').curator } };
  const change = { stage: 'published' };
  const refused = await refusal(changePackRelease(claimed, 'ministry', target(release), change, send));
  see(refused === 'E_PACK_ROLE', `a curator claiming the Ministry was answered ${refused}`);
  paper.set('release', release);
}

async function publishPack(stage, device) {
  const { send, paper } = stage;
  const release = paper.get('release');
  const editor = editorOf(stage, device, { ministry: paper.get('accounts').ministry });
  const { id, release: name } = release.pack;
  const target = { id, release: name, revision: release.revision };
  const published = await changePackRelease(editor, 'ministry', target, { stage: 'published' }, send);
  see(published.stage === 'published' && published.pack.status === 'official', 'the pack is not published as Official');
  paper.set('release', published);
}

async function seePack(stage, device) {
  const { send, paper } = stage;
  const records = await readPackReleases(editorOf(stage, device), send);
  const { pack, revision } = paper.get('release');
  const found = [...records.values()].find((one) => one.pack.id === pack.id && one.pack.release === pack.release);
  see(found?.stage === 'published' && found.revision === revision, 'another device does not read the pack published');
  see(found.pack.status === 'official', `another device reads it as ${found.pack.status}`);
}

export const PUBLISH_ACTIONS = {
  publishCalendar: publishTheCalendar,
  seeCalendar,
  makeAccounts,
  signIn,
  draftPack,
  publishPack,
  seePack,
};

export const PUBLISH_STEPS = [
  { as: 'ministry', do: 'publishCalendar' },
  { as: 'directorate', do: 'seeCalendar' },
  { as: 'ministry', do: 'makeAccounts' },
  { as: 'curator', do: 'signIn' },
  { as: 'curator', do: 'draftPack' },
  { as: 'ministry', do: 'publishPack' },
  { as: 'directorate', do: 'seePack' },
];
