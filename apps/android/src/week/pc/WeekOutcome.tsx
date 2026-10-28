// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «نتيجة أخرى» from the PC week's pane (#251, answer 526): Today's own sheet,
// with the session's class, time and proposed lesson, the plan's next and
// previous items and where the lesson would carry over, so a choice made here
// records exactly as it does on Today.

import { carryTo, courseSetup, type Choice, type Reason, type TodaySession, type TodayView } from '@minhajna/core';
import type { RefObject } from 'react';
import type { ViewInstance } from 'react-native';
import { OutcomeSheet } from '../../today/OutcomeSheet';
import { carryWords, nextItem, previousOf } from '../../today/outcome-rules';
import { isolate } from '../grid-labels';
import { sessionText, type WeekWords } from './week-labels';

export type WeekOutcomeProps = {
  readonly words: WeekWords;
  readonly view: TodayView;
  readonly item: TodaySession;
  readonly visible: boolean;
  readonly onChoose: (choice: Choice) => void;
  readonly onReason: (reason: Reason | undefined, text: string | undefined) => void;
  readonly onClose: () => void;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
};

export function WeekOutcome({
  words,
  view,
  item,
  visible,
  onChoose,
  onReason,
  onClose,
  returnFocusRef,
}: WeekOutcomeProps) {
  const { t, context, data, language } = words;
  if (item.proposal === null) return null;
  const text = sessionText(words, view, item);
  return (
    <OutcomeSheet
      visible={visible}
      context={[isolate(text.className), text.time, isolate(item.proposal.item.title)].join(' · ')}
      proposal={item.proposal}
      next={nextItem(courseSetup(context, item.course.id).pack, item.proposal.item)}
      previous={previousOf(context, item.session)}
      carry={carryWords(t, data.profile, language, carryTo(context, item.session))}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
      onChoose={onChoose}
      onReason={onReason}
    />
  );
}
