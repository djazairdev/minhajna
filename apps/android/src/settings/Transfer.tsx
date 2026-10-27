// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «نقل مباشر» from the old phone (#247, Transfer, R-3.10-17, R-5.8-10, answers
// 478, 480 and 481). Pilot builds ask for no network permission, so the
// transfer is a file: everything as the Minhajna archive, private notes
// included, in an AES-256 ZIP under a one-time key drawn as the screen opens.
// The file leaves through the share menu, as Quick Share or Bluetooth, or the
// file picker; each is recorded in the activity log, a share once its menu
// opens. The key shows as a QR code for the new phone to scan, and in six
// groups to type. It is never kept: it lives while this screen is open, and the
// file made under it is deleted as the screen closes, so a file sent stays
// useless without this screen. Screenshots are refused here, and the key
// reaches no server.

import { makeRecoveryKey, transferQr } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { canShareFiles } from '../components/device-abilities';
import { Notice } from '../components/Notice';
import { QrCode } from './QrCode';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useDocumentData } from '../documents/useDocumentData';
import { useOutputLog } from '../log/output-log';
import { safeFileName } from '../marks/export-file-rules';
import build from '../native/NativeMinhajnaBuild';
import qr from '../native/NativeMinhajnaCalendarInput';
import files from '../native/NativeMinhajnaFiles';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { useAppData } from '../storage/AppData';
import { fromHex } from '../storage/history';
import { useDeviceText } from '../text/device-text';
import { archiveFile } from './export-all-files';
import { KeyGroups } from './KeyGroups';
import { settingsStyles as styles } from './styles';

export type TransferProps = {
  /** The storage module, for the phone's random bytes. */
  readonly storage: Pick<Storage, 'randomBytes'>;
};

type Said = 'shared' | 'saved' | 'failed';

const CARRIED = ['settings.transfer.carries', 'settings.transfer.notCarried'] as const;

export function Transfer({ storage }: TransferProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const documents = useDocumentData();
  const { entries, settled } = useAppData();
  const logged = useOutputLog()('transfer', documents.day);
  const [key] = useState(() => makeRecoveryKey((length) => fromHex(storage.randomBytes(length))));
  const [rows] = useState(() => qr.qrRows(transferQr(key)));
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const shared = useRef<{ tokens: string[] }>({ tokens: [] });
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  useEffect(() => {
    const held = shared.current;
    return () => held.tokens.forEach((token) => files.dropFile(token));
  }, []);
  const made = async () => {
    await settled();
    const { version } = await build.describe();
    const file = archiveFile(documents, { entries: entries(), app: version, privateNotes: true });
    const name = safeFileName(`${t('settings.transfer.fileName')} ${documents.day}`, 'zip').replace(/\.zip$/, '');
    return files.makeZip([file.name], [file.text], name, key);
  };
  const send = (how: 'share' | 'save') => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setSaid(null);
    void (async () => {
      try {
        const token = await made();
        if (how === 'share') {
          shared.current.tokens.push(token);
          await files.shareFile(token, t('settings.transfer.shareTitle'));
        } else if (!(await files.saveFile(token))) {
          return;
        }
        logged.filed('archive');
        setSaid(how === 'share' ? 'shared' : 'saved');
      } catch {
        setSaid('failed');
      } finally {
        running.current = false;
        setBusy(false);
      }
    })();
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
      <View style={styles.group}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.transfer.sub')}
        </Text>
        <Text style={[styles.body, align]}>{t('settings.transfer.intro')}</Text>
      </View>
      <View testID="transfer-file" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.transfer.file')}
        </Text>
        {CARRIED.map((line) => (
          <Text key={line} style={[styles.body, align]}>
            {t(line)}
          </Text>
        ))}
        {canShareFiles() && (
          <>
            <Button
              testID="transfer-share"
              label={t('settings.transfer.share')}
              disabled={busy}
              onPress={() => send('share')}
            />
            <Text style={[styles.sub, align]}>{t('settings.transfer.shareLine')}</Text>
          </>
        )}
        <Button
          testID="transfer-save"
          variant={canShareFiles() ? 'line' : 'primary'}
          label={t('settings.transfer.save')}
          disabled={busy}
          onPress={() => send('save')}
        />
        <Text style={[styles.sub, align]}>{t('settings.transfer.saveLine')}</Text>
        {said !== null && (
          <Notice testID="transfer-said" icon={controlIcon('info')} message={t(`settings.transfer.said.${said}`)} />
        )}
      </View>
      <View testID="transfer-code" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.transfer.code')}
        </Text>
        <Text style={[styles.body, align]}>{t('settings.transfer.codeLine')}</Text>
        <QrCode testID="transfer-qr" rows={rows} label={t('settings.transfer.qr')} />
        <Text style={[styles.body, align]}>{t('settings.transfer.typed')}</Text>
        <KeyGroups value={key} />
      </View>
      <Text style={[styles.body, align]}>{t('settings.transfer.onNew')}</Text>
      <Notice icon={controlIcon('info')} message={t('settings.transfer.confidential')} />
      <Notice icon={controlIcon('lock')} message={t('settings.transfer.guarded')} />
    </ScrollView>
  );
}
