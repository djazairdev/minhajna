// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «طباعة الأسبوع» (#215, Print-set, R-3.8-51 to R-3.8-56, answers 251 and
// 252): the documents the set can hold, those with something new since
// their last print ticked, each with its range and its pages once counted;
// one or two sides; the teacher's signature box, drawn or blank once the
// drawn signature is in use (#236, answer 412), else blank with its line;
// the documents' template, the default until #237, shown and disabled;
// binding margins and a blank copy of each; then the pages, sheets and
// cost, and «طباعة» or one PDF for the print shop, saying that whoever gets
// the PDF, the print shop too, can copy the signature it carries (R-3.8-46,
// answer 415). The choices stay on this phone; a print counts once Android's
// print screen opens or the PDF is saved, and leaves its record in the
// history. A PC prints or saves through the browser's dialog, which counts
// the pages itself (#250, answers 507 and 521).

import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { OptionRow } from '../components/OptionRow';
import { SegmentedControl } from '../components/SegmentedControl';
import { Switch } from '../components/Switch';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import pdf from '../native/NativeMinhajnaPdf';
import { useAppData } from '../storage/AppData';
import { onPc, useDeviceText } from '../text/device-text';
import type { DocumentId } from './catalogue';
import { PrintEntry } from './PrintEntry';
import { countsForPrint, useBookCounts } from './print-count';
import type { PrintRange } from './print-ranges';
import { useMounted } from './output-run';
import { PrintRangeSheet } from './PrintRangeSheet';
import { carriesSignature, CopyWarning, drawnNote, SignatureChoice, useSignatureInUse } from './SignatureChoice';
import { printSetHtml, printSummary, setLandscape, type SetLayout } from './print-set';
import { usePrintSettings, type PrintSettingsChange } from './print-settings';
import { yearShown } from './document-data';
import { chosenLayout, documentPages, entryLine, weekEntries, weekSet } from './print-week';
import { useDocumentData } from './useDocumentData';
import { PrintSave } from './PrintSave';

type Said = 'saved' | 'failed' | null;
const NEW: PrintRange = { kind: 'new' };

export function PrintWeek({ onSignature }: { readonly onSignature?: () => void }) {
  const t = useDeviceText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { record, newId } = useAppData();
  const shown = useDocumentData();
  const [drawn, setDrawn] = useState(true);
  const inUse = useSignatureInUse();
  const data = useMemo(() => ({ ...shown, drawn }), [shown, drawn]);
  const entries = useMemo(() => weekEntries(shown), [shown]);
  const [settings, change] = usePrintSettings();
  const [ticked, setTicked] = useState<ReadonlySet<DocumentId>>(
    () => new Set(entries.filter((entry) => entry.news !== null).map((entry) => entry.kind.id)),
  );
  const [ranges, setRanges] = useState<Partial<Record<DocumentId, PrintRange>>>({});
  const [open, setOpen] = useState<DocumentId | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const opener = useRef<ViewInstance | null>(null);
  const mounted = useMounted();
  const running = useRef(false);

  const update = (next: PrintSettingsChange) => {
    change(next);
    setSaid(null);
  };
  const choices = useMemo(
    () =>
      entries
        .filter((entry) => ticked.has(entry.kind.id))
        .map((entry) => ({
          id: entry.kind.id,
          range: ranges[entry.kind.id] ?? NEW,
          layout: chosenLayout(entries, settings.layouts, t, entry.kind.id),
        })),
    [entries, ticked, ranges, settings.layouts, t],
  );
  const set = useMemo(() => weekSet(data, t, choices, settings.blank), [data, t, choices, settings.blank]);
  const title = t('documents.printWeek.name');
  const counting = useMemo<SetLayout>(
    () => ({ lang: data.lang, dir: data.dir, title, twoSided: false, binding: false }),
    [data.lang, data.dir, title],
  );
  const { counts, failed } = useBookCounts(set.documents, counting);
  const pages = counts === null ? undefined : documentPages(set, counts);
  const summary = counts === null ? null : printSummary(counts, settings.twoSided);
  const empty = set.documents.length === 0;
  const signs = inUse && drawn && carriesSignature(set.ids);

  const run = (how: 'print' | 'pdf') => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setSaid(null);
    const layout: SetLayout = { ...counting, twoSided: settings.twoSided, binding: settings.binding };
    const keep = () => {
      if (set.printed.length > 0) record({ kind: 'print.recorded', print: { id: newId(), documents: set.printed } });
    };
    (async (): Promise<Said> => {
      const html = printSetHtml(set.documents, layout, counts ?? (await countsForPrint(set.documents, counting)));
      const landscape = setLandscape(set.documents);
      if (how === 'print') {
        await pdf.printHtml(html, onPc() ? `${title} ${data.day}` : title, landscape);
        keep();
        return null;
      }
      const made = await pdf.makePdf(html, 'print-week', landscape);
      const saved = await pdf.savePdf(made.name, `${title} ${data.day}.pdf`);
      if (saved) keep();
      return saved ? 'saved' : null;
    })().then(
      (result) => {
        running.current = false;
        if (!mounted.current) return;
        setBusy(false);
        setSaid(result);
      },
      (error: unknown) => {
        if (__DEV__) console.warn('The week was not printed', error);
        running.current = false;
        if (!mounted.current) return;
        setBusy(false);
        setSaid('failed');
      },
    );
  };

  const openKind = entries.find((entry) => entry.kind.id === open)?.kind ?? null;
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
      <View style={styles.card}>
        {entries.map(({ kind }) => (
          <PrintEntry
            key={kind.id}
            kind={kind}
            line={entryLine(data, t, kind, ranges[kind.id] ?? NEW, pages?.get(kind.id))}
            checked={ticked.has(kind.id)}
            disabled={busy}
            onChecked={(checked) => {
              const next = new Set(ticked);
              if (checked) next.add(kind.id);
              else next.delete(kind.id);
              setTicked(next);
              setSaid(null);
            }}
            onRange={(view) => {
              opener.current = view;
              setOpen(kind.id);
            }}
          />
        ))}
      </View>
      <Text style={styles.label}>{t('documents.printWeek.sides')}</Text>
      <SegmentedControl
        testID="print-sides"
        label={t('documents.printWeek.sides')}
        selected={settings.twoSided ? 'two' : 'one'}
        disabled={busy}
        onSelect={(value) => update({ twoSided: value === 'two' })}
        choices={[
          { value: 'one', label: t('documents.printWeek.oneSide') },
          { value: 'two', label: t('documents.printWeek.twoSides') },
        ]}
      />
      <SignatureChoice
        testID="print-signature"
        label={t('documents.printWeek.signature')}
        drawn={drawn}
        disabled={busy}
        onDrawn={(next) => {
          setDrawn(next);
          setSaid(null);
        }}
        onSettings={onSignature}
      />
      <Text testID="print-signature-line" style={styles.line}>
        {signs ? drawnNote(t, set.ids) : t('documents.printWeek.signatureLine')}
      </Text>
      <View style={styles.card}>
        <Switch
          testID="print-binding"
          label={t('documents.printWeek.binding')}
          description={t('documents.printWeek.bindingLine')}
          value={settings.binding}
          disabled={busy}
          onValueChange={(binding) => update({ binding })}
        />
        <Switch
          testID="print-blank"
          label={t('documents.printWeek.blankCopy')}
          description={t('documents.printWeek.blankCopyLine')}
          value={settings.blank}
          disabled={busy}
          onValueChange={(blank) => update({ blank })}
        />
      </View>
      <OptionRow
        testID="print-template"
        label={t('documents.printWeek.template')}
        sub={t('documents.printWeek.templateDefault')}
        disabled
        onPress={() => undefined}
      />
      <Notice icon={controlIcon('info')} message={t('documents.printWeek.formats', { year: yearShown(data) })} />
      {set.documents.some((document) => document.pupils) && (
        <Notice
          testID="print-confidential"
          variant="notice"
          badge={t('documents.confidential')}
          message={t('documents.output.confidentialLine')}
        />
      )}
      <Text testID="print-summary" accessibilityLiveRegion="polite" style={styles.summary}>
        {empty
          ? t('documents.printWeek.none')
          : summary === null
            ? t(failed ? 'documents.printWeek.countFailed' : 'documents.printWeek.counting')
            : [
                t('documents.printWeek.pages', { count: summary.pages }),
                t(settings.twoSided ? 'documents.printWeek.sheetsTwo' : 'documents.printWeek.sheets', {
                  count: summary.sheets,
                }),
                t('documents.printWeek.price', { price: summary.price }),
              ].join(' · ')}
      </Text>
      {said !== null && (
        <Notice
          testID="print-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
      <View style={styles.actions}>
        <PrintSave
          print={{
            testID: 'print-print',
            label: t('documents.output.print'),
            icon: controlIcon('print'),
            disabled: busy || empty,
            onPress: () => run('print'),
          }}
          save={{
            testID: 'print-pdf',
            variant: 'line',
            label: t('documents.printWeek.pdf'),
            disabled: busy || empty,
            onPress: () => run('pdf'),
          }}
        />
      </View>
      <CopyWarning testID="print-copy" shown={signs} printShop />
      <PrintRangeSheet
        kind={openKind}
        data={data}
        range={(open !== null && ranges[open]) || NEW}
        line={
          openKind === null ? '' : entryLine(data, t, openKind, ranges[openKind.id] ?? NEW, pages?.get(openKind.id))
        }
        layout={open === null ? undefined : chosenLayout(entries, settings.layouts, t, open)}
        onRange={(range) => {
          if (open === null) return;
          setRanges((old) => ({ ...old, [open]: range }));
          setTicked((old) => new Set(old).add(open));
          setSaid(null);
        }}
        onLayout={(layout) => open !== null && update((old) => ({ layouts: { ...old.layouts, [open]: layout } }))}
        onClose={() => setOpen(null)}
        returnFocusRef={opener}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  line: { ...typography.body, color: colors.pencil },
  label: { ...typography.label, color: colors.ink2, marginBottom: -spacing['space-8'] },
  card: { gap: spacing['space-10'] },
  summary: { ...typography.label, color: colors.ink, textAlign: 'center' },
  actions: { gap: spacing['space-10'], paddingTop: spacing['space-8'] },
});
