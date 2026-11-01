// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which record each event sets: events with the same key are versions of one
// record, and an erasure takes every version of a record at once.

import type { RecordEvent } from './events.ts';
import { captureKey } from './captures.ts';
import { markKey } from './marks.ts';
import { observationKey } from './observations.ts';
import { appreciationKey } from './appreciations.ts';
import { kindOf, listKey } from './support-queue.ts';
import { layerKey, switchKey } from './variant-layers.ts';

/**
 * Which record an event sets. Events with the same key are versions of one
 * record. A pupil's movements are part of the pupil's record.
 */
export function recordKey(event: RecordEvent): string {
  switch (event.kind) {
    case 'teacher.set':
      return 'teacher';
    case 'teacher.personal.set':
      return 'teacher:personal';
    case 'school.set':
      return `school:${event.school.id}`;
    case 'class.set':
      return `class:${event.schoolClass.id}`;
    case 'pupil.set':
      return `pupil:${event.pupil.id}`;
    case 'pupil.moved':
      return `pupil:${event.pupilId}`;
    case 'course.set':
      return `course:${event.course.id}`;
    case 'course.moved':
      return `course:${event.move.courseId}`;
    case 'timetable.set':
      return `timetable:${event.version.id}`;
    case 'calendar.set':
      return `calendar:${event.entry.id}`;
    case 'calendar.removed':
      return `calendar:${event.id}`;
    case 'calendar.updated':
      return `calendar-update:${event.applied.update.release}`;
    case 'pack.added':
      return `pack:${event.added.update.pack.id}@${event.added.update.pack.release}`;
    case 'layer.added':
      return `layer:${layerKey(event.added.layer)}`;
    case 'layer.switched':
      return `layer-switch:${switchKey(event.switched.courseId, event.switched.level)}`;
    case 'list.set':
      return `list:${event.list.courseId}`;
    case 'session.recorded':
      return `session:${event.record.session.key}`;
    case 'session.withdrawn':
      return `session:${event.session.key}`;
    case 'session.noted':
      return `note:${event.note.sessionKey}`;
    case 'homework.counted':
      return `homework:${event.count.sessionKey}`;
    case 'homework.uncounted':
      return `homework:${event.sessionKey}`;
    case 'extra.logged':
      return `extra:${event.extra.id}`;
    case 'extra.removed':
      return `extra:${event.id}`;
    case 'roll-call.taken':
      return `roll-call:${event.rollCall.unit}`;
    case 'seating.set':
      return `seating:${event.plan.classId}/${event.plan.groupId}`;
    case 'counting.set':
      return 'counting';
    case 'setup.finished':
      return 'setup';
    case 'print.recorded':
      return `print:${event.print.id}`;
    case 'test.set':
      return `test:${event.test.id}`;
    case 'test.removed':
      return `test:${event.id}`;
    case 'plan.decided':
      return `decision:${event.decision.id}`;
    case 'plan.undecided':
      return `decision:${event.id}`;
    case 'duty.set':
      return `duty:${event.duty.id}`;
    case 'duty.removed':
      return `duty:${event.id}`;
    case 'catchup.set':
      return `catchup:${event.catchUp.id}`;
    case 'catchup.removed':
      return `catchup:${event.id}`;
    case 'support.set':
      return `support:${listKey(event.queue.courseId, kindOf(event.queue))}`;
    case 'repace.set':
      return `repace:${event.repace.id}`;
    case 'repace.removed':
      return `repace:${event.id}`;
    case 'clash.kept':
      return `clash:${event.kept.id}`;
    case 'clash.reopened':
      return `clash:${event.id}`;
    case 'move.set':
      return `move:${event.move.id}`;
    case 'move.removed':
      return `move:${event.id}`;
    case 'lesson-note.set':
      return `lesson-note:${event.note.id}`;
    case 'output.recorded':
      return `output:${event.output.id}`;
    case 'retention.set':
      return 'retention';
    case 'council-thresholds.set':
      return 'council-thresholds';
    case 'assessment.set':
      return `assessment:${event.setup.courseId}:${event.setup.term}`;
    case 'mark.set':
      return `mark:${markKey(event.mark)}`;
    case 'mark.corrected':
      return `mark:${markKey(event.fix.mark)}`;
    case 'capture.set':
      return `capture:${captureKey(event.capture)}`;
    case 'formula.set':
      return `formula:${event.courseId}`;
    case 'observation.set':
      return `observation:${observationKey(event.observation)}`;
    case 'appreciation.set':
      return `appreciation:${appreciationKey(event.appreciation)}`;
    case 'pupil.erased':
      return `pupil-erased:${event.erased.entries[0] ?? event.erased.classId}`;
    case 'recovery.set':
      return `recovery:${event.recovery?.key ?? ''}`;
    case 'backup.saved':
      return 'backup';
    case 'handover.sent':
    case 'handover.ended':
      return 'handover';
    case 'app.updated':
      return `app-updated:${event.updated?.build ?? ''}`;
    case 'copy.received':
      return 'copy-received';
    case 'world.kept':
      return 'world-kept';
    case 'school.joined':
      return `school-joined:${(event.joined?.code ?? '').replace(/:[^:]*$/u, '')}`;
    case 'school.held':
      return `school-held:${event.held?.school ?? ''}`;
    case 'school.waiting':
      return 'school-waiting';
    case 'school.timetable':
      return `school-timetable:${event.published?.school ?? ''}/${event.published?.version ?? ''}`;
    case 'school.cover': {
      const { school = '', day = '', session = '' } = event.cover ?? {};
      return `school-cover:${school}/${day}/${session}`;
    }
    case 'school.substitution': {
      const { school = '', id = '' } = event.substitution ?? {};
      return `school-substitution:${school}/${id}`;
    }
    case 'school.absences':
      return `school-absences:${event.absences?.school ?? ''}`;
    case 'inspector.device':
      return `inspector-device:${event.inspector?.device ?? ''}`;
    case 'inspector.sheet':
      return `inspector-sheet:${event.sheet?.grant ?? ''}`;
    case 'grant.requested': {
      const request = event.requested?.request as { id?: unknown } | undefined;
      return `grant-requested:${typeof request?.id === 'string' ? request.id : ''}`;
    }
    case 'school.issued': {
      const { school = '', assignment = '', issue = '' } = event.issued ?? {};
      return `school-issued:${school}/${assignment}/${issue}`;
    }
    case 'statement.shared':
      return `statement-shared:${event.share.id}`;
    case 'statement.sent':
      return `statement-sent:${event.sent.id}`;
    case 'statement.received':
      return `statement-received:${event.received.id}`;
    case 'teacher.named':
      return `teacher-named:${event.named.spki}`;
  }
}
