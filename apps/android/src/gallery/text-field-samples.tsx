// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextField, type TextFieldProps } from '../components/TextField';
import { spacing } from '../design/tokens';
import type { Sample } from './samples';

/** Gallery edits are transient, synthetic content, never records or persisted form values. */
function EditableSample({ value: initial, ...props }: Omit<TextFieldProps, 'onChangeText'>) {
  const [value, setValue] = useState(initial);
  return <TextField {...props} value={value} onChangeText={setValue} />;
}

/** Empty, filled, growing, optional and invalid fields, plus LTR code and number entry. */
export function TextFieldSamples({ sample }: { sample: Sample }) {
  const text = sample.fields;
  const base = { label: text.label, placeholder: text.example };
  return (
    <View style={styles.group}>
      <EditableSample {...base} testID="field-empty" value="" />
      <EditableSample {...base} testID="field-filled" value={text.value} />
      <EditableSample {...base} testID="field-area" label={text.areaLabel} multiline value={text.areaValue} />
      <EditableSample
        {...base}
        testID="field-optional"
        label={text.noteLabel}
        optionalLabel={text.optionalLabel}
        value=""
      />
      <EditableSample {...base} testID="field-error" value="" error={text.error} />
      <EditableSample
        {...base}
        testID="field-code"
        label={text.codeLabel}
        placeholder={text.codeExample}
        textDirection="ltr"
        value={text.codeValue}
      />
      <EditableSample
        {...base}
        testID="field-number"
        label={text.numberLabel}
        placeholder={text.numberExample}
        inputMode="numeric"
        textDirection="ltr"
        value={text.numberValue}
      />
    </View>
  );
}

const styles = StyleSheet.create({ group: { padding: spacing['space-16'], gap: spacing['space-16'] } });
