// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «فتح بيان» in reader mode (#246, R-Open, answer 489, R-5.5-07, R-5.9-18): a
// teacher's statement opened from its QR code or its file, signed or PDF, with
// no account. One whose signature checks is shown as checked at once and kept,
// the same signed text once, even when opened again before it is saved; one
// changed after it was issued, of another kind, a PDF without its link or from
// a newer version of the app says so and is never kept, as does one signed in
// a demo world, or inside a world one signed elsewhere (#563). Opened for a
// statement already kept, it shows that one, or says it is no longer here.

import { receivedStatements, receiveStatement, storeWorld, type Received } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canScan } from '../components/device-abilities';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { ReaderStatement } from './ReaderStatement';
import { useStatementInput, type OpenedStatement } from './useStatementInput';

type Problem = Extract<OpenedStatement, { ok: false }>['problem'];

export type ReaderOpenProps = {
  /** A statement already kept, by its ID; none to open a new one. */
  readonly id?: string;
  readonly onList: () => void;
  /** Opens a kept statement's spot-check sheet (#246, answer 491). */
  readonly onSpot?: (id: string) => void;
};

export function ReaderOpen({ id, onList, onSpot }: ReaderOpenProps) {
  const t = useDeviceText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { entries, record, newId, today } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const kept = useRef(new Map<string, Received>());
  const [shown, setShown] = useState<{ readonly received: Received } | { readonly problem: Problem } | null>(null);
  const opened = (result: OpenedStatement) => {
    if (!result.ok) return setShown({ problem: result.problem });
    const { text, how, spki, statement } = result;
    const known = receivedStatements(entries()).find((one) => one.text === text) ?? kept.current.get(text);
    if (known !== undefined) return setShown({ received: known });
    const received = { id: newId(), day: today(), how, text, spki, statement };
    const event = receiveStatement(entries(), text, result, how, received.id);
    kept.current.set(text, received);
    if (event !== null) record(event);
    setShown({ received });
  };
  const input = useStatementInput(opened);
  const list = receivedStatements(entries());
  const one =
    id !== undefined
      ? list.find((candidate) => candidate.id === id)
      : shown !== null && 'received' in shown
        ? (list.find((candidate) => candidate.text === shown.received.text) ?? shown.received)
        : undefined;
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
      {id === undefined && (
        <>
          <Text style={[styles.body, align]}>{t('reader.intro')}</Text>
          <View style={{ gap: spacing['space-8'] }}>
            {canScan() && (
              <Button
                testID="reader-scan"
                label={t('reader.scan')}
                disabled={input.busy}
                onPress={() => void input.read('qr')}
              />
            )}
            <Button
              testID="reader-file"
              variant={canScan() ? 'line' : 'primary'}
              label={t('reader.file')}
              disabled={input.busy}
              onPress={() => void input.read('file')}
            />
          </View>
          {input.busy && <Text style={[styles.sub, align]}>{t('reader.reading')}</Text>}
        </>
      )}
      {shown !== null && 'problem' in shown && (
        <>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('reader.problemTitle')}
          </Text>
          <Notice
            testID="reader-refused"
            icon={controlIcon('info')}
            message={t(
              shown.problem === 'world' && storeWorld(entries()) !== null
                ? 'reader.problems.otherWorld'
                : `reader.problems.${shown.problem}`,
            )}
          />
        </>
      )}
      {id !== undefined && one === undefined && (
        <Text testID="reader-gone" style={[styles.body, align]}>
          {t('reader.gone')}
        </Text>
      )}
      {one !== undefined && (
        <ReaderStatement
          key={one.id}
          one={one}
          list={list}
          {...(onSpot !== undefined && { onSpot: () => onSpot(one.id) })}
        />
      )}
      <Button testID="reader-list" variant="plain" label={t('reader.back')} onPress={onList} />
    </ScrollView>
  );
}
