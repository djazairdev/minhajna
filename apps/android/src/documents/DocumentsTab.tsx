// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الوثائق» (#212, Docs): every document the app makes, with what each one
// covers now. A document opens its output: print, or save a PDF, as recorded or
// blank with its headings. «طباعة الأسبوع» comes first, with how many documents
// have something new since their last print (#215). «المذكرات» opens the next
// session's lesson note (#237), and «تبرير التقويم المستمر» its screen (#239).
// In a pilot build, the last row opens «توقيتاتي في التجربة» (#220).

import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, spacing } from '../design/tokens';
import { NotesRow } from '../notes/NotesRow';
import { useTimingStore } from '../pilot/timing-store';
import { useText } from '../text/i18n';
import { DOCUMENTS, type DocumentId } from './catalogue';
import { weekEntries } from './print-week';
import { useDocumentData } from './useDocumentData';

/**
 * The Documents tab; `onOpen` opens a document's output, `onPrintWeek`
 * «طباعة الأسبوع», `onFixes` the texts book's corrections, `onNote` a
 * session's lesson note, `onJustify` «تبرير التقويم المستمر», and `onTimings`
 * «توقيتاتي» in a pilot build.
 */
export function DocumentsTab({
  onOpen,
  onPrintWeek,
  onFixes,
  onNote,
  onTimings,
  onJustify,
}: {
  readonly onOpen: (id: DocumentId) => void;
  readonly onPrintWeek: () => void;
  readonly onFixes: () => void;
  readonly onNote?: (key: string, day: string) => void;
  readonly onTimings?: () => void;
  readonly onJustify?: () => void;
}) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useDocumentData();
  const pilot = useTimingStore() !== null;
  const news = useMemo(() => weekEntries(data).filter((entry) => entry.news !== null).length, [data]);
  return (
    <View style={[styles.screen, { direction, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <PageHeading testID="documents-heading" title={t('navigation.documents')} scope={t('documents.list.line')} />
        <View style={styles.list}>
          <RowLink
            testID="documents-print-week"
            icon={controlIcon('print')}
            title={t('documents.printWeek.name')}
            description={
              news === 0 ? t('documents.printWeek.tabNone') : t('documents.printWeek.tabNew', { count: news })
            }
            onPress={onPrintWeek}
          />
          {DOCUMENTS.filter((kind) => kind.shown?.(data) ?? true).map((kind) => (
            <RowLink
              key={kind.id}
              testID={`documents-${kind.id}`}
              icon={controlIcon(kind.icon)}
              title={kind.title(t)}
              description={kind.line(data, t)}
              onPress={() => onOpen(kind.id)}
            />
          ))}
          {onJustify !== undefined && (
            <RowLink
              testID="documents-justify"
              icon={controlIcon('print')}
              title={t('marks.justify.title')}
              description={t('marks.justify.row')}
              onPress={onJustify}
            />
          )}
          {onNote !== undefined && <NotesRow data={data} onOpen={onNote} onPrint={() => onOpen('notes')} />}
          <RowLink
            testID="documents-fixes"
            icon={controlIcon('check')}
            title={t('bookFixes.title')}
            description={t('bookFixes.line')}
            onPress={onFixes}
          />
          {pilot && onTimings !== undefined && (
            <RowLink
              testID="documents-timings"
              icon={controlIcon('phone')}
              title={t('pilotTimings.title')}
              description={t('pilotTimings.line')}
              onPress={onTimings}
            />
          )}
          <Notice icon={controlIcon('info')} message={t('documents.list.more')} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: spacing['space-16'] },
  list: { gap: spacing['space-10'], paddingHorizontal: spacing['space-16'], paddingBottom: spacing['space-16'] },
});
