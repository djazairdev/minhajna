// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today-backlog (#35): the earlier sessions still awaiting confirmation, a
// week at a time, the earliest first, by day. Every session is checked to
// be confirmed as proposed; a tap leaves it out, and a session left out
// offers «نتيجة أخرى» and «تفاصيل الحصة», which record it with the day it
// was taught, as for a session kept on paper (PRD §2.3, §3.3, §5.5). One
// button confirms the rest at once; nothing is recorded before it (PRD
// §2.6). The list is for the screen only (PRD §3.9). A session without a
// proposal cannot be confirmed as proposed, so it is left out already.
// Under the hints, the screen may add «إدخال مناداة من الورقة» (#38).

import type { Session, TodaySession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export interface BacklogRow {
  readonly item: TodaySession;
  /** The time, the class and the lesson, as one line. */
  readonly label: string;
}

export interface BacklogProps {
  readonly days: readonly { readonly title: string; readonly rows: readonly BacklogRow[] }[];
  /** Whether later weeks have sessions awaiting confirmation too. */
  readonly later: boolean;
  /** The session «نتيجة أخرى» is open for, whose button takes the focus back. */
  readonly sheetKey: string | null;
  readonly sheetRef: Ref<ViewInstance>;
  readonly onConfirm: (items: readonly TodaySession[]) => void;
  readonly onOther: (item: TodaySession) => void;
  readonly onDetails: (session: Session) => void;
  /** «إدخال مناداة من الورقة», under the hints. */
  readonly paper?: ReactNode;
}

export function Backlog(props: BacklogProps) {
  const { direction } = useLocale();
  const t = useText();
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set());
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const rows = props.days.flatMap((day) => day.rows);
  const kept = rows.filter(({ item }) => item.proposal !== null && !left.has(item.session.key));
  const toggle = (key: string, checked: boolean) => {
    const next = new Set(left);
    if (checked) next.delete(key);
    else next.add(key);
    setLeft(next);
  };

  return (
    <View testID="backlog" style={styles.card}>
      {props.days.map((day) => (
        <View key={day.title} style={styles.day}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {day.title}
          </Text>
          {day.rows.map(({ item, label }) => {
            const key = item.session.key;
            const checkable = item.proposal !== null;
            const checked = checkable && !left.has(key);
            return (
              <View key={key} style={styles.row}>
                <CheckRow
                  testID={`backlog-${key}`}
                  label={label}
                  checked={checked}
                  disabled={!checkable}
                  onCheckedChange={(on) => toggle(key, on)}
                />
                {!checked && (
                  <View style={styles.actions}>
                    {checkable && (
                      <Button
                        testID={`backlog-${key}-other`}
                        variant="plain"
                        label={t('outcome.other')}
                        onPress={() => props.onOther(item)}
                        {...(props.sheetKey === key && { ref: props.sheetRef })}
                      />
                    )}
                    <Button
                      testID={`backlog-${key}-details`}
                      variant="plain"
                      label={t('entry.open')}
                      onPress={() => props.onDetails(item.session)}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
      <Button
        testID="backlog-confirm"
        label={t('backlog.confirm', { count: kept.length })}
        icon={controlIcon('check')}
        disabled={kept.length === 0}
        onPress={() => props.onConfirm(kept.map(({ item }) => item))}
      />
      <Text style={[styles.note, align]}>{t('backlog.hint')}</Text>
      {props.later && <Text style={[styles.note, align]}>{t('backlog.later')}</Text>}
      {props.paper}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-10'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  day: { gap: spacing['space-4'] },
  heading: { ...typography.label, color: colors.ink2 },
  row: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing['space-4'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  note: { ...typography.caption, color: colors.ink2 },
});
