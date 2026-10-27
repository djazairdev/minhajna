// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's first-run install page (#250, Devices-join-install, R-6.6-05,
// answer 512), before the passphrase, shown only while the browser offers
// installing the app: what installing gives, «تثبيت «منهاجنا»», which opens
// the browser's own dialog, and «لاحقاً». Once installed, it says where the
// app opens from, and «متابعة» goes on to the passphrase here. The board's
// step that adds the PC to the teacher's devices is the welcome's copy or
// setup (answer 504), so the page names the two steps left.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { colors, typography } from '../../design/tokens';
import { useText } from '../../text/i18n';
import { WebLockPage } from './WebLockPage';

/** Offering, waiting for the browser's dialog, or installed. */
export type InstallStage = 'ask' | 'asking' | 'installed';

export type InstallOfferProps = {
  readonly stage: InstallStage;
  readonly onInstall: () => void;
  /** «لاحقاً», or «متابعة» once installed. */
  readonly onNext: () => void;
  /** Back to the welcome. */
  readonly onBack?: () => void;
};

export function InstallOffer({ stage, onInstall, onNext, onBack }: InstallOfferProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const facts = [t('lock.web.install.package'), t('lock.web.install.offline'), t('lock.web.kept')];
  if (stage === 'installed') {
    return (
      <WebLockPage title={t('lock.web.install.done')} facts={facts}>
        <Text style={[styles.line, align]}>{t('lock.web.install.opens')}</Text>
        <Button testID="install-next" label={t('lock.web.create.submit')} onPress={onNext} />
      </WebLockPage>
    );
  }
  return (
    <WebLockPage title={t('lock.web.install.title')} facts={facts}>
      <Text style={[styles.line, align]}>{t('lock.web.install.line')}</Text>
      <Button
        testID="install-app"
        label={t('lock.web.install.submit')}
        onPress={onInstall}
        disabled={stage === 'asking'}
      />
      <Text style={[styles.note, align]}>{t('lock.web.install.asks')}</Text>
      <Button
        testID="install-later"
        variant="line"
        label={t('lock.web.install.later')}
        onPress={onNext}
        disabled={stage === 'asking'}
      />
      <Text style={[styles.note, align]}>{t('lock.web.install.next')}</Text>
      {onBack !== undefined && (
        <Button
          testID="install-back"
          variant="line"
          label={t('lock.web.back')}
          onPress={onBack}
          disabled={stage === 'asking'}
        />
      )}
    </WebLockPage>
  );
}

const styles = StyleSheet.create({
  line: { ...typography.body, color: colors.ink },
  note: { ...typography.small, color: colors.ink2 },
});
