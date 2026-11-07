// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome's hero carries interface words, not made-up content, so its
// samples read the catalogue in the gallery's language.

import { StyleSheet, View } from 'react-native';
import { WelcomeHero } from '../components/WelcomeHero';
import { spacing } from '../design/tokens';
import { useText } from '../text/i18n';

/** The welcome's hero with the mim, and the tabs' plainer one. */
export function WelcomeHeroSamples() {
  const t = useText();
  return (
    <View style={styles.group}>
      <WelcomeHero mark title={t('name')} tagline={t('tagline')} line={t('welcome.line')} />
      <WelcomeHero title={t('name')} tagline={t('tagline')} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-16'] },
});
