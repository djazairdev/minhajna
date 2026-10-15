// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from './src/design/tokens';
import { bundledReference, readReference, type ReferenceFiles } from './src/reference';
import text from './src/text/ar.json';

// One screen in Arabic, right to left: enough to prove the build (#18). The
// interface language and its catalogue come with #21, and the design's
// components with #20. The three interface fonts are bundled for offline use.
// It starts from the insets known at launch, so the first frame is drawn at
// once. Algeria's reference data is read at start (#87); no screen uses it
// yet. In development every problem in it is logged, for whoever keys the
// data; teachers see one short message.
export default function App({ files = bundledReference }: { files?: ReferenceFiles }) {
  const reference = useMemo(() => {
    const result = readReference(files);
    if (!result.ok && __DEV__) console.warn('Reference data refused', result.problems);
    return result;
  }, [files]);
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar barStyle="light-content" />
      <Welcome referenceRefused={!reference.ok} />
    </SafeAreaProvider>
  );
}

function Welcome({ referenceRefused }: { referenceRefused: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.name} accessibilityRole="header">
          {text.name}
        </Text>
        <Text style={styles.tagline}>{text.tagline}</Text>
        <Text style={styles.latinName}>{text.latinName}</Text>
        {referenceRefused && (
          <Text style={styles.notice} accessibilityRole="alert">
            {text.referenceRefused}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

// The logo's board and chalk colours (docs/design/system).
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.board,
  },
  // A scrollable, padded page keeps the fonts readable at 200% text, without
  // shrinking the type or limiting the number of lines.
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['space-20'],
  },
  // The canvas's 1.15 line box clips Ruqaa's lower dots on Android, especially
  // at 200%. Let the bundled font's own ascent and descent set this line box.
  name: { ...typography.brand, lineHeight: undefined, color: colors.chalk, textAlign: 'center' },
  tagline: { ...typography.tagline, color: colors.chalk, textAlign: 'center', marginTop: spacing['space-12'] },
  latinName: {
    ...typography['body-latin'],
    color: colors.chalk,
    textAlign: 'center',
    writingDirection: 'ltr',
    marginTop: spacing['space-12'],
  },
  notice: { ...typography.body, color: colors.chalk, textAlign: 'center', marginTop: spacing['space-20'] },
});
