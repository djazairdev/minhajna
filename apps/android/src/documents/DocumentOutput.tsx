// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A document's output (#212, Doc-output, Doc-output-pupils): as recorded or
// blank with its headings (R-3.1-10), then Android's print screen, or a PDF
// saved where the teacher picks through the system's file picker. A document
// with pupils' data says that «داخلي · سري» is on every page (R-5.9-15). The
// teacher's box carries the drawn signature while it is in use, unless the
// teacher picks «فارغة» for this output; otherwise it stays blank, to sign
// by hand (R-3.8-42, #236, answer 412); while it carries the signature, a
// line under the buttons says whoever gets the PDF can copy it (R-3.8-46,
// answer 415). A password on the PDF comes later.
// The pages are made from the record book when a button is pressed, so they
// hold the latest entries. A document of a month prints the month it was
// opened for, as the texts book's pages in the app open it (#213), or else
// the current one; the screen says which. The journal chooses its day,
// starting on the school year's nearest day when today is outside it, and
// whether it is kept for all classes or one per class (#216); a screen that
// opens it can start it on a layout, such as «التوزيعات»'s tab (#237). What
// was said of the last file goes once a choice changes.

import { useState } from 'react';
import type { Day } from '@minhajna/core';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@react-navigation/native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { fileName, type DocumentKind } from './catalogue';
import { DayStep } from './DayStep';
import { useDocumentData } from './useDocumentData';
import { useAppData } from '../storage/AppData';
import { useOutputRun } from './output-run';
import { CopyWarning, drawnNote, SignatureChoice, useSignatureInUse } from './SignatureChoice';

/** Prints or saves one document, for the period of `day` when given, else today's. */
export function DocumentOutput({
  kind,
  day,
  layout: chosen,
  onSignature,
}: {
  readonly kind: DocumentKind;
  readonly day?: Day;
  /** The layout to start on, such as the tab a screen opened it from; the first when not given or unknown. */
  readonly layout?: string;
  readonly onSignature?: () => void;
}) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { today, year } = useAppData();
  const [on, setOn] = useState(() => {
    const start = day ?? today();
    if (!kind.byDay) return start;
    return start < year.from ? year.from : start > year.to ? year.to : start;
  });
  const data = useDocumentData(on);
  const layouts = kind.layouts?.(t) ?? [];
  const [layout, setLayout] = useState(layouts.find((one) => one.value === chosen)?.value ?? layouts[0]?.value);
  const [blank, setBlank] = useState(false);
  const [drawn, setDrawn] = useState(true);
  const inUse = useSignatureInUse();
  const signs = kind.drawn !== undefined && inUse && drawn && !blank;
  const { busy, said, print, save, clear } = useOutputRun();
  const empty = kind.empty(data);
  const blankLine = kind.blankLine(t);
  const html = () => kind.pages({ ...data, drawn }, t, blank, layout);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <Text testID="output-period" style={styles.period}>
        {kind.line(data, t)}
      </Text>
      {kind.byDay && (
        <DayStep
          day={data.day}
          first={data.year.from}
          last={data.year.to}
          disabled={busy}
          profile={data.profile}
          onDay={(next) => {
            setOn(next);
            clear();
          }}
        />
      )}
      {layout !== undefined && (
        <RadioCardGroup
          testID="output-layout"
          label={kind.layoutLabel?.(t) ?? t('documents.output.layout')}
          selected={layout}
          disabled={busy}
          onSelect={(next) => {
            setLayout(next);
            clear();
          }}
          choices={layouts}
        />
      )}
      {blankLine !== null && (
        <RadioCardGroup
          testID="output-version"
          label={t('documents.output.version')}
          selected={blank ? 'blank' : 'recorded'}
          disabled={busy}
          onSelect={(value) => {
            setBlank(value === 'blank');
            clear();
          }}
          choices={[
            {
              value: 'recorded',
              label: t('documents.output.recorded'),
              description: t('documents.output.recordedLine'),
            },
            { value: 'blank', label: t('documents.output.blank'), description: blankLine },
          ]}
        />
      )}
      {kind.pupils && (
        <Notice
          testID="output-confidential"
          variant="notice"
          badge={t('documents.confidential')}
          message={t('documents.output.confidentialLine')}
        />
      )}
      {kind.drawn !== undefined && (
        <SignatureChoice
          testID="output-signature"
          label={t('documents.output.signatureChoice')}
          drawn={drawn}
          disabled={busy}
          onDrawn={(next) => {
            setDrawn(next);
            clear();
          }}
          onSettings={onSignature}
        />
      )}
      <Notice
        testID="output-signature-line"
        icon={controlIcon('info')}
        message={signs ? drawnNote(t, [kind.id]) : kind.signatureLine(t)}
      />
      {empty && <Notice testID="output-empty" icon={controlIcon('info')} message={kind.emptyLine(t)} />}
      {said !== null && (
        <Notice
          testID="output-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
      <View style={styles.actions}>
        <Button
          testID="output-print"
          label={t('documents.output.print')}
          disabled={busy || empty}
          onPress={() => print(html, kind.title(t), kind.landscape)}
        />
        <Button
          testID="output-save"
          variant="line"
          label={t('documents.output.save')}
          disabled={busy || empty}
          onPress={() => save(html, `document-${kind.id}`, fileName(kind, data, t, blank, layout), kind.landscape)}
        />
      </View>
      <CopyWarning testID="output-copy" shown={signs} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  period: { ...typography.body, color: colors.pencil },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  actions: { gap: spacing['space-10'], paddingTop: spacing['space-8'] },
});
