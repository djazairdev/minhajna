// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What arrives from the school, before the teacher approves it (answer 808):
// the school, each class with its pupils, and the sessions a week; on an
// update, only what changes, or that names and details changed. A school the
// phone chose with another code, another school holding the code, one the
// phone adds, and one no longer listed are said, and the approval names a
// school other than the one chosen; on a first join, so are the classes the
// teacher entered there, which stay with their sessions beside the school's.
// Nothing is recorded until the teacher approves.

import type { JoinPlan } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { JoinTarget } from './join-target';

/** The plan to approve for `target`; `school` is the delivery's school's name; `handMade` the teacher's classes. */
export function JoinPreview(props: {
  plan: JoinPlan;
  school: string;
  target: JoinTarget;
  handMade: boolean;
  update: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const { plan, school, target, handMade, update, onApprove, onCancel } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const comma = currentLanguage() === 'ar' ? '\u060c ' : ', ';
  const pupils = (count: number) => t('setup.pupils', { count });
  const classes = update ? plan.classes.filter((one) => one.isNew) : plan.classes;
  const lines = [
    ...(update && plan.arriving > 0 ? [t('join.arriving', { pupils: pupils(plan.arriving) })] : []),
    ...(plan.leaving > 0 ? [t('join.leaving', { pupils: pupils(plan.leaving) })] : []),
    ...(plan.stillListed > 0 ? [t('join.stillListed', { pupils: pupils(plan.stillListed) })] : []),
    ...(plan.dropped.length > 0 ? [t('join.dropped', { classes: plan.dropped.map(isolate).join(comma) })] : []),
    ...((update ? plan.weekChanged : plan.sessions > 0)
      ? [t('join.week', { sessions: t('week.sessions', { count: plan.sessions }) })]
      : []),
    ...(plan.replaced > 0 ? [t('join.replaced')] : []),
  ];
  const nothing = update && plan.events.length === 0;
  const details = update && !nothing && classes.length === 0 && lines.length === 0;
  const chosen = isolate(target.school.name);
  const notices = {
    chosen: null,
    elsewhere: t('join.elsewhere', { school: chosen }),
    other: t('join.other', { school: isolate(school), chosen }),
    new: t('join.newSchool', { school: isolate(school) }),
    unlisted: t('join.unlisted', { chosen }),
  };
  const notice = notices[target.kind];
  const approve =
    target.kind === 'other' || target.kind === 'elsewhere'
      ? t('join.approveOther', { school: target.kind === 'other' ? isolate(school) : chosen })
      : t(update ? 'join.apply' : 'join.approve');
  return (
    <View testID="join-preview" style={styles.preview}>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.heading, align]}>
        {school}
      </Text>
      {notice !== null && <Notice testID={`join-${target.kind}`} icon={controlIcon('info')} message={notice} />}
      {handMade && !update && (
        <Notice testID="join-hand-made" icon={controlIcon('info')} message={t('join.handMade')} />
      )}
      {classes.length > 0 && (
        <View style={styles.card}>
          {classes.map((one) => (
            <Text key={one.id} testID={`join-class-${one.id}`} style={[styles.body, align]}>
              {`${isolate(one.name)} · ${pupils(one.pupils)}`}
            </Text>
          ))}
        </View>
      )}
      {lines.map((line) => (
        <Text key={line} style={[styles.body, align]}>
          {line}
        </Text>
      ))}
      {details && (
        <Text testID="join-details" style={[styles.body, align]}>
          {t('join.details')}
        </Text>
      )}
      {nothing && (
        <Text testID="join-nothing" style={[styles.body, align]}>
          {t('join.nothing')}
        </Text>
      )}
      {!nothing && <Button testID="join-approve" icon={controlIcon('check')} label={approve} onPress={onApprove} />}
      <Button
        testID="join-cancel"
        variant="line"
        icon={controlIcon(nothing ? 'check' : 'cross')}
        label={t(nothing ? 'settings.done' : 'join.cancel')}
        onPress={onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { gap: spacing['space-12'] },
  heading: { ...typography.h2, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
});
