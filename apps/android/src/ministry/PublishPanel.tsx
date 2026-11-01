// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Publishing the draft from the Ministry's calendar page (#608, answer 624):
// once the draft holds a change, a button offers to publish it; pressing it
// asks to confirm, saying how many entries the draft adds, changes and takes
// out, and that the release cannot be taken back, only changed by a later one.
// Confirming hands the draft on, and cancelling brings the focus back to the
// button; a draft changed meanwhile drops the question. Both wait while the
// page is busy.

import type { CalendarDraft, CalendarEntry } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Button } from '../components/Button';
import { useSheetFocus } from '../components/sheet-focus';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

export type PublishPanelProps = {
  readonly base: readonly CalendarEntry[];
  readonly draft: CalendarDraft;
  readonly busy: boolean;
  readonly onPublish: (draft: CalendarDraft) => void;
};

/** How many entries a draft adds, changes and takes out. */
export function draftCounts(base: readonly CalendarEntry[], draft: CalendarDraft) {
  const added = draft.entries.filter((entry) => !base.some((one) => one.id === entry.id)).length;
  return { added, changed: draft.entries.length - added, removed: draft.removed.length };
}

/** The button that publishes the draft, and its confirmation. */
export function PublishPanel({ base, draft, busy, onPublish }: PublishPanelProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [asked, setAsked] = useState<CalendarDraft | null>(null);
  const button = useRef<ViewInstance>(null);
  const empty = draft.entries.length === 0 && draft.removed.length === 0;
  const confirming = asked === draft && !empty;
  useSheetFocus(confirming, button);
  if (empty) return null;
  if (!confirming)
    return (
      <Button
        ref={button}
        testID="ministry-publish"
        label={t('demo.ministryCalendar.publish.button')}
        disabled={busy}
        onPress={() => setAsked(draft)}
      />
    );
  return (
    <View testID="ministry-publish-confirm" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.ministryCalendar.publish.title')}
      </Text>
      <Text style={[styles.body, align]}>{t('demo.ministryCalendar.publish.counts', draftCounts(base, draft))}</Text>
      <Text style={[styles.body, align]}>{t('demo.ministryCalendar.publish.explain')}</Text>
      <View style={styles.actions}>
        <Button
          testID="ministry-publish-yes"
          label={t('demo.ministryCalendar.publish.confirm')}
          disabled={busy}
          onPress={() => {
            setAsked(null);
            onPublish(draft);
          }}
        />
        <Button
          testID="ministry-publish-no"
          variant="plain"
          label={t('demo.ministryCalendar.publish.cancel')}
          disabled={busy}
          onPress={() => setAsked(null)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.paper,
    padding: spacing['space-12'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
