// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A free-entry card on Today (#232, PS-Today, answer 399): a session, of a type
// a plan proposes for, of a class with no plan pack, or a stale one, has
// nothing proposed, so the focus card says why and takes what was taught as
// typed, in the subject's writing direction, with the roll call and the
// homework coming back as on any card. «تسجيل الحصة» records it as content from
// outside the plan, which the texts book prints as written; the session's
// details hold every other outcome.

import { courseSetup, findSessionType, isJoint, type Context, type Details, type TodaySession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DueStripProps } from '../components/DueStrip';
import { SessionCard, type SessionMeta } from '../components/SessionCard';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { directionOf, subjectLanguage } from '../documents/texts-book-pages';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { listOfSession } from './ListCard';

/**
 * Why nothing is proposed when the session is written freely; null for a session that is not, for one of a type no
 * plan proposes for, such as a test or a free slot, and for one of a joint class, whose card opens each year's
 * details instead.
 */
export function freeEntry(context: Context, item: TodaySession): 'missing' | 'none' | 'stale' | null {
  if (item.status !== 'awaiting' || item.proposal !== null) return null;
  if (findSessionType(context.ref.country, item.session.sessionType).queue === 'none') return null;
  const setup = courseSetup(context, item.course.id);
  if (isJoint(setup.schoolClass)) return null;
  if (item.packMissing) return 'missing';
  return setup.pack === null ? 'none' : setup.packStale ? 'stale' : null;
}

/** Whether the session has something to confirm as proposed: a proposal or a list. */
export function proposed(item: TodaySession): boolean {
  return item.proposal !== null || listOfSession(item) !== null;
}

/** Whether the session can take the focus: one with something proposed, or one written freely. */
export function focusable(context: Context, item: TodaySession): boolean {
  return proposed(item) || freeEntry(context, item) !== null;
}

export interface FreeEntryProps {
  readonly testID: string;
  readonly item: TodaySession;
  readonly why: 'missing' | 'none' | 'stale';
  readonly meta: SessionMeta;
  readonly due: readonly DueStripProps[];
  readonly onRecord: (details: Details) => void;
  readonly onDetails: () => void;
}

/** The focus card of a session written freely. */
export function FreeEntry({ testID, item, why, meta, due, onRecord, onDetails }: FreeEntryProps) {
  const t = useText();
  const { direction } = useLocale();
  const { profile } = useAppData();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const missing = text.trim() === '';
  const language = subjectLanguage(profile, item.course.subject, currentLanguage());
  const extra = (
    <View style={styles.extra}>
      <Text style={[styles.why, { writingDirection: direction, textAlign: 'start' }]}>{t(`today.free.${why}`)}</Text>
      <TextField
        testID={`${testID}-free`}
        label={t('today.free.label')}
        placeholder={t('today.free.placeholder')}
        value={text}
        onChangeText={setText}
        multiline
        textDirection={directionOf(language)}
        {...(tried && missing && { error: t('today.free.empty') })}
      />
    </View>
  );
  return (
    <SessionCard
      testID={testID}
      kind="focus"
      meta={meta}
      extra={extra}
      due={due}
      confirm={t('today.free.save')}
      onConfirm={() => (missing ? setTried(true) : onRecord({ unplanned: text.trim() }))}
      more={[{ id: 'details', label: t('entry.open'), onPress: onDetails }]}
    />
  );
}

const styles = StyleSheet.create({
  extra: { gap: spacing['space-8'] },
  why: { ...typography.small, color: colors.ink2 },
});
