// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «حذف بيانات هذا التلميذ» on a pupil's page (#248, Pupil-erase, R-5.5-13,
// answers 473 to 475): shown once a departure from the school is recorded, not
// for a change of class, and open once the director confirmed it and its day
// came. Its sheet says what goes and what stays, an earlier class's record
// included for a pupil who came by a change of class (answer 476), offers the
// export first, shows the one line the activity log keeps, and erases only once
// the teacher ticks that it cannot be undone, once however often it is tapped.
// The pupil's page closes once the pupil is gone from the records.

import { compareDays, departed, type Day, type Pupil } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { Notice } from '../components/Notice';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { logDay } from '../log/log-text';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';

export type PupilEraseProps = {
  readonly pupil: Pupil;
  readonly className: string;
  readonly onExport: () => void;
  readonly onErased: () => void;
};

const GONE = [
  'pupilPage.erase.goneName',
  'pupilPage.erase.goneRoll',
  'pupilPage.erase.goneMarks',
  'pupilPage.erase.goneSeat',
] as const;
const KEPT = ['pupilPage.erase.keptBooks', 'pupilPage.erase.keptFiles'] as const;
const KEPT_EARLIER = [...KEPT, 'pupilPage.erase.keptEarlier'] as const;

/** The day the pupil leaves the school, from their last movement; null while on the list or for a change of class. */
function leftOn(pupil: Pupil): Day | null {
  const last = [...pupil.movements].sort((a, b) => compareDays(a.day, b.day)).at(-1);
  return last?.kind === 'out' && last.reason !== 'class-change' ? last.day : null;
}

export function PupilErase(props: PupilEraseProps) {
  const t = useText();
  const { direction } = useLocale();
  const { erasePupil, allSaved, latestState, today } = useAppData();
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const opener = useRef<ViewInstance>(null);
  const pending = useRef(false);
  const { pupil } = props;
  const day = leftOn(pupil);
  if (day === null) return null;
  const female = pupil.sex === 'f';
  const changedClass = pupil.movements.some((movement) => movement.kind === 'in' && movement.reason === 'class-change');
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const title = t(female ? 'pupilPage.erase.rowF' : 'pupilPage.erase.row');
  const close = () => {
    setOpen(false);
    setUnderstood(false);
    setFailed(false);
  };
  const erase = () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    erasePupil(pupil.id);
    void allSaved().then(() => {
      pending.current = false;
      setBusy(false);
      if (latestState().pupils.has(pupil.id)) setFailed(true);
      else props.onErased();
    });
  };
  const items = (keys: typeof GONE | typeof KEPT | typeof KEPT_EARLIER) =>
    keys.map((key) => (
      <Text key={key} style={[styles.item, align]}>
        {t(key)}
      </Text>
    ));
  return (
    <>
      <RowLink
        ref={opener}
        testID="pupil-erase"
        icon={controlIcon('cross')}
        title={title}
        description={t('pupilPage.erase.rowLine')}
        disabled={!departed(pupil, today())}
        onPress={() => setOpen(true)}
      />
      <BottomSheet
        testID="pupil-erase-sheet"
        visible={open}
        title={title}
        context={t(female ? 'pupilPage.erase.contextF' : 'pupilPage.erase.context', {
          name: pupil.name,
          class: props.className,
          day: logDay(day),
        })}
        reassurance={t('pupilPage.erase.reassurance')}
        returnFocusRef={opener}
        onClose={close}
      >
        <View testID="pupil-erase-gone" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('pupilPage.erase.gone')}
          </Text>
          {items(GONE)}
        </View>
        <View testID="pupil-erase-kept" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('pupilPage.erase.kept')}
          </Text>
          {items(changedClass ? KEPT_EARLIER : KEPT)}
        </View>
        <RowLink
          testID="pupil-erase-export"
          icon={controlIcon('lock')}
          title={t('pupilPage.erase.export')}
          description={t('pupilPage.erase.exportLine')}
          onPress={() => {
            close();
            props.onExport();
          }}
        />
        <View accessible style={styles.log}>
          <Text style={[styles.label, align]}>{t('pupilPage.erase.log')}</Text>
          <Text style={[styles.item, align]}>{t('pupilPage.erase.logLine', { day: logDay(today()) })}</Text>
        </View>
        <CheckRow
          testID="pupil-erase-understood"
          label={t('pupilPage.erase.understood')}
          checked={understood}
          disabled={busy}
          onCheckedChange={setUnderstood}
        />
        {failed && (
          <Notice testID="pupil-erase-failed" icon={controlIcon('info')} message={t('pupilPage.erase.failed')} />
        )}
        <Button
          testID="pupil-erase-confirm"
          variant="danger"
          label={t('pupilPage.erase.erase')}
          disabled={!understood || busy}
          onPress={erase}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-4'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    paddingHorizontal: spacing['space-16'],
    paddingVertical: spacing['space-12'],
  },
  log: { gap: spacing['space-4'] },
  label: { ...typography.caption, color: colors.ink2 },
  item: { ...typography.body, color: colors.ink },
});
