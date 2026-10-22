// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's approval of a primary re-pace (#229, Repace-primary,
// R-4.7-30, answers 367, 371 and 372): where the draft stands, not sent to
// print yet, sent and waiting, changed since it was sent, or being ticked
// again after it was; the print for approval; then, while it waits, the
// approval date on the month's grid, from the print day to today,
// «تسجيل الاعتماد», and «لم تُعتمد: تعديل المسودة» to tick again, from the
// choices printed, and print anew. The current distribution applies until
// the approval is recorded.

import type { CountryProfile, Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { monthOf } from '../extra/extra-rules';
import { MonthDays } from '../extra/MonthDays';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';

export type ApprovalStatus = 'draft' | 'printed' | 'changed' | 'editing';

export type RepaceApprovalProps = {
  readonly status: ApprovalStatus;
  /** The day of the draft's newest print; null when not printed. */
  readonly printed: Day | null;
  readonly today: Day;
  readonly busy: boolean;
  readonly profile: Pick<CountryProfile, 'months'>;
  readonly onPrint: () => void;
  readonly onRecord: (approved: Day) => void;
  readonly onEdit: () => void;
};

export function RepaceApproval(props: RepaceApprovalProps) {
  const { status, printed, today, busy, profile, onPrint, onRecord, onEdit } = props;
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [approved, setApproved] = useState<Day>(today);
  const [month, setMonth] = useState(monthOf(today));
  const day = printed === null ? '' : dayName(t, printed, currentLanguage(), profile);
  const message = {
    draft: () => t('repace.statusDraft'),
    printed: () => t('repace.statusPrinted', { day }),
    changed: () => t('repace.statusChanged', { day }),
    editing: () => t('repace.statusEditing', { day }),
  }[status]();
  return (
    <View style={styles.group}>
      <Notice testID="repace-status" icon={controlIcon('info')} message={message} />
      {status === 'printed' && printed !== null ? (
        <>
          <Text style={[styles.label, align]}>{t('repace.approvedWhen')}</Text>
          <MonthDays
            month={month}
            selected={approved}
            first={printed}
            last={today}
            profile={profile}
            onMonth={setMonth}
            onSelect={setApproved}
          />
          <Button testID="repace-record" label={t('repace.record')} onPress={() => onRecord(approved)} />
          <Button testID="repace-edit" variant="line" label={t('repace.edit')} onPress={onEdit} />
        </>
      ) : (
        <Button
          testID="repace-print"
          label={t('repace.printForApproval')}
          icon={controlIcon('print')}
          disabled={busy}
          onPress={onPrint}
        />
      )}
      <Text style={[styles.sub, align]}>{t('repace.primary')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
});
