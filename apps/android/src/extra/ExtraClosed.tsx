// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «حصة خارج استعمال الزمن» says when nothing can be logged yet (#219):
// no class, or a school year that starts later.

import { StyleSheet, View } from 'react-native';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, spacing } from '../design/tokens';
import { useText } from '../text/i18n';

export function ExtraClosed({ noClass }: { readonly noClass: boolean }) {
  const t = useText();
  return (
    <View style={styles.screen}>
      <Notice
        testID="extra-closed"
        icon={controlIcon('info')}
        message={t(noClass ? 'extra.noClass' : 'extra.beforeYear')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, gap: spacing['space-16'], paddingTop: spacing['space-16'] },
});
