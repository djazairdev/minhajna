// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إضافة عمود» (#238, R-3.5-04, answer 432): a column of the teacher's own,
// its name of 40 characters at most and its points from 1 to 10. It joins
// the setup's draft, and is kept only when the setup is saved. The name is
// the teacher's words about the work assessed, nothing about a pupil. What
// the sheet holds starts afresh each time it opens.

import { COLUMN_NAME_MAX, COLUMN_POINTS } from '@minhajna/core';
import { useState, type RefObject } from 'react';
import type { ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Stepper } from '../components/Stepper';
import { TextField } from '../components/TextField';
import { useText } from '../text/i18n';

export type ColumnSheetProps = {
  readonly visible: boolean;
  readonly className: string;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
  readonly onClose: () => void;
  readonly onAdd: (name: string, points: number) => void;
};

export function ColumnSheet(props: ColumnSheetProps) {
  const t = useText();
  return (
    <BottomSheet
      testID="marks-column-sheet"
      visible={props.visible}
      title={t('marks.addColumn')}
      context={t('marks.columnContext', { class: props.className })}
      reassurance={t('marks.columnReassurance')}
      returnFocusRef={props.returnFocusRef}
      onClose={props.onClose}
    >
      {props.visible && <ColumnBody onAdd={props.onAdd} />}
    </BottomSheet>
  );
}

function ColumnBody({ onAdd }: { onAdd: (name: string, points: number) => void }) {
  const t = useText();
  const [name, setName] = useState('');
  const [points, setPoints] = useState<number>(COLUMN_POINTS.min);
  return (
    <>
      <TextField
        testID="marks-column-name"
        label={t('marks.columnName')}
        placeholder={t('marks.columnPlaceholder')}
        value={name}
        maxLength={COLUMN_NAME_MAX}
        onChangeText={setName}
      />
      <Stepper
        testID="marks-column-points"
        label={t('marks.columnPoints')}
        unit={t('marks.range', COLUMN_POINTS)}
        value={points}
        min={COLUMN_POINTS.min}
        max={COLUMN_POINTS.max}
        onValueChange={setPoints}
        decreaseLabel={t('marks.columnFewer')}
        increaseLabel={t('marks.columnMore')}
      />
      <Button
        testID="marks-column-add"
        label={t('marks.columnAdd')}
        disabled={name.trim() === ''}
        onPress={() => onAdd(name.trim(), points)}
      />
    </>
  );
}
