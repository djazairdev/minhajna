// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A statement kept in reader mode, as R-Open shows it (#246, answer 489): its
// signature checked, the day it came and how, whether the school's picture
// leaves it out as misdated, whether it is the first under its key or from the
// teacher who sent an earlier one, the teacher by the name the reader gave or
// unnamed, then its fields, its pack's edition, the key's fingerprint, and that
// it holds no pupil data and stays on the reader's own devices.

import { inPicture, teacherNames, type Received } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { fingerprintText } from '../calendar/UpdateDetails';
import { frontDate } from '../documents/front-tables';
import { settingsStyles as styles } from '../settings/styles';
import { StatementFields } from '../sharing/StatementFields';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { readerLines, senderLine, teacherLabel } from './reader-words';
import { TeacherNameForm } from './TeacherNameForm';
import { useFingerprints } from './useFingerprints';

export function ReaderStatement({ one, list }: { readonly one: Received; readonly list: readonly Received[] }) {
  const t = useText();
  const { direction } = useLocale();
  const { profile, packs, entries } = useAppData();
  const [naming, setNaming] = useState(false);
  const fingerprint = useFingerprints([one.spki]).get(one.spki) ?? null;
  const names = teacherNames(entries());
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const teacher = teacherLabel(t, names, one.spki, fingerprint);
  return (
    <>
      <View testID="reader-checked" style={[styles.card, { gap: spacing['space-8'] }]}>
        <View style={{ flexDirection: 'row', direction }}>
          <Badge variant="done" label={t('reader.valid')} />
        </View>
        <Text style={[styles.body, align]}>{t('reader.validBody')}</Text>
        <Text testID="reader-sender" style={[styles.body, align]}>
          {senderLine(t, list, one)}
        </Text>
        <Text style={[styles.sub, align]}>
          {t('reader.kept', { day: frontDate(one.day), how: t(`reader.how.${one.how}`) })}
        </Text>
      </View>
      {!inPicture(one) && <Notice testID="reader-left-out" icon={controlIcon('info')} message={t('reader.leftOut')} />}
      {naming ? (
        <TeacherNameForm spki={one.spki} named={names.get(one.spki)} onDone={() => setNaming(false)} />
      ) : (
        <Button
          testID="reader-name-open"
          variant="line"
          label={t(names.has(one.spki) ? 'reader.rename' : 'reader.name')}
          onPress={() => setNaming(true)}
        />
      )}
      <StatementFields lines={readerLines(t, profile, packs, one.statement, teacher)} />
      <Text style={[styles.sub, align]}>{t('reader.key')}</Text>
      <Text testID="reader-fingerprint" selectable style={[styles.body, align]}>
        {fingerprint === null ? '…' : fingerprintText(fingerprint)}
      </Text>
      <Text style={[styles.sub, align]}>{t('reader.noPupils')}</Text>
      <Text style={[styles.sub, align]}>{t('reader.onPhone')}</Text>
    </>
  );
}
