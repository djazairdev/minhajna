// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RadioCard } from '../components/RadioCard';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { catalogues, chooseLanguage, currentLanguage, LANGUAGES, type Language as LanguageCode } from '../text/i18n';
import { settingsStyles as styles } from './styles';

/** A local preview first; saving alone changes the phone's language and, when needed, restarts its direction. */
export function Language({ onDone }: { onDone: () => void }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<LanguageCode>(currentLanguage);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const waiting = useRef(false);
  const mounted = useRef(true);
  const { allSaved } = useAppData();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const save = async () => {
    if (waiting.current) return;
    waiting.current = true;
    setBusy(true);
    setFailed(false);
    const restart = LANGUAGES[selected].rightToLeft !== LANGUAGES[currentLanguage()].rightToLeft;
    try {
      const saved = restart ? await allSaved() : true;
      if (!mounted.current) return;
      if (!saved) {
        setFailed(true);
        return;
      }
      chooseLanguage(selected);
      if (!restart) onDone();
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      waiting.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Text style={[styles.sub, align]}>{t('settings.languageIntro')}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.rows.language')} style={styles.group}>
          {(Object.keys(catalogues) as LanguageCode[]).map((code) => (
            <RadioCard
              key={code}
              testID={`settings-language-${code}`}
              label={catalogues[code].language[code]}
              description={[
                catalogues[code].navigation.today,
                catalogues[code].entry.confirm,
                catalogues[code].navigation.classes,
              ].join(' · ')}
              selected={selected === code}
              disabled={busy}
              onPress={() => setSelected(code)}
            />
          ))}
        </View>
        <View
          testID="language-preview"
          style={[styles.card, { direction: LANGUAGES[selected].rightToLeft ? 'rtl' : 'ltr' }]}
        >
          <Text style={[styles.body, { writingDirection: LANGUAGES[selected].rightToLeft ? 'rtl' : 'ltr' }]}>
            {catalogues[selected].navigation.today} · {catalogues[selected].entry.confirm} ·{' '}
            {catalogues[selected].navigation.classes}
          </Text>
        </View>
        <Text style={[styles.sub, align]}>{t('settings.languageDirection')}</Text>
        <Notice icon={controlIcon('globe')} message={t('settings.languageDocuments')} />
        {failed && <Notice testID="language-failed" icon={controlIcon('info')} message={t('settings.failed')} />}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="settings-language-save" label={t('settings.save')} disabled={busy} onPress={save} />
      </View>
    </View>
  );
}
