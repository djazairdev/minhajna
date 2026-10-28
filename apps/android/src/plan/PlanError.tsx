// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الإبلاغ عن خطأ في المخطط» (#225, Plan-error, R-4.3-01 to R-4.3-03): the
// kind of error and the teacher's note, then exactly what will be sent,
// the pack and item IDs, the release, the kind, the note and a name only
// if the teacher asks for credit and types it. Sharing hands the text to
// Android's share sheet, where the teacher picks the app; on a PC to the
// browser's share menu, else the clipboard, as Help's report (answer 523).
// The screen says to send it to contact@djazair.dev (answers 287, 290), an
// address the teacher can copy. The app itself sends nothing, and adds
// nothing about the class, school or pupils. While the report cannot be
// shared, a line says what it still needs.

import { type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Switch } from '../components/Switch';
import { TextField } from '../components/TextField';
import { spacing } from '../design/tokens';
import { sendReport, type Sent } from '../help/send-report';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { onPc, useDeviceText } from '../text/device-text';
import { ERROR_KINDS, NAME_LIMIT, NOTE_LIMIT, plain, ready, reportLines, type ErrorKind } from './error-report';
import { isAdded, itemPage } from './item-rules';

export type PlanErrorProps = {
  readonly courseId: string;
  readonly itemId: string;
};

export function PlanError({ courseId, itemId }: PlanErrorProps) {
  const t = useDeviceText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const day: Day = today();
  const page = useMemo(
    () => itemPage(coreContext({ profile, year, calendar, calendarRelease, packs, state }), courseId, itemId, day),
    [profile, year, calendar, calendarRelease, packs, state, courseId, itemId, day],
  );
  const [kind, setKind] = useState<ErrorKind>('title');
  const [note, setNote] = useState('');
  const [credit, setCredit] = useState(false);
  const [name, setName] = useState('');
  const [handed, setHanded] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  if (page === null || isAdded(page.row.item)) {
    return (
      <View style={styles.screen}>
        <Text style={[styles.body, align, { padding: spacing['space-16'] }]}>{t('planError.gone')}</Text>
      </View>
    );
  }
  const report = { pack: page.pack, item: page.row.item, kind, note, name: credit ? name : undefined };
  const lines = reportLines(t, report);
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
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {page.row.item.title}
      </Text>
      <ChipGroup
        testID="error-kind"
        label={t('planError.kind')}
        choices={ERROR_KINDS.map((value) => ({ value, label: t(`planError.kinds.${value}`) }))}
        selected={kind}
        onSelect={setKind}
      />
      <TextField
        testID="error-note"
        label={t('planError.note')}
        placeholder={t('planError.notePlaceholder')}
        value={note}
        maxLength={NOTE_LIMIT}
        multiline
        onChangeText={(value) => setNote(plain(value))}
      />
      <Switch testID="error-credit" label={t('planError.credit')} value={credit} onValueChange={setCredit} />
      {credit && (
        <TextField
          testID="error-name"
          label={t('planError.name')}
          placeholder={t('planError.namePlaceholder')}
          value={name}
          maxLength={NAME_LIMIT}
          onChangeText={(value) => setName(plain(value).replace(/[\r\n]+/g, ' '))}
        />
      )}
      <View testID="error-preview" accessible style={[styles.card, { gap: spacing['space-4'] }]}>
        <Text style={[styles.sub, align]}>{t('planError.preview')}</Text>
        {lines.map((line, index) => (
          <Text key={index} selectable={onPc()} style={[styles.body, align]}>
            {line}
          </Text>
        ))}
      </View>
      <Text style={[styles.sub, align]}>{t('planError.never')}</Text>
      <Text selectable style={[styles.body, align]}>
        {t('planError.sendTo')}
      </Text>
      {!ready(report) && (
        <Text testID="error-needs" style={[styles.sub, align]}>
          {note.trim() === '' ? t('planError.needsNote') : t('planError.needsName')}
        </Text>
      )}
      <Button
        testID="error-share"
        label={t('planError.share')}
        disabled={!ready(report) || busy}
        onPress={() => {
          if (pending.current) return;
          pending.current = true;
          setBusy(true);
          setHanded(null);
          void sendReport(lines.join('\n'), t('planError.title')).then((how) => {
            pending.current = false;
            setBusy(false);
            setHanded(how);
          });
        }}
      />
      {(handed === 'copied' || handed === 'failed') && (
        <Text testID={`error-${handed}`} accessibilityLiveRegion="polite" style={[styles.body, align]}>
          {t(handed === 'copied' ? 'report.copied' : 'report.copyFailed')}
        </Text>
      )}
      <Text style={[styles.sub, align]}>{t('planError.offline')}</Text>
    </ScrollView>
  );
}
