// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet, View } from 'react-native';
import { DueStrip } from '../components/DueStrip';
import { Proposal } from '../components/Proposal';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { proposalTexts } from './proposal-texts';
import type { SampleProps } from './samples';

/** A proposal from the plan, and a long one that continues from the previous session. */
export function ProposalSamples({ language }: SampleProps) {
  const text = proposalTexts[language];
  const stages = (lines: readonly string[]) => lines.map((line) => ({ text: line }));
  return (
    <View style={styles.group}>
      <Proposal
        testID="proposal-plan"
        tag={text.tag}
        lines={[
          { label: text.domain, text: text.domainValue },
          { label: text.topic, text: text.topicValue },
          ...stages(text.stages),
        ]}
      />
      <Proposal
        testID="proposal-continues"
        tag={text.continuesTag}
        lines={[{ label: text.topic, text: text.longTopic }, ...stages(text.longStages)]}
      />
    </View>
  );
}

/** The roll-call strip and a homework strip; their buttons open nothing in the gallery. */
export function DueStripSamples({ language }: SampleProps) {
  const text = proposalTexts[language];
  return (
    <View style={styles.group}>
      <DueStrip
        testID="due-roll"
        icon={controlIcon('pupils')}
        fact={text.noAbsence}
        action={text.rollCall}
        onOpen={() => undefined}
      />
      <DueStrip
        testID="due-homework"
        icon={controlIcon('homework')}
        fact={text.homeworkDue}
        action={text.count}
        onOpen={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
});
