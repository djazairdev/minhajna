// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A document's output (#212, Doc-output, Doc-output-pupils): as recorded or
// blank with its headings (R-3.1-10), then Android's print screen, or a PDF
// saved where the teacher picks through the system's file picker. A document
// with pupils' data says that «داخلي · سري» is on every page (R-5.9-15). The
// teacher's box stays blank, to sign by hand (R-3.8-42); the drawn signature
// and a password on the PDF come later. The pages are made from the record
// book when a button is pressed, so they hold the latest entries. A
// document of a month prints the month it was opened for, as the texts
// book's pages in the app open it (#213), or else the current one; the
// screen says which.

import { useEffect, useRef, useState } from 'react';
import type { Day } from '@minhajna/core';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@react-navigation/native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import pdf from '../native/NativeMinhajnaPdf';
import { useText } from '../text/i18n';
import { fileName, type DocumentKind } from './catalogue';
import { useDocumentData } from './useDocumentData';

type Said = 'saved' | 'failed' | null;

/** Prints or saves one document, for the period of `day` when given, else today's. */
export function DocumentOutput({ kind, day }: { readonly kind: DocumentKind; readonly day?: Day }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useDocumentData(day);
  const [blank, setBlank] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const empty = kind.empty(data);
  const mounted = useRef(true);
  const running = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = (work: () => Promise<Said>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setSaid(null);
    work()
      .finally(() => {
        running.current = false;
      })
      .then(
        (result) => {
          if (!mounted.current) return;
          setBusy(false);
          setSaid(result);
        },
        (error: unknown) => {
          if (__DEV__) console.warn('A document was not made', error);
          if (!mounted.current) return;
          setBusy(false);
          setSaid('failed');
        },
      );
  };

  const print = () =>
    run(async () => {
      await pdf.printHtml(kind.pages(data, t, blank), kind.title(t), kind.landscape);
      return null;
    });

  const save = () =>
    run(async () => {
      const made = await pdf.makePdf(kind.pages(data, t, blank), `document-${kind.id}`, kind.landscape);
      return (await pdf.savePdf(made.name, fileName(kind, data, t, blank))) ? 'saved' : null;
    });

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
      <RadioCardGroup
        testID="output-version"
        label={t('documents.output.version')}
        selected={blank ? 'blank' : 'recorded'}
        disabled={busy}
        onSelect={(value) => setBlank(value === 'blank')}
        choices={[
          { value: 'recorded', label: t('documents.output.recorded'), description: t('documents.output.recordedLine') },
          { value: 'blank', label: t('documents.output.blank'), description: kind.blankLine(t) },
        ]}
      />
      {kind.pupils && (
        <Notice
          testID="output-confidential"
          variant="notice"
          badge={t('documents.confidential')}
          message={t('documents.output.confidentialLine')}
        />
      )}
      <Notice icon={controlIcon('info')} message={kind.signatureLine(t)} />
      {empty && <Notice testID="output-empty" icon={controlIcon('info')} message={kind.emptyLine(t)} />}
      {said !== null && (
        <Notice
          testID="output-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
      <View style={styles.actions}>
        <Button testID="output-print" label={t('documents.output.print')} disabled={busy || empty} onPress={print} />
        <Button
          testID="output-save"
          variant="line"
          label={t('documents.output.save')}
          disabled={busy || empty}
          onPress={save}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  period: { ...typography.body, color: colors.pencil },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  actions: { gap: spacing['space-10'], paddingTop: spacing['space-8'] },
});
