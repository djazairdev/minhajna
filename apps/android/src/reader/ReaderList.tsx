// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «البيانات المستلمة» (#246, answer 489): every statement kept in reader mode,
// the latest statement day first, each by its class, subject and day, with its
// teacher by name or unnamed, and marked when the picture leaves it out; one
// opens as R-Open shows it, «فتح بيان» opens another, and «صورة المؤسسة» shows
// them by grade. Nothing here leaves the reader's own devices.

import { compareDays, inPicture, receivedStatements, teacherNames } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { frontDate } from '../documents/front-tables';
import { settingsStyles as styles } from '../settings/styles';
import { statementClass } from '../sharing/statement-lines';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { teacherLabel } from './reader-words';
import { useFingerprints } from './useFingerprints';

export function ReaderList({
  onOpen,
  onPicture,
}: {
  readonly onOpen: (id?: string) => void;
  readonly onPicture: () => void;
}) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { entries, profile } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const list = receivedStatements(entries());
  const names = teacherNames(entries());
  const fingerprints = useFingerprints(list.map((one) => one.spki));
  const shown = list
    .map((one, index) => ({ one, index }))
    .sort((a, b) => compareDays(b.one.statement.day, a.one.statement.day) || b.index - a.index)
    .map(({ one }) => one);
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
      <Text style={[styles.sub, align]}>{t('reader.onPhone')}</Text>
      <Button testID="reader-open" label={t('reader.open')} onPress={() => onOpen()} />
      <Button testID="reader-picture" variant="line" label={t('reader.picture.title')} onPress={onPicture} />
      <Text testID="reader-count" style={[styles.title, align]}>
        {list.length === 0 ? t('reader.none') : t('reader.count', { count: list.length })}
      </Text>
      {shown.map((one) => (
        <RowLink
          key={one.id}
          testID={`reader-received-${one.id}`}
          icon={controlIcon('info')}
          title={`${statementClass(profile, one.statement)} · ${frontDate(one.statement.day)}`}
          description={[
            teacherLabel(t, names, one.spki, fingerprints.get(one.spki) ?? null),
            ...(inPicture(one) ? [] : [t('reader.leftOutShort')]),
          ].join(' · ')}
          onPress={() => onOpen(one.id)}
        />
      ))}
    </ScrollView>
  );
}
