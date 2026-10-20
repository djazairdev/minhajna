// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sheets of a plan item's changes (#225, Plan-item): where to move it,
// how many sessions it takes, the titles of its two parts, and an item to
// add after it. Each change is saved once chosen, for this class alone.
// The sheets stay mounted, so focus goes back to the row that opened one;
// what a sheet holds starts afresh each time it opens. A title takes 160
// characters at most, as the core allows.

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

const TITLE = 160;

export type ItemSheetsProps = {
  readonly sheet: Sheet | null;
  readonly item: PackItem;
  readonly className: string;
  readonly sessions: number;
  readonly others: readonly PackItem[];
  readonly last: boolean;
  readonly openers: Readonly<Record<Sheet, RefObject<ViewInstance | null>>>;
  readonly onClose: () => void;
  readonly onMove: (before: string | null) => void;
  readonly onBudget: (sessions: number) => void;
  readonly onSplit: (titles: readonly [string, string]) => void;
  readonly onAdd: (title: string, sessions: number) => void;
};

export function ItemSheets(props: ItemSheetsProps) {
  const t = useText();
  const { item, sheet, className, openers, onClose } = props;
  const title = isolate(item.title);
  const common = (kind: Sheet) => ({
    testID: `sheet-${kind}`,
    visible: sheet === kind,
    returnFocusRef: openers[kind],
    onClose,
    reassurance: t('planItem.reassurance'),
  });
  return (
    <>
      <BottomSheet
        {...common('move')}
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
        {!props.last && (
          <OptionRow testID="item-to-end" label={t('planItem.toEnd')} onPress={() => props.onMove(null)} />
        )}
      </BottomSheet>
      <BottomSheet
        {...common('budget')}
        title={t('planItem.budget')}
        context={t('planItem.budgetContext', { title, class: className })}
      >
        {sheet === 'budget' && <BudgetBody sessions={props.sessions} onBudget={props.onBudget} />}
      </BottomSheet>
      <BottomSheet
        {...common('split')}
        title={t('planItem.split')}
        context={props.sessions === 1 ? t('planItem.splitOne') : t('planItem.splitContext')}
      >
        {sheet === 'split' && <SplitBody item={item} onSplit={props.onSplit} />}
      </BottomSheet>
      <BottomSheet
        {...common('add')}
        title={t('planItem.add')}
        context={t('planItem.addContext', { title, class: className })}
      >
        {sheet === 'add' && <AddBody onAdd={props.onAdd} />}
      </BottomSheet>
    </>
  );
}

function SessionStepper({
  value,
  onValueChange,
  testID,
}: {
  value: number;
  onValueChange: (value: number) => void;
  testID: string;
}) {
  const t = useText();
  return (
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
}

function BudgetBody({ sessions, onBudget }: { sessions: number; onBudget: (sessions: number) => void }) {
  const t = useText();
  const [budget, setBudget] = useState(sessions);
  return (
    <>
      <SessionStepper value={budget} onValueChange={setBudget} testID="item-budget-stepper" />
      <Button
        testID="item-budget-save"
        label={t('planItem.save')}
        disabled={budget === sessions}
        onPress={() => onBudget(budget)}
      />
    </>
  );
}

function SplitBody({ item, onSplit }: { item: PackItem; onSplit: (titles: readonly [string, string]) => void }) {
  const t = useText();
  const part = (n: 1 | 2) => {
    const whole = t('planItem.partTitle', { title: item.title, n });
    const over = whole.length - TITLE;
    return over <= 0 ? whole : t('planItem.partTitle', { title: item.title.slice(0, -over).trimEnd(), n });
  };
  const [parts, setParts] = useState<[string, string]>(() => [part(1), part(2)]);
  return (
    <>
      <TextField
        testID="item-part-1"
        label={t('planItem.partOne')}
        placeholder={item.title}
        value={parts[0]}
        maxLength={TITLE}
        onChangeText={(value) => setParts([value, parts[1]])}
      />
      <TextField
        testID="item-part-2"
        label={t('planItem.partTwo')}
        placeholder={item.title}
        value={parts[1]}
        maxLength={TITLE}
        onChangeText={(value) => setParts([parts[0], value])}
      />
      <Button
        testID="item-split-save"
        label={t('planItem.save')}
        disabled={parts.some((one) => one.trim() === '')}
        onPress={() => onSplit([parts[0].trim(), parts[1].trim()])}
      />
    </>
  );
}

function AddBody({ onAdd }: { onAdd: (title: string, sessions: number) => void }) {
  const t = useText();
  const [added, setAdded] = useState('');
  const [sessions, setSessions] = useState(1);
  return (
    <>
      <TextField
        testID="item-add-title"
        label={t('planItem.addTitle')}
        placeholder={t('planItem.addPlaceholder')}
        value={added}
        maxLength={TITLE}
        onChangeText={setAdded}
      />
      <SessionStepper value={sessions} onValueChange={setSessions} testID="item-add-stepper" />
      <Button
        testID="item-add-save"
        label={t('planItem.save')}
        disabled={added.trim() === ''}
        onPress={() => onAdd(added.trim(), sessions)}
      />
    </>
  );
}
