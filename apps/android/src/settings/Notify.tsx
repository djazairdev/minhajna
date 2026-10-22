// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الإشعارات» in Settings (#234, Notif, answers 402 to 404): the weekly
// digest, on by default, which says when it comes; the daily preview, off
// by default; «العمل يوم السبت», which moves the digest to Saturday morning
// and shortens the weekend's quiet hours; then the quiet hours themselves,
// and that no notification shows a pupil's name or a mark. Each choice is
// kept on this phone the moment it changes. When Android does not let the
// app notify, the screen says so, and «السماح بالإشعارات» asks again or
// opens the app's notification settings (answer 406). The year-end prompts
// and the 30-day reminder come with their own screens (answer 404).

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Switch } from '../components/Switch';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import notify from '../native/NativeMinhajnaNotify';
import { askPermission, recheckEnabled, useNotifyEnabled } from '../notify/useNotify';
import { useText } from '../text/i18n';
import { setNotifyPrefs, useNotifyPrefs } from './notify-prefs';
import { settingsStyles as styles } from './styles';

export function Notify() {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const prefs = useNotifyPrefs();
  const [failed, setFailed] = useState(false);
  const enabled = useNotifyEnabled();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const change = (key: keyof typeof prefs) => (value: boolean) => {
    try {
      setNotifyPrefs({ [key]: value });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };
  const allow = async () => {
    const granted = await askPermission().catch(() => false);
    if (!granted || !notify.enabled()) notify.openSettings();
    recheckEnabled();
  };
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
      <Text style={[styles.sub, align]}>{t('settings.notify.intro')}</Text>
      {!enabled && (prefs.digest || prefs.preview) && (
        <View testID="notify-off" style={styles.group}>
          <Notice icon={controlIcon('info')} message={t('notify.off')} />
          <Button testID="notify-allow" label={t('notify.allow')} onPress={() => void allow()} />
        </View>
      )}
      {failed && <Notice testID="notify-failed" icon={controlIcon('info')} message={t('settings.failed')} />}
      <View style={styles.group}>
        <Switch
          testID="notify-digest"
          label={t('settings.notify.digest')}
          description={t(prefs.saturday ? 'settings.notify.digestLineSaturday' : 'settings.notify.digestLine')}
          value={prefs.digest}
          onValueChange={change('digest')}
        />
        <Switch
          testID="notify-preview"
          label={t('settings.notify.preview')}
          description={t('settings.notify.previewLine')}
          value={prefs.preview}
          onValueChange={change('preview')}
        />
        <Switch
          testID="notify-saturday"
          label={t('settings.notify.saturday')}
          description={t('settings.notify.saturdayLine')}
          value={prefs.saturday}
          onValueChange={change('saturday')}
        />
      </View>
      <View testID="notify-quiet" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.notify.quiet')}
        </Text>
        <View accessible>
          <Text style={[styles.body, align]}>{t('settings.notify.quietDaily')}</Text>
          <Text style={[styles.body, align]}>
            {t(prefs.saturday ? 'settings.notify.quietWeekendSaturday' : 'settings.notify.quietWeekend')}
          </Text>
          <Text style={[styles.body, align]}>{t('settings.notify.quietNone')}</Text>
        </View>
      </View>
      <Notice testID="notify-no-names" icon={controlIcon('lock')} message={t('settings.notify.noNames')} />
    </ScrollView>
  );
}
