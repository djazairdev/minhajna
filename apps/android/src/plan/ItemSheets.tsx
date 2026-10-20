// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sheets of a plan item's changes (#225, Plan-item): where to move it,
// how many sessions it takes, the titles of its two parts, and an item to
// add after it. Each change is saved once chosen, for this class alone.

import type { PackItem } from '@minhajna/core';
import { useState, type RefObject } from 'react';
import type { ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { OptionRow } from '../components/OptionRow';
import { Stepper } from '../components/Stepper';
import { TextField } from '../components/TextField';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

export type Sheet = 'move' | 'budget' | 'split' | 'add';

export type ItemSheetsProps = {
  readonly sheet: Sheet | null;
  readonly item: PackItem;
  readonly className: string;
  readonly sessions: number;
  readonly others: readonly PackItem[];
  readonly opener: RefObject<ViewInstance | null>;
  readonly onClose: () => void;
  readonly onMove: (before: string | null) => void;
  readonly onBudget: (sessions: number) => void;
  readonly onSplit: (titles: readonly [string, string]) => void;
  readonly onAdd: (title: string, sessions: number) => void;
};

export function ItemSheets(props: ItemSheetsProps) {
  const t = useText();
  const { item, sheet, className, opener, onClose } = props;
  const title = isolate(item.title);
  const [budget, setBudget] = useState(props.sessions);
  const [parts, setParts] = useState<[string, string]>([
    t('planItem.partTitle', { title: item.title, n: 1 }),
    t('planItem.partTitle', { title: item.title, n: 2 }),
  ]);
  const [added, setAdded] = useState('');
  const [addSessions, setAddSessions] = useState(1);
  const common = { returnFocusRef: opener, onClose, reassurance: t('planItem.reassurance') };
  const stepper = (value: number, onValueChange: (value: number) => void, testID: string) => (
    <Stepper
      testID={testID}
      label={t('planItem.budget')}
      unit={t('planItem.unit')}
      value={value}
      min={1}
      max={60}
      onValueChange={onValueChange}
      decreaseLabel={t('planItem.fewer')}
      increaseLabel={t('planItem.more')}
    />
  );
  return (
    <>
      <BottomSheet
        {...common}
        testID="sheet-move"
        visible={sheet === 'move'}
        title={t('planItem.move')}
        context={t('planItem.moveContext', { class: className })}
      >
        {props.others.map((other) => (
          <OptionRow
            key={other.id}
            testID={`item-before-${other.id}`}
            label={t('planItem.before', { title: isolate(other.title) })}
            onPress={() => props.onMove(other.id)}
          />
        ))}
        <OptionRow testID="item-to-end" label={t('planItem.toEnd')} onPress={() => props.onMove(null)} />
      </BottomSheet>
      <BottomSheet
        {...common}
        testID="sheet-budget"
        visible={sheet === 'budget'}
        title={t('planItem.budget')}
        context={t('planItem.budgetContext', { title, class: className })}
      >
        {stepper(budget, setBudget, 'item-budget-stepper')}
        <Button
          testID="item-budget-save"
          label={t('planItem.save')}
          disabled={budget === props.sessions}
          onPress={() => props.onBudget(budget)}
        />
      </BottomSheet>
      <BottomSheet
        {...common}
        testID="sheet-split"
        visible={sheet === 'split'}
        title={t('planItem.split')}
        context={props.sessions === 1 ? t('planItem.splitOne') : t('planItem.splitContext')}
      >
        <TextField
          testID="item-part-1"
          label={t('planItem.partOne')}
          placeholder={item.title}
          value={parts[0]}
          onChangeText={(value) => setParts([value, parts[1]])}
        />
        <TextField
          testID="item-part-2"
          label={t('planItem.partTwo')}
          placeholder={item.title}
          value={parts[1]}
          onChangeText={(value) => setParts([parts[0], value])}
        />
        <Button
          testID="item-split-save"
          label={t('planItem.save')}
          disabled={parts.some((part) => part.trim() === '')}
          onPress={() => props.onSplit([parts[0].trim(), parts[1].trim()])}
        />
      </BottomSheet>
      <BottomSheet
        {...common}
        testID="sheet-add"
        visible={sheet === 'add'}
        title={t('planItem.add')}
        context={t('planItem.addContext', { title, class: className })}
      >
        <TextField
          testID="item-add-title"
          label={t('planItem.addTitle')}
          placeholder={t('planItem.addPlaceholder')}
          value={added}
          onChangeText={setAdded}
        />
        {stepper(addSessions, setAddSessions, 'item-add-stepper')}
        <Button
          testID="item-add-save"
          label={t('planItem.save')}
          disabled={added.trim() === ''}
          onPress={() => props.onAdd(added.trim(), addSessions)}
        />
      </BottomSheet>
    </>
  );
}
