// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A joint class's slot on Today (#43, P-Multi): one card for its years, each
// on its own plan. A year recorded shows what it wrote; on the focus slot,
// each year ready shows its proposal to confirm alone, and one button
// confirms them all at once.

import {
  courseGrade,
  courseSetup,
  type Context,
  type HomeworkItem,
  type Session,
  type TodaySession,
} from '@minhajna/core';
import type { SessionMeta } from '../components/SessionCard';
import { dueStrips } from '../homework/homework-strip';
import { yearShort } from '../setup/names';
import { currentLanguage, useText } from '../text/i18n';
import { JointCard, type JointYear } from './JointCard';
import { sessionsOf } from './joint-today';
import { lessonOf, proposalOf, writtenOf } from './today-labels';

export type TodayJointProps = {
  /** The slot's key in Today's entries. */
  readonly slotKey: string;
  readonly items: readonly TodaySession[];
  readonly focus: TodaySession | undefined;
  readonly context: Context;
  readonly metaOf: (item: TodaySession, withSubject: boolean) => SessionMeta;
  readonly confirm: (item: TodaySession) => void;
  readonly confirmAll: (items: readonly TodaySession[], key: string) => void;
  readonly onDetails: (session: Session) => void;
  readonly onRoll: (session: Session) => void;
  readonly onHomework: (item: HomeworkItem) => void;
  /** False when the day's band shows the class's half-day roll call instead. */
  readonly roll: boolean;
};

export function TodayJoint(props: TodayJointProps) {
  const { slotKey, items, focus, context, metaOf, confirm, confirmAll, onDetails } = props;
  const t = useText();
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const schoolClass = context.state.classes.get(items[0]?.course.classId ?? '');
  const first = items[0];
  if (schoolClass === undefined || first === undefined) return null;
  const ready = items.filter((item) => item.status === 'awaiting' && item.proposal !== null);
  const onFocus = focus !== undefined && items.includes(focus);
  const years = items.map((item): JointYear => {
    const grade = courseGrade(item.course, schoolClass);
    const pack = courseSetup(context, item.course.id).pack;
    const head = { id: grade, badge: grade.replace(/\D/g, ''), name: yearShort(t, grade) };
    if (item.status === 'recorded' && item.record !== null) {
      const show = { id: `fix-${grade}`, label: t('fix.open'), onPress: () => onDetails(item.session) };
      return { ...head, kind: 'done', written: writtenOf(t, pack, item.record, comma), show };
    }
    if (onFocus && item.proposal !== null && ready.includes(item)) {
      const proposal = proposalOf(t, pack, item.proposal);
      return { ...head, kind: 'proposal', proposal, onConfirm: () => confirm(item), hint: t('joint.alone') };
    }
    const show = { id: `details-${grade}`, label: t('entry.open'), onPress: () => onDetails(item.session) };
    return { ...head, kind: 'lesson', lesson: lessonOf(t, item, pack).lesson, ...(onFocus && { show }) };
  });
  return (
    <JointCard
      testID={`today-${slotKey}`}
      meta={{ ...metaOf(first, true), className: schoolClass.name }}
      years={years}
      due={dueStrips(t, context, sessionsOf(items), props.onRoll, props.onHomework, props.roll)}
      {...(onFocus && {
        confirm: {
          label: t('joint.confirm', { count: ready.length }),
          note: t('joint.confirmNote'),
          onConfirm: () => confirmAll(ready, slotKey),
        },
      })}
    />
  );
}
