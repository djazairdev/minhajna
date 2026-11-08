// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's settings in the dashboard (answer 856), which has no teaching
// to set up: this PC's lock and its delay, the interface's language, erasing
// this PC, and, of Help, only the crash reports, off until turned on and
// deleting a kept report when turned off, as in the teacher app's Help, and
// the privacy notice to read again.

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../../android/src/components/Notice';
import { RowLink } from '../../android/src/components/RowLink';
import { SectionHeader } from '../../android/src/components/SectionHeader';
import { Switch } from '../../android/src/components/Switch';
import { controlIcon } from '../../android/src/design/Icon';
import { spacing } from '../../android/src/design/tokens';
import native from '../../android/src/native/NativeMinhajnaCrash';
import { settingsStyles as styles } from '../../android/src/settings/styles';
import { useDashboardText } from './text';

/** What a row of reader mode's settings opens. */
export type ReaderTarget = 'security' | 'language' | 'erase' | 'privacy';

/** The rows, by section. */
export function ReaderSettings({ onOpen }: { readonly onOpen: (target: ReaderTarget) => void }) {
  const t = useDashboardText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const [crashes, setCrashes] = useState(() => native.reportsOn());
  const [failed, setFailed] = useState(false);
  const row = (target: ReaderTarget, title: string, description?: string) => (
    <RowLink
      testID={`settings-${target}`}
      icon={controlIcon('tune')}
      title={title}
      description={description}
      onPress={() => onOpen(target)}
    />
  );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <View style={styles.group}>
        <SectionHeader label={t('settings.phone')} />
        {row('security', t('settings.rows.security'))}
        {row('language', t('settings.rows.language'))}
      </View>
      <View style={styles.group}>
        <SectionHeader label={t('settings.data')} />
        {row('erase', t('settings.eraseDevice.erase'), t('settings.eraseLine'))}
      </View>
      <View style={styles.group}>
        <SectionHeader label={t('settings.help')} />
        <Switch
          testID="settings-crashes"
          label={t('help.crashes')}
          description={t('help.crashesLine')}
          value={crashes}
          onValueChange={(on) => {
            const saved = native.setReports(on);
            if (saved) setCrashes(on);
            setFailed(!saved);
          }}
        />
        {failed && (
          <Notice testID="settings-crashes-failed" icon={controlIcon('info')} message={t('settings.failed')} />
        )}
        {row('privacy', t('settings.rows.privacy'))}
      </View>
    </ScrollView>
  );
}
