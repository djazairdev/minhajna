// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which plan: the whole class or one of its groups, each with its own
// plan. Two or three are a segmented control, as Roll-seats-setup draws
// them; a class with more groups gets chips.

import type { ClassGroup } from '@minhajna/core';
import { ChipGroup } from '../components/Chip';
import { SegmentedControl, type SegmentChoice } from '../components/SegmentedControl';
import { useText } from '../text/i18n';

export function GroupChoice(props: {
  groups: readonly ClassGroup[];
  selected: string;
  onSelect: (groupId: string) => void;
}) {
  const t = useText();
  const choices = props.groups.map((group) => ({
    value: group.id,
    label: group.kind === 'whole' ? t('seats.wholeClass') : group.name,
  }));
  const [first, second, third] = choices;
  if (first !== undefined && second !== undefined && choices.length <= 3) {
    const segments:
      | readonly [SegmentChoice<string>, SegmentChoice<string>]
      | readonly [SegmentChoice<string>, SegmentChoice<string>, SegmentChoice<string>] =
      third === undefined ? [first, second] : [first, second, third];
    return (
      <SegmentedControl
        testID="seats-group"
        label={t('seats.group')}
        choices={segments}
        selected={props.selected}
        onSelect={props.onSelect}
      />
    );
  }
  return (
    <ChipGroup
      testID="seats-group"
      label={t('seats.group')}
      choices={choices}
      selected={props.selected}
      onSelect={props.onSelect}
    />
  );
}
