// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario above the school, a cut from its figures to its publication
// (#631, answer 722), on the 4AM mock exam the directorates set: on the figures
// day there are no totals until the device that started the world sends the
// seeded schools' shares. Then the directorate and the Ministry read them, a
// small directorate hidden under the floors with the nation shown, and the
// figures the committee sees give the item half the classes reached. A vote for
// an item of no plan never goes. One seat's vote only proposes the item; a
// second adopts it, by majority, and shuts the third out. After the deadline,
// no vote goes even in another directorate's room, which adopted nothing, and
// during the exam no words: nothing is published. Once the exam's last day has
// passed, a seat that adopted the cut signs its words, one that did not cannot,
// and what is published names the item, its day, its seats, the share that had
// reached it and its words. The date then moves onto the day the Ministry's
// release announced. Every figure is the world's made-up term.

import { worldExams } from '@minhajna/core';
import { appModule } from './app.js';
import { NEW_DAY } from './national-publish.js';
import { refusal, schoolOf, see } from './school-join.js';

const { seededWorld } = await appModule('director/director-world.ts');
const { sendSeededShares } = await appModule('demo/seeded-shares.ts');
const { readMinistryTotals, readTotals } = await appModule('directorate/totals-read.ts');
const { gradeMarks, publishedExams } = await appModule('threshold/committee-figures.ts');
const { gradeShown, shareOf } = await appModule('threshold/exam-totals.ts');
const { castVote, committeeRooms, putWords, readCommittees } = await appModule('threshold/committee-session.ts');

const EXAM = 'mock';
const GRADE = '4am';
const SUBJECT = 'arabic';
const WORDS = 'Made-up words: the paper stopped at this item.';

/** The exam as the world's calendar gives it. */
function exam({ paper }) {
  const { year, entries } = paper.get('world calendar');
  const found = worldExams(year, entries).find((one) => one.id === EXAM);
  see(found?.setBy === 'directorate', `the ${EXAM} exam is set by ${found?.setBy}`);
  return found;
}

/** Whether what is published of the directorates' exams offers it on the world's date. */
function offered({ paper }, device) {
  const { year, entries } = paper.get('world calendar');
  return publishedExams(year, entries, 'directorate', device.date).some((one) => one.id === EXAM);
}

/** The directorate's committee of the exam for the grade and subject, as its page gives it. */
function committee(stage, device, scope = schoolOf(stage, device).directorateId) {
  const { reference } = stage;
  const schools = seededWorld(device.world, reference).schools.filter((one) => one.directorateId === scope);
  const rooms = committeeRooms({ world: device.world, scope }, exam(stage), GRADE, schools, reference.packs);
  const found = rooms.find((one) => one.subject === SUBJECT);
  see(found !== undefined, `the directorate has no committee for ${SUBJECT}`);
  return { ...found, scope };
}

const standing = async (stage, device, room) => {
  const [read] = await readCommittees(device.held, [room], stage.kit, stage.send);
  return read;
};

/** The directorate's figures of the exam's figures day, as the committee's page reads them. */
const figuresOf = (stage, device, scope) => readTotals(device.world, exam(stage).figuresDay, scope, stage.send);

async function noTotals(stage, device) {
  const { scope } = committee(stage, device);
  see((await figuresOf(stage, device, scope)) === null, 'totals show before any share came in');
}

async function sendShares(stage, device) {
  see(device.date === exam(stage).figuresDay, `the shares go on ${device.date}, not the figures day`);
  const put = await sendSeededShares(device.held, device.date, stage.reference, stage.kit, stage.send);
  see(put > 0, 'no share of a seeded school was sent');
}

async function seeTotals(stage, device) {
  const { reference, paper } = stage;
  const { scope, plan } = committee(stage, device);
  const figures = await figuresOf(stage, device, scope);
  see(figures?.all != null, 'the directorate’s totals are hidden or absent');
  const grade = gradeShown(figures, SUBJECT, GRADE);
  see(grade != null && grade.classes > 0, `the directorate reads no ${GRADE} classes of ${SUBJECT}`);
  const { half } = gradeMarks(
    grade,
    plan.items.map((one) => one.id),
  );
  see(half !== null, 'half the classes reached no item shown');
  paper.set('cut', half);
  const small = seededWorld(device.world, reference).directorates.at(-1).id;
  const hidden = await figuresOf(stage, device, small);
  see(hidden?.all === null, 'a directorate under the floors is shown');
}

async function seeNation(stage, device) {
  const figures = await readMinistryTotals(device.world, exam(stage).figuresDay, stage.send);
  const { directorates } = seededWorld(device.world, stage.reference);
  see(figures?.national?.all != null, 'the nation’s totals are hidden or absent');
  see(figures.directorates.length === directorates.length, `the Ministry reads ${figures.directorates.length}`);
  const hidden = figures.directorates.filter(([, one]) => one.all === null);
  const small = directorates.slice(-2).map((one) => one.id);
  see(
    JSON.stringify(hidden.map(([id]) => id).toSorted()) === JSON.stringify(small.toSorted()),
    `the directorates hidden are ${hidden.map(([id]) => id)}, not the two under the floors`,
  );
}

async function vote(stage, device, { seat, expect, elsewhere = false }) {
  const { kit, send, paper } = stage;
  const own = schoolOf(stage, device).directorateId;
  const { directorates } = seededWorld(device.world, stage.reference);
  const other = directorates.find((one) => one.id !== own).id;
  const { room } = committee(stage, device, elsewhere ? other : own);
  const casting = (item) => castVote(device.held, room, seat, item, device.date, kit, send);
  if (expect === 'closed') {
    const answered = await refusal(casting(paper.get('cut')));
    see(answered === 'E_CUT_CLOSED', `a late vote was answered ${answered}`);
    return;
  }
  const stray = await refusal(casting('made-up-item'));
  see(/item of the plan/.test(stray ?? ''), `a vote for an item of no plan was answered ${stray}`);
  await casting(paper.get('cut'));
  const { state } = await standing(stage, device, room);
  if (expect === 'proposed') {
    see(state.adopted === null && state.proposed?.item === paper.get('cut'), 'one vote did not only propose the cut');
    return;
  }
  see(state.adopted?.item === paper.get('cut'), 'a majority did not adopt the cut');
  see(state.adopted.day === device.date && state.adopted.seats.length === 2, 'the adoption reads wrongly');
}

async function seeUnpublished(stage, device) {
  const { kit, send } = stage;
  const { room } = committee(stage, device);
  see(!offered(stage, device), 'the exam is published before its last day has passed');
  const early = await refusal(putWords(device.held, room, 0, WORDS, device.date, kit, send));
  see(early === 'E_CUT_CLOSED', `words during the exam were answered ${early}`);
}

async function signWords(stage, device, { seat }) {
  const { kit, send } = stage;
  const { room } = committee(stage, device);
  see(offered(stage, device), 'the exam is not published with its last day past');
  const beyond = await refusal(putWords(device.held, room, 2, WORDS, device.date, kit, send));
  see(beyond === 'E_CUT_CLOSED', `a seat that did not adopt the cut was answered ${beyond}`);
  await putWords(device.held, room, seat, WORDS, device.date, kit, send);
}

async function seePublished(stage, device) {
  const { paper } = stage;
  const { room, scope } = committee(stage, device);
  const { state, words } = await standing(stage, device, room);
  const { adopted } = state;
  see(adopted?.item === paper.get('cut'), 'what is published names another cut');
  see(adopted.day === exam(stage).figuresDay, `what is published says it was adopted on ${adopted.day}`);
  see(JSON.stringify(adopted.seats.toSorted()) === '[0,1]', `what is published holds seats ${adopted.seats}`);
  see(words?.words === WORDS, `what is published holds the words ${words?.words}`);
  const grade = gradeShown(await figuresOf(stage, device, scope), SUBJECT, GRADE);
  const share = shareOf(grade, adopted.item);
  see(share !== null && share >= 50, `what is published says ${share} percent had reached the cut`);
}

async function seeNewDay(_stage, device) {
  see(device.date === NEW_DAY, `the date moved to ${device.date}, not the day the release announced`);
}

export const CUT_ACTIONS = {
  noTotals,
  sendShares,
  seeTotals,
  seeNation,
  vote,
  seeUnpublished,
  signWords,
  seePublished,
  seeNewDay,
};

const MOVE = { as: 'ministry', do: 'move', expect: 'moved' };

export const CUT_STEPS = [
  { as: 'directorate', do: 'noTotals' },
  MOVE,
  MOVE,
  MOVE,
  MOVE,
  { as: 'directorate', do: 'see', day: 4 },
  { as: 'directorate', do: 'noTotals' },
  { as: 'ministry', do: 'sendShares' },
  { as: 'directorate', do: 'seeTotals' },
  { as: 'ministry', do: 'seeNation' },
  { as: 'directorate', do: 'vote', seat: 0, expect: 'proposed' },
  { as: 'directorate', do: 'vote', seat: 1, expect: 'adopted' },
  { as: 'directorate', do: 'vote', seat: 2, expect: 'closed' },
  MOVE,
  { as: 'directorate', do: 'see', day: 5 },
  { as: 'directorate', do: 'vote', seat: 0, expect: 'closed', elsewhere: true },
  { as: 'directorate', do: 'seeUnpublished' },
  MOVE,
  { as: 'directorate', do: 'see', day: 6 },
  { as: 'directorate', do: 'signWords', seat: 0 },
  { as: 'directorate', do: 'seePublished' },
  MOVE,
  { as: 'directorate', do: 'seeNewDay' },
];
