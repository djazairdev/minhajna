// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الإبلاغ عن مشكلة» from Help (#249, Report, R-1.5-10, R-1.5-11, answer 483):
// «ما الذي حدث؟» and «أين؟», then exactly what will be sent, every pupil's name
// in the note already replaced, with the version, Android's version and the
// last screens opened. Sharing hands the text to Android's share sheet, where
// the teacher picks the app; the screen gives contact@djazair.dev to copy. The
// app itself sends nothing, keeps no copy and logs nothing. Real screenshots
// are never asked for: a problem is shown again in the demo class. While the
// note is empty, a line says so. On a PC the text goes through the browser's
// share menu, or is copied when it has none, and the screen says whether it was
// copied; the preview can be selected to copy it by hand (#250, answers 509 and
// 523). While the browser's menu is open, the button waits. A browser has no
// Android version, so the report names the PC web app instead.

import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { onPc, useDeviceText } from '../text/device-text';
import { useBuildFacts } from './BuildFacts';
import { NOTE_LIMIT, PARTS, problemLines, safeNote, type Part } from './problem-report';
import { sendReport, type Sent } from './send-report';
import { recentSteps } from './steps';

export type ProblemReportProps = {
  /** The screens opened before Help, by name; the report's own are left out. */
  readonly steps?: readonly string[];
};

const OWN = new Set(['Help', 'ProblemReport']);

/** Android's version as people know it, such as 14; nothing on a PC, whose browser has no such constants. */
function androidVersion(): string {
  if (onPc()) return '';
  const release: unknown = (Platform.constants as { Release?: unknown }).Release;
  const version: unknown = Platform.Version;
  return typeof release === 'string' ? release : typeof version === 'number' ? String(version) : '';
}

export function ProblemReport({ steps = recentSteps() }: ProblemReportProps) {
  const t = useDeviceText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state } = useAppData();
  const build = useBuildFacts();
  const [part, setPart] = useState<Part>('today');
  const [note, setNote] = useState('');
  const [handed, setHanded] = useState<Sent | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [taken] = useState(() => steps.filter((step) => !OWN.has(step)));
  const sent = safeNote(t, note, [...state.pupils.values()]);
  const lines = problemLines(t, {
    note: sent,
    part,
    version: build.status === 'ready' ? build.value.version : '',
    android: androidVersion(),
    steps: taken,
  });
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
      <Text style={[styles.sub, align]}>{t('report.intro')}</Text>
      <TextField
        testID="report-note"
        label={t('report.note')}
        placeholder={t('report.notePlaceholder')}
        value={note}
        maxLength={NOTE_LIMIT}
        multiline
        onChangeText={setNote}
      />
      <Text style={[styles.sub, align]}>{t('report.noNames')}</Text>
      <ChipGroup
        testID="report-part"
        label={t('report.part')}
        choices={PARTS.map((value) => ({ value, label: t(`report.parts.${value}`) }))}
        selected={part}
        onSelect={setPart}
      />
      <View testID="report-preview" accessible style={[styles.card, { gap: spacing['space-4'] }]}>
        <Text style={[styles.sub, align]}>{t('report.preview')}</Text>
        {lines.map((line, index) => (
          <Text key={index} selectable={onPc()} style={[styles.body, align]}>
            {line}
          </Text>
        ))}
      </View>
      <Text style={[styles.sub, align]}>{t('report.demo')}</Text>
      <Text selectable style={[styles.body, align]}>
        {t('report.sendTo')}
      </Text>
      {sent === '' && (
        <Text testID="report-needs" style={[styles.sub, align]}>
          {t('report.needsNote')}
        </Text>
      )}
      <Button
        testID="report-share"
        label={t('report.share')}
        disabled={sent === '' || build.status === 'loading' || busy}
        onPress={() => {
          if (pending.current) return;
          pending.current = true;
          setBusy(true);
          setHanded(null);
          void sendReport(lines.join('\n'), t('report.title')).then((how) => {
            pending.current = false;
            setBusy(false);
            setHanded(how);
          });
        }}
      />
      {(handed === 'copied' || handed === 'failed') && (
        <Text testID={`report-${handed}`} accessibilityLiveRegion="polite" style={[styles.body, align]}>
          {t(handed === 'copied' ? 'report.copied' : 'report.copyFailed')}
        </Text>
      )}
      <Text style={[styles.sub, align]}>{t('report.offline')}</Text>
    </ScrollView>
  );
}
