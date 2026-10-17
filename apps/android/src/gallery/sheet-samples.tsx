// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { OptionRow } from '../components/OptionRow';
import { TextField } from '../components/TextField';
import type { ControlIcon } from '../components/control';
import { colors, spacing, typography } from '../design/tokens';
import { fill, type SampleProps } from './samples';
import { choiceTexts } from './choice-texts';
import { feedbackTexts } from './feedback-texts';
import { fieldTexts } from './text-field-texts';
import { sheetTexts } from './sheet-texts';

const circle: ControlIcon = ({ size, color }) => (
  <View style={{ width: size, height: size, borderWidth: 1.5, borderColor: color, borderRadius: size / 2 }} />
);

/** A short decision, deliberately long content and a keyboard case; all changes are transient synthetic previews. */
export function BottomSheetSamples({ sample, language }: SampleProps) {
  const sheet = sheetTexts[language];
  const choices = choiceTexts[language];
  const fields = fieldTexts[language];
  const short = useRef<ViewInstance>(null);
  const long = useRef<ViewInstance>(null);
  const form = useRef<ViewInstance>(null);
  const destination = useRef<ViewInstance>(null);
  const [shown, setShown] = useState<'short' | 'long' | 'form' | null>(null);
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const open = (kind: 'short' | 'long' | 'form', target: ViewInstance | null) => {
    destination.current = target;
    setShown(kind);
  };
  const choose = (choice: string) => {
    setStatus(fill(sheet.chosen, { choice }));
    setShown(null);
  };
  return (
    <View style={styles.group}>
      <Button
        ref={short}
        testID="sheet-open-short"
        variant="line"
        label={sheet.open}
        onPress={() => open('short', short.current)}
      />
      <Button
        ref={long}
        testID="sheet-open-long"
        variant="line"
        label={sheet.openLong}
        onPress={() => open('long', long.current)}
      />
      <Button
        ref={form}
        testID="sheet-open-form"
        variant="line"
        label={sheet.openForm}
        onPress={() => open('form', form.current)}
      />
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {status}
      </Text>
      <BottomSheet
        testID="sample-bottom-sheet"
        visible={shown !== null}
        title={shown === 'long' ? sample.longHeading : sheet.title}
        context={shown === 'long' ? sample.longHeading : sheet.context}
        reassurance={feedbackTexts[language].reassurance}
        returnFocusRef={destination}
        onClose={() => {
          setStatus(sheet.cancelled);
          setShown(null);
        }}
      >
        <CheckRow label={choices.stage} checked={checked} onCheckedChange={setChecked} />
        <OptionRow
          testID="sheet-choice-0"
          icon={circle}
          label={choices.option}
          sub={choices.privacy}
          onPress={() => choose(choices.option)}
        />
        <OptionRow
          testID="sheet-choice-1"
          icon={circle}
          label={shown === 'long' ? sample.longHeading : choices.other}
          sub={shown === 'long' ? sample.longHeading : undefined}
          onPress={() => choose(choices.other)}
        />
        {shown === 'form' && (
          <TextField
            testID="sheet-note"
            label={fields.noteLabel}
            optionalLabel={fields.optionalLabel}
            placeholder={fields.example}
            value={note}
            onChangeText={setNote}
            multiline
          />
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-12'], paddingHorizontal: spacing['space-8'] },
  note: { ...typography.caption, color: colors.ink2 },
});
