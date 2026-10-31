// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What Week-sign and Week-fix say (#582, #583): on a PC, into the page's
// hidden live region, which follows the words it is given, the page's title,
// until the page says something, and says the same words again when they come
// again; elsewhere, announced.

import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { onPc } from '../text/device-text';

/** A way to say something, and the hidden live region it goes to on a PC, or null elsewhere. */
export function useSaid(said: string, testID: string) {
  const [spoken, setSpoken] = useState({ words: said, count: 0 });
  const say = (words: string) => {
    if (onPc()) setSpoken((before) => ({ words, count: before.count + 1 }));
    else AccessibilityInfo.announceForAccessibility(words);
  };
  const region = onPc() ? (
    <Text key={spoken.count} testID={testID} accessibilityLiveRegion="polite" style={styles.hidden}>
      {spoken.count === 0 ? said : spoken.words}
    </Text>
  ) : null;
  return { say, region };
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
