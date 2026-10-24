// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { recoveryGroups } from '@minhajna/core';
import { Text, View } from 'react-native';
import { useText } from '../text/i18n';
import { recoveryStyles as own } from './recovery-styles';

/** A key in six numbered groups of four, left to right, each read as its number and its characters one by one. */
export function KeyGroups({ value }: { readonly value: string }) {
  const t = useText();
  return (
    <View style={own.groups}>
      {recoveryGroups(value).map((group, index) => (
        <View
          key={index}
          style={own.group}
          accessible
          accessibilityLabel={t('settings.recovery.group', { number: index + 1, letters: [...group].join(' ') })}
        >
          <Text style={own.number}>{index + 1}</Text>
          <Text style={own.letters}>{group}</Text>
        </View>
      ))}
    </View>
  );
}
