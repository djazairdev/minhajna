// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's update on Today (#250, Web-update, R-6.6-06, answers 516
// and 517). At each opening, a newer build on the server shows as «تحديث
// متاح»: its version, what changed in the interface's language, and its
// build checksum beside the current one's, to compare with the published
// ones; «تثبيت التحديث» installs it, and «لاحقاً» leaves the current build
// running, with a line that the update waits and is offered again at the
// next opening. Once installed, the app reloads, and after the passphrase
// Today says which version was installed, that the data is as it was, and,
// once the history holds it, that the activity log has it. A failure, and
// the install while it runs, show on either card, the second announced.
// Nothing shows offline, or before the build's facts are read; a phone has
// no such card (`takesUpdates`).

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { grouped, useBuildFacts } from '../help/BuildFacts';
import { useAppUpdate } from '../settings/update-offer';
import { currentLanguage, useText } from '../text/i18n';

export function TodayAppUpdate() {
  const t = useText();
  const { direction } = useLocale();
  const facts = useBuildFacts();
  const { offer, done, state, install } = useAppUpdate();
  const [later, setLater] = useState(false);
  const [seen, setSeen] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const checksum = (label: string, hex: string) => (
    <>
      <Text style={[styles.note, align]}>{label}</Text>
      <Text selectable style={[styles.code, { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' }]}>
        {grouped(hex)}
      </Text>
    </>
  );
  if (done !== null && !seen) {
    return (
      <View testID="today-app-updated" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('appUpdate.done', { version: done.version })}
        </Text>
        {checksum(t('appUpdate.build', { version: done.version }), done.sha256)}
        <Text style={[styles.body, align]}>{t('appUpdate.same')}</Text>
        {done.logged && <Text style={[styles.note, align]}>{t('appUpdate.logged')}</Text>}
        <Button
          testID="today-app-updated-ok"
          variant="line"
          label={t('appUpdate.continue')}
          onPress={() => setSeen(true)}
        />
      </View>
    );
  }
  if (offer === null || facts.status !== 'ready') return null;
  const current = facts.value;
  const installing = state === 'installing';
  const status = (
    <>
      {state === 'failed' && (
        <Notice
          testID="today-app-update-failed"
          icon={controlIcon('info')}
          message={t('appUpdate.failed', { current: current.version })}
        />
      )}
      {installing && (
        <Text accessibilityLiveRegion="polite" style={[styles.note, align]}>
          {t('appUpdate.installing')}
        </Text>
      )}
    </>
  );
  if (later) {
    return (
      <View testID="today-app-update-waiting" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('appUpdate.waitingTitle')}
        </Text>
        <Text style={[styles.body, align]}>
          {t('appUpdate.waiting', { version: offer.version, current: current.version })}
        </Text>
        {status}
        <Button
          testID="today-app-update-now"
          variant="line"
          label={t('appUpdate.installNow')}
          disabled={installing}
          onPress={() => install(offer.sha256)}
        />
      </View>
    );
  }
  const language = currentLanguage();
  const notes = offer.notes[language === 'fr' || language === 'en' ? language : 'ar'];
  return (
    <View testID="today-app-update" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('appUpdate.title')}
      </Text>
      <Text style={[styles.body, align]}>
        {t('appUpdate.line', { version: offer.version, current: current.version })}
      </Text>
      {notes.length > 0 && (
        <View testID="today-app-update-notes" style={styles.notes}>
          <Text style={[styles.label, align]}>{t('appUpdate.changed')}</Text>
          {notes.map((line, at) => (
            <Text key={at} style={[styles.body, align]}>
              {t('appUpdate.note', { line })}
            </Text>
          ))}
        </View>
      )}
      {checksum(t('appUpdate.build', { version: offer.version }), offer.sha256)}
      {checksum(t('appUpdate.current', { version: current.version }), current.apkSha256)}
      <Text style={[styles.note, align]}>{t('appUpdate.compare')}</Text>
      {status}
      <Button
        testID="today-app-update-install"
        label={t('appUpdate.install')}
        disabled={installing}
        onPress={() => install(offer.sha256)}
      />
      <Button
        testID="today-app-update-later"
        variant="line"
        label={t('appUpdate.later')}
        disabled={installing}
        onPress={() => setLater(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  notes: { gap: spacing['space-4'] },
  title: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  code: { ...typography.caption, color: colors.ink },
});
