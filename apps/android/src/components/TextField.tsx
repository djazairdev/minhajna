// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useId, useState, type Ref } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { TextInputInstance, TextInputProps } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import type { ControlIcon } from './control';

/** Controlled text, with translated labels/examples supplied by the screen's catalogue. */
export type TextFieldProps = Pick<
  TextInputProps,
  'keyboardType' | 'inputMode' | 'maxLength' | 'editable' | 'onSubmitEditing' | 'returnKeyType' | 'onFocus' | 'onBlur'
> & {
  readonly label: string;
  /** Decorative only; the translated label must carry its meaning. */
  readonly labelIcon?: ControlIcon;
  readonly placeholder: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  /** Its presence marks the field optional; supply the translated word, not an English default. */
  readonly optionalLabel?: string;
  readonly error?: string;
  readonly multiline?: boolean;
  /** Numbers and codes can stay LTR without moving the surrounding Arabic label. */
  readonly textDirection?: 'rtl' | 'ltr';
  readonly testID?: string;
  readonly ref?: Ref<TextInputInstance>;
};

/**
 * A labelled native edit box, at least 48dp (80dp for a growing text area).
 * Android's labelled-by association preserves the name when the field has a
 * value. Its label includes any error, independently of optional speech hints.
 * Android's content-size event already includes the input's compound padding.
 * Until that first event, a text area keeps its native intrinsic height.
 */
export function TextField({
  label,
  labelIcon,
  placeholder,
  value,
  onChangeText,
  optionalLabel,
  error,
  multiline = false,
  textDirection,
  testID,
  ref,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const { direction } = useLocale();
  const { fontScale } = useWindowDimensions();
  const labelId = useId();
  const [contentHeight, setContentHeight] = useState(0);
  const [focused, setFocused] = useState(false);
  const displayLabel = optionalLabel ? `${label} (${optionalLabel})` : label;
  const spokenLabel = error ? `${displayLabel}. ${error}` : displayLabel;
  const inputDirection = textDirection ?? direction;
  const minimum = Math.max(
    multiline ? 80 : sizes.target,
    typography.body.lineHeight * fontScale + spacing['space-10'] * 2 + 1.5 * 2,
  );
  const labelText = (
    <Text nativeID={labelId} accessibilityLabel={spokenLabel} style={[styles.label, labelIcon && styles.labelWords]}>
      {displayLabel}
    </Text>
  );
  return (
    <View style={[styles.group, { direction }]}>
      {labelIcon ? (
        <View style={styles.labelRow}>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {labelIcon({ size: sizes.icon, color: colors.ink2 })}
          </View>
          {labelText}
        </View>
      ) : (
        labelText
      )}
      <View>
        <TextInput
          {...inputProps}
          ref={ref}
          testID={testID}
          accessibilityLabelledBy={labelId}
          placeholder={placeholder}
          placeholderTextColor={colors.pencil}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          autoComplete="off"
          importantForAutofill="noExcludeDescendants"
          autoCorrect={false}
          spellCheck={false}
          underlineColorAndroid="transparent"
          cursorColor={colors.ink}
          selectionColor={colors.hi}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onContentSizeChange={
            multiline
              ? ({ nativeEvent }) => {
                  const height = nativeEvent.contentSize.height;
                  if (Number.isFinite(height) && height >= 0) setContentHeight(Math.ceil(height));
                }
              : undefined
          }
          style={[
            styles.input,
            {
              minHeight: minimum,
              direction: inputDirection,
              writingDirection: inputDirection,
              textAlign: inputDirection === 'rtl' ? 'right' : 'left',
              textAlignVertical: multiline ? 'top' : 'center',
            },
            multiline && contentHeight > 0 && { height: Math.max(minimum, contentHeight) },
          ]}
        />
        {focused && <View pointerEvents="none" accessible={false} style={styles.focus} />}
      </View>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-6'], alignSelf: 'stretch' },
  label: { ...typography.label, color: colors.ink2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-6'] },
  labelWords: { flex: 1, minWidth: 0, textAlign: 'start' },
  input: {
    ...typography.body,
    minWidth: sizes.target,
    width: '100%',
    paddingVertical: spacing['space-10'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
    color: colors.ink,
  },
  focus: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    start: 2,
    end: 2,
    borderWidth: 2,
    borderColor: colors.focus,
    borderRadius: radius['radius-control'] - 2,
  },
  error: { ...typography.caption, color: colors['error-ink'] },
});
