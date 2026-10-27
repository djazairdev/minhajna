// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «استرجاع البيانات» (#247, Restore, R-5.8-10, R-5.8-11, R-5.8-12, R-5.9-02,
// R-6.5-01, answers 478 to 480), reached only from the welcome's
// «لديّ نسخة من هاتف آخر», once the PIN is set, into the empty history. Three
// routes open in the pilot: the old phone in hand, its transfer file, then its
// one-time key, scanned from its QR code, the camera asked then, or typed; a
// backup file, then the recovery key; both keys typed with no keyboard
// suggestions; and «فتح أرشيف «منهاجنا»», the export file with its password if
// it has one. The sync account shows, not open yet. The file comes through the
// system's file picker, from this phone, an SD card or a USB key only, as the
// screen says (#477); what does not come back, the teacher card's personal
// fields and the drawn signature, is said before. A key that does not open the
// file, or any other refusal, is said under the button, and the key can be
// typed again; a changed file has its own page. Once all of it is stored, the
// backup reminder is put off 30 days from the restore (answer 482), and the
// history opens again, on Today. The copy of the picked file is dropped as soon
// as it is not needed: on another file or route, once restored, and when the
// screen closes.

import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canScan } from '../components/device-abilities';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { errorCode } from '../lock/lock-rules';
import files from '../native/NativeMinhajnaFiles';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { putOffFromRestore } from '../settings/backup-later';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { nativeDeps } from '../storage/history';
import { useDeviceText } from '../text/device-text';
import { restoreFile, zipProblem, type RestoreProblem, type RestoreRoute } from './restore-run';
import { RestoreFail } from './RestoreFail';
import { scanKey } from './scan-key';

export type RestoreProps = {
  /** The storage module: SHA-256, random bytes and the restore itself. */
  readonly storage: Pick<Storage, 'digest' | 'randomBytes' | 'restoreHistory'>;
  /** Everything was stored; the history opens again. */
  readonly onRestored: () => void;
};

type Picked = { readonly token: string; readonly name: string };
type Shown = RestoreProblem | 'noFile' | 'qr' | 'camera' | 'scan';

const LEFT = ['settings.restore.personal', 'settings.restore.signature'] as const;

const WORDS = {
  phone: { pick: 'pickPhone', secret: 'code', placeholder: 'settings.recovery.placeholder' },
  backup: { pick: 'pickBackup', secret: 'key', placeholder: 'settings.recovery.placeholder' },
  archive: { pick: 'pickArchive', secret: 'password', placeholder: 'settings.restore.passwordHint' },
} as const;

export function Restore({ storage, onRestored }: RestoreProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { profile, today } = useAppData();
  const [route, setRoute] = useState<RestoreRoute>('phone');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [secret, setSecret] = useState('');
  const [problem, setProblem] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const kept = useRef<{ token: string | null }>({ token: null });
  useEffect(() => {
    const held = kept.current;
    return () => {
      if (held.token !== null) files.dropFile(held.token);
    };
  }, []);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const drop = () => {
    if (kept.current.token !== null) files.dropFile(kept.current.token);
    kept.current.token = null;
    setPicked(null);
  };
  const choose = (next: RestoreRoute | 'sync') => {
    if (next === 'sync') return;
    drop();
    setRoute(next);
    setSecret('');
    setProblem(null);
  };
  const pick = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const file = await files.openZip();
      if (file !== null) {
        drop();
        kept.current.token = file.token;
        setPicked(file);
        setProblem(null);
      }
    } catch (error: unknown) {
      setProblem(zipProblem(errorCode(error), { route, secret }));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const scan = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    const scanned = await scanKey({
      title: t('settings.restore.scanTitle'),
      instruction: t('settings.restore.scanLine'),
      cancel: t('settings.restore.scanCancel'),
      rtl: direction === 'rtl',
    });
    running.current = false;
    setBusy(false);
    if (scanned === null) return;
    if ('key' in scanned) {
      setSecret(scanned.key);
      setProblem(null);
    } else {
      setProblem(scanned.problem);
    }
  };
  const restore = async () => {
    if (running.current) return;
    if (picked === null) return setProblem('noFile');
    running.current = true;
    setBusy(true);
    setProblem(null);
    const result = await restoreFile(
      { route, token: picked.token, secret, country: profile.code, day: today() },
      { files, storage, deps: nativeDeps(storage) },
    ).catch(() => ({ ok: false, problem: 'failed' }) as const);
    if (result.ok) {
      drop();
      putOffFromRestore(today());
      onRestored();
      return;
    }
    running.current = false;
    setBusy(false);
    setProblem(result.problem);
  };
  if (problem === 'changed') {
    return (
      <RestoreFail
        route={route}
        onAgain={() => {
          drop();
          setProblem(null);
        }}
      />
    );
  }
  const keyed = route !== 'archive';
  const words = WORDS[route];
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
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
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.restore.sub')}
        </Text>
        <Text style={[styles.body, align]}>{t('settings.restore.line')}</Text>
      </View>
      <RadioCardGroup
        testID="restore-route"
        label={t('settings.restore.routes')}
        selected={route}
        onSelect={choose}
        disabled={busy}
        choices={[
          { value: 'phone', label: t('settings.restore.phone'), description: t('settings.restore.phoneLine') },
          { value: 'backup', label: t('settings.restore.backup'), description: t('settings.restore.backupLine') },
          { value: 'archive', label: t('settings.restore.archive'), description: t('settings.restore.archiveLine') },
          {
            value: 'sync',
            label: t('settings.restore.sync'),
            description: t('settings.restore.syncLine'),
            disabled: true,
          },
        ]}
      />
      <View style={styles.card}>
        {route === 'phone' && <Text style={[styles.body, align]}>{t('settings.restore.phoneHow')}</Text>}
        {picked !== null && (
          <Text testID="restore-picked" style={[styles.body, align]}>
            {picked.name === ''
              ? t('settings.restore.pickedNoName')
              : t('settings.restore.picked', { name: picked.name })}
          </Text>
        )}
        <Button
          testID="restore-pick"
          variant="line"
          disabled={busy}
          label={t(`settings.restore.${picked !== null ? 'pickOther' : words.pick}`)}
          onPress={() => void pick()}
        />
        <Text testID="restore-local" style={[styles.sub, align]}>
          {t('settings.restore.local')}
        </Text>
        <TextField
          testID="restore-secret"
          label={t(`settings.restore.${words.secret}`)}
          placeholder={t(words.placeholder)}
          value={secret}
          onChangeText={(text) => {
            setSecret(text);
            if (problem !== 'noFile') setProblem(null);
          }}
          maxLength={keyed ? 48 : 64}
          textDirection="ltr"
          autoCapitalize={keyed ? 'characters' : 'none'}
          keyboardType={keyed ? 'visible-password' : undefined}
          autoCorrect={false}
          autoComplete="off"
          importantForAutofill="no"
          editable={!busy}
        />
        {!keyed && <Text style={[styles.sub, align]}>{t('settings.restore.passwordLine')}</Text>}
        {route === 'phone' && canScan() && (
          <Button
            testID="restore-scan"
            variant="line"
            disabled={busy}
            label={t('settings.restore.scan')}
            onPress={() => void scan()}
          />
        )}
        {route === 'phone' && canScan() && <Text style={[styles.sub, align]}>{t('settings.restore.camera')}</Text>}
      </View>
      <View testID="restore-left" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.restore.notBack')}
        </Text>
        {LEFT.map((line) => (
          <Text key={line} style={[styles.body, align]}>
            {t(line)}
          </Text>
        ))}
      </View>
      {route === 'backup' && <Notice icon={controlIcon('lock')} message={t('settings.restore.noKey')} />}
      {problem !== null && (
        <Notice
          testID="restore-problem"
          icon={controlIcon('info')}
          message={t(
            problem === 'noFile' ? 'settings.restore.problems.noFile' : `settings.restore.problems.${problem}`,
          )}
        />
      )}
      <Button testID="restore-run" label={t('settings.restore.run')} disabled={busy} onPress={() => void restore()} />
    </ScrollView>
  );
}
