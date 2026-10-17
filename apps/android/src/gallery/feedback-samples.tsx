// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Snackbar } from '../components/Snackbar';
import type { ControlIcon } from '../components/control';
import { colors, spacing, typography } from '../design/tokens';
import { TabsSample } from './navigation-sample';
import { feedbackTexts } from './feedback-texts';
import type { SampleProps } from './samples';

/** A geometric information mark needs no font download and adds no extra spoken name. */
const information: ControlIcon = ({ size, color }) => (
  <View
    style={{
      width: size,
      height: size,
      borderWidth: 1.5,
      borderColor: color,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    }}
  >
    <View style={{ width: 2, height: 2, backgroundColor: color }} />
    <View style={{ width: 2, height: 6, backgroundColor: color }} />
  </View>
);

/** Both notice styles, with a longer reassurance that must wrap at enlarged text. */
export function NoticeSamples({ language }: SampleProps) {
  const text = feedbackTexts[language];
  return (
    <View style={styles.group}>
      <Notice icon={information} message={text.reassurance} />
      <Notice icon={information} message={text.longReassurance} />
      <Notice variant="notice" badge={text.badge} title={text.title} message={text.instruction} />
    </View>
  );
}

/** Synthetic feedback only; Undo hides the preview, and the real navigation bar supplies its measured height. */
function SnackbarExample({ sample, language, message, id }: SampleProps & { message: string; id: string }) {
  const [visible, setVisible] = useState(true);
  const [undone, setUndone] = useState(false);
  const [barHeight, setBarHeight] = useState<number>();
  const { fontScale } = useWindowDimensions();
  const text = feedbackTexts[language];
  return (
    <View style={[styles.frame, { minHeight: 320 * fontScale }]}>
      <View style={styles.content}>
        <Button
          testID={`${id}-show`}
          variant="line"
          label={text.show}
          onPress={() => {
            setUndone(false);
            setVisible(true);
          }}
        />
        {undone && (
          <Text accessibilityLiveRegion="polite" style={styles.note}>
            {text.undone}
          </Text>
        )}
      </View>
      {visible && barHeight !== undefined && (
        <Snackbar
          testID={id}
          message={message}
          undoLabel={text.undo}
          bottomOffset={barHeight}
          onUndo={() => {
            setVisible(false);
            setUndone(true);
          }}
        />
      )}
      <View testID={`${id}-nav`} onLayout={({ nativeEvent }) => setBarHeight(nativeEvent.layout.height)}>
        <TabsSample labels={sample.tabs} />
      </View>
    </View>
  );
}

/** A concise confirmation and a long one, each above the actual bottom bar, with repeatable Undo. */
export function SnackbarSamples({ sample, language }: SampleProps) {
  const text = feedbackTexts[language];
  return (
    <View style={styles.group}>
      <SnackbarExample sample={sample} language={language} message={text.confirmation} id="snack-short" />
      <SnackbarExample sample={sample} language={language} message={text.longConfirmation} id="snack-long" />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-12'], gap: spacing['space-16'] },
  frame: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  content: { flex: 1, padding: spacing['space-12'], gap: spacing['space-8'] },
  note: { ...typography.caption, color: colors.ink2 },
});
