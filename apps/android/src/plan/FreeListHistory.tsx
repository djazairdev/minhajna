// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The history of a class's own list (#227, answer 347): the day it was
// last offered for review, then the day it began, newest first.

import { formatDay, type FreeList } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';

export function FreeListHistory({ list }: { readonly list: FreeList }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="free-history" accessible style={styles.group}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('planFree.history')}
      </Text>
      {[
        ...(list.offered === undefined ? [] : [t('planFree.offered', { day: formatDay(list.offered) })]),
        t('planFree.started', { day: formatDay(list.started) }),
      ].map((line) => (
        <Text key={line} style={[styles.sub, align]}>
          {line}
        </Text>
      ))}
    </View>
  );
}
