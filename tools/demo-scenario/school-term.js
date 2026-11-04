// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario at the school, the term's export (#630, answer 722): a teacher
// sends each course's term marks to the state's stand-in as Term-send does, the
// term the one holding the world's date, the marks those the world makes up.
// The stand-in answers a receipt naming no pupil, for as many rows as the class
// has pupils, signed by the key the teacher joined with, and answers the same
// export again as having come before. A mark taken out afterwards no longer
// matches the export and is refused before anything is sent.

import { appModule } from './app.js';
import { refusal, schoolOf, see } from './school-join.js';

const { appreciationList } = await appModule('marks/appreciation-rules.ts');
const { assessmentData } = await appModule('marks/marks-rules.ts');
const { courseReceipt, sendingTerm, sendTermMarks, termCourses, termMatches, termSheet } =
  await appModule('school/term-send-session.ts');
const { standInReceipts } = await appModule('school/state-standin.ts');
const { readSignChannel } = await appModule('week/week-sign-session.ts');

const RECEIPT = JSON.stringify(
  ['class', 'id', 'kind', 'received', 'rows', 'signed', 'signer', 'standIn', 'subject', 'term'].toSorted(),
);

async function sendTerm(stage, device) {
  const { kit, send, reference } = stage;
  const { profile, calendar } = reference;
  const school = schoolOf(stage, device);
  const { parts } = await readSignChannel(device, device.join, kit, send);
  const courses = termCourses(parts, device.date, profile.subjects);
  const term = sendingTerm(calendar.year, device.date);
  see(courses.length > 0 && term !== null, `no course to send on ${device.date}`);
  const data = { assessment: assessmentData(profile), list: appreciationList(profile) };
  for (const course of courses) {
    const sheet = termSheet(device.world, school, course, term.number, device.date, data);
    see(sheet.kind === 'marks', `${course.class} has no marks: ${sheet.kind}`);
    const { matched, total } = termMatches(sheet.head, sheet.marks);
    see(total > 0 && matched === total, `the export gives back ${matched} of ${total} rows`);
    const { receipt, again } = await sendTermMarks(device, device.join, sheet.head, sheet.marks, kit, send);
    see(!again && receipt.standIn && receipt.rows === sheet.room.pupils.length, 'the receipt does not match the class');
    see(JSON.stringify(Object.keys(receipt).toSorted()) === RECEIPT, `the receipt holds ${Object.keys(receipt)}`);
    const names = sheet.room.pupils.flatMap((one) => [one.name, one.latinName]).filter(Boolean);
    see(names.length > 0 && !names.some((name) => JSON.stringify(receipt).includes(name)), 'the receipt names a pupil');
    const repeated = await sendTermMarks(device, device.join, sheet.head, sheet.marks, kit, send);
    see(repeated.again && repeated.receipt.id === receipt.id, 'the same export does not read as sent before');
    const kept = courseReceipt(await standInReceipts(device.world, send), device.join, sheet.head);
    see(kept?.id === receipt.id, 'the world’s receipts do not hold it');
    const [first] = sheet.marks.rows;
    const short = { ...sheet.marks, rows: [{ ...first, values: {} }, ...sheet.marks.rows.slice(1)] };
    let asked = 0;
    const counting = (request) => {
      asked += 1;
      return send(request);
    };
    const refused = await refusal(sendTermMarks(device, device.join, sheet.head, short, kit, counting));
    see(refused === 'E_TERM_MISMATCH', `a mark taken out was answered ${refused}`);
    see(asked === 0, 'the mark taken out was sent');
  }
}

export const TERM_ACTIONS = { sendTerm };

export const TERM_STEPS = [{ as: 'teacher', who: 'a', do: 'sendTerm' }];
