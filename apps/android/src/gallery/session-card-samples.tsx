// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet, View } from 'react-native';
import { SessionCard } from '../components/SessionCard';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { proposalTexts } from './proposal-texts';
import type { SampleProps } from './samples';
import { sessionCardTexts } from './session-card-texts';

const nothing = () => undefined;

/** A done card, the focus card with its due strips, one with a long topic, and two mini cards; buttons open nothing. */
export function SessionCardSamples({ language }: SampleProps) {
  const text = sessionCardTexts[language];
  const proposal = proposalTexts[language];
  const [first, second, third] = text.classes;
  const [early, middle, late] = text.slots;
  const focus = {
    kind: 'focus' as const,
    confirm: text.confirm,
    onConfirm: nothing,
    more: [
      { id: 'other', label: text.other, onPress: nothing },
      { id: 'details', label: text.details, onPress: nothing },
    ] as const,
  };
  return (
    <View style={styles.group}>
      <SessionCard
        testID="card-done"
        kind="done"
        meta={{ className: first, slot: early, subject: text.subject }}
        written={text.written}
        where={text.where}
        show={{ id: 'show', label: text.show, onPress: nothing }}
      />
      <SessionCard
        testID="card-focus"
        {...focus}
        meta={{ className: second, slot: middle, subject: text.subject }}
        proposal={{
          tag: proposal.tag,
          lines: [
            { label: proposal.domain, text: proposal.domainValue },
            { label: proposal.topic, text: proposal.topicValue },
            ...proposal.stages.map((line) => ({ text: line })),
          ],
        }}
        due={[
          { icon: controlIcon('pupils'), fact: proposal.noAbsence, action: proposal.rollCall, onOpen: nothing },
          { icon: controlIcon('homework'), fact: proposal.homeworkDue, action: proposal.count, onOpen: nothing },
        ]}
      />
      <SessionCard
        testID="card-long"
        {...focus}
        meta={{ className: second, slot: middle, subject: text.subject }}
        proposal={{
          tag: proposal.continuesTag,
          lines: [
            { label: proposal.topic, text: proposal.longTopic },
            ...proposal.longStages.map((line) => ({ text: line })),
          ],
        }}
      />
      <SessionCard
        testID="card-continued"
        kind="mini"
        meta={{ className: second, slot: middle }}
        lesson={text.continued}
        note={text.continuedNote}
      />
      <SessionCard testID="card-mini" kind="mini" meta={{ className: third, slot: late }} lesson={text.lesson} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-10'] },
});
