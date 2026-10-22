// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «المذكرة» (#237, Note, R-3.8-32 to R-3.8-34, answers 416 to 419): a
// session's lesson note. Its number, the class, the day and the time; when
// an earlier year's note for the same lesson exists and this one has no text
// yet, «استعمالها» copies it in ink. Then the head from the plan, the
// paragraphs in grey or in ink, «إضافة فقرة» and what grey and ink mean. A
// tap accepts a grey paragraph with text, or reverts one accepted as the
// plan wrote it; a paragraph the teacher wrote changes only with the pencil,
// so a stray tap never loses it. Each change is kept at once, so the screen
// has no save button.

import type { Day, NoteKey } from '@minhajna/core';
import { noteWithoutPlan, noteWithPlan } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DueStrip } from '../components/DueStrip';
import { PageHeading } from '../components/PageHeading';
import { controlIcon } from '../design/Icon';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useText } from '../text/i18n';
import { NoteBlock } from './NoteBlock';
import { hasText, noteBlocks, planOrder } from './note-rules';
import { useNote } from './useNote';

export type NoteProps = {
  readonly sessionKey: string;
  readonly day: Day;
  /** Opens a plan paragraph for writing. */
  readonly onWrite: (key: NoteKey) => void;
  /** Opens the teacher's own paragraph at `index`, or a new one. */
  readonly onOwn: (index?: number) => void;
};

export function Note({ sessionKey, day, onWrite, onOwn }: NoteProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const note = useNote(sessionKey, day);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (note === null) {
    return (
      <View style={[styles.screen, { direction }]}>
        <Text testID="note-unavailable" style={[styles.body, styles.pad, align]}>
          {t('notes.unavailable')}
        </Text>
      </View>
    );
  }
  const { draft, earlier, keep } = note;
  const order = planOrder(draft);
  const head = [
    draft.unit === undefined ? null : { label: t('notes.head.unit'), value: draft.unit },
    draft.domain === undefined ? null : { label: t('notes.head.domain'), value: localized(draft.domain) },
    { label: t('notes.head.resource'), value: draft.resource },
    { label: t('notes.head.duration'), value: t('notes.minutes', { minutes: draft.minutes }) },
  ].filter((one) => one !== null);
  const blocks = noteBlocks(t, draft, note.note);
  const tagOf = (block: (typeof blocks)[number]) => {
    if (block.own !== undefined) return block.title;
    if (!block.inked) return t('notes.proposed', { title: block.title });
    return t(block.text === block.proposed ? 'notes.accepted' : 'notes.written', { title: block.title });
  };
  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
          { paddingBottom: insets.bottom + spacing['space-16'] },
        ]}
      >
        <PageHeading testID="note-heading" title={t('notes.number', { number: note.number })} scope={note.scope} />
        {earlier !== undefined && !hasText(note.note) && (
          <DueStrip
            testID="note-earlier"
            icon={controlIcon('homework')}
            fact={t('notes.earlier')}
            action={t('notes.use')}
            onOpen={() => keep((one) => ({ ...one, paragraphs: earlier.paragraphs }))}
          />
        )}
        <View testID="note-head" style={styles.card}>
          {head.map((one) => (
            <Text key={one.label} style={[styles.body, align]}>
              <Text style={styles.label}>{`${one.label}: `}</Text>
              {one.value}
            </Text>
          ))}
        </View>
        {blocks.map((block) => {
          const id = block.own === undefined ? `note-${block.key}` : `note-own-${block.own}`;
          const write = () => (block.own === undefined ? onWrite(block.key!) : onOwn(block.own));
          const toggles = block.inked ? block.text === block.proposed : block.text.trim() !== '';
          const toggle =
            block.own !== undefined || !toggles
              ? undefined
              : () =>
                  keep((one) =>
                    block.inked ? noteWithoutPlan(one, block.key!) : noteWithPlan(one, block.key!, block.text, order),
                  );
          return (
            <NoteBlock
              key={id}
              testID={id}
              tag={tagOf(block)}
              text={block.text.trim() === '' ? t('notes.empty') : block.text}
              inked={block.inked}
              writeLabel={t('notes.write', { title: block.title })}
              onWrite={write}
              {...(toggle !== undefined && { onToggle: toggle, toggleHint: t('notes.toggle') })}
            />
          );
        })}
        <Button testID="note-add" variant="line" label={t('notes.add')} onPress={() => onOwn()} />
        <Text style={[styles.hint, align]}>{t('notes.hint')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], padding: spacing['space-16'] },
  pad: { padding: spacing['space-16'] },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  body: { ...typography.body, color: colors.ink },
  label: { fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'), fontWeight: '700', color: colors.ink2 },
  hint: { ...typography.caption, color: colors.ink2 },
});
