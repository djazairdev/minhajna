// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's panel (answer 809, as D-Issue draws it): their name and option,
// the joining code's QR and the code in its groups, to scan or type in the
// app; printing it; renewing it, after which the old one opens nothing; and
// taking the teacher off the book, which ends their code and leaves their
// classes without them, each once confirmed. The code works for updates until
// renewed.

import type { BookTeacher } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import qr from '../native/NativeMinhajnaCalendarInput';
import { QrCode } from '../settings/QrCode';
import { onPc, useDeviceText } from '../text/device-text';
import { useDeskBook } from './desk-book';
import { renewJoiningCode } from './directory-api';
import { DirectoryStatus } from './DirectoryStatus';
import { Quiet } from './page-parts';
import { codeShown, withoutTeacher } from './school-rules';
import type { SchoolDeskView } from './SchoolDesk';
import { useDirectoryCall } from './use-directory-call';

export type TeacherPanelProps = SchoolDeskView & {
  readonly teacherId: string;
  readonly optionOf: (code: string) => string;
  readonly onPrint: (teachers: readonly BookTeacher[]) => void;
};

/** One teacher's code. */
export function TeacherPanel(props: TeacherPanelProps) {
  const { school, code, teacherId, optionOf, onPrint, onAside } = props;
  const { book, update, adopt } = useDeskBook(props);
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const call = useDirectoryCall();
  const [sure, setSure] = useState<'renew' | 'remove' | null>(null);
  const teacher = book.teachers.find((one) => one.id === teacherId);
  const shown = teacher?.code === undefined ? null : codeShown(teacher.code);
  const rows = shown === null ? null : qr.qrRows(shown);
  if (teacher === undefined) return null;
  const renew = async () => {
    const fresh = await call.run((options) => renewJoiningCode(school.id, teacherId, code, options));
    if (fresh === undefined) return;
    adopt((current) => ({
      ...current,
      teachers: current.teachers.map((one) => (one.id === teacherId ? { ...one, code: fresh } : one)),
    }));
  };
  return (
    <View testID="teacher-panel" style={styles.panel}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {teacher.name}
      </Text>
      <Quiet>{optionOf(teacher.option)}</Quiet>
      {shown === null ? (
        <Quiet testID="teacher-code-coming">{t('dashboard.teachers.codeComing')}</Quiet>
      ) : (
        <View style={styles.code}>
          {rows !== null && (
            <QrCode
              testID="teacher-qr"
              rows={rows}
              module={4}
              label={t('dashboard.teachers.qr', { name: teacher.name })}
            />
          )}
          <Text testID="teacher-code" selectable style={styles.codeText}>
            {shown}
          </Text>
        </View>
      )}
      <DirectoryStatus call={call} />
      {onPc() && shown !== null && (
        <Button
          testID="teacher-print"
          icon={controlIcon('print')}
          label={t('dashboard.teachers.print')}
          onPress={() => onPrint([teacher])}
        />
      )}
      {sure === null ? (
        <>
          <Button
            testID="teacher-renew"
            variant="line"
            icon={controlIcon('qr')}
            label={t('dashboard.teachers.renew')}
            disabled={call.busy || shown === null}
            onPress={() => setSure('renew')}
          />
          <Button
            testID="teacher-remove"
            variant="line"
            icon={controlIcon('cross')}
            label={t('dashboard.teachers.remove')}
            onPress={() => setSure('remove')}
          />
        </>
      ) : (
        <>
          <Button
            testID="teacher-sure"
            variant="danger"
            label={t(`dashboard.teachers.sure.${sure}`, { name: teacher.name })}
            disabled={call.busy}
            onPress={() => {
              setSure(null);
              if (sure === 'renew') {
                void renew();
                return;
              }
              update((current) => withoutTeacher(current, teacherId));
              onAside(null);
            }}
          />
          <Button
            testID="teacher-not-sure"
            variant="line"
            icon={controlIcon('cross')}
            label={t('dashboard.cancel')}
            onPress={() => setSure(null)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing['space-12'] },
  title: { ...typography.h3, color: colors.ink },
  code: {
    alignItems: 'center',
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.well,
  },
  codeText: { ...typography.h3, color: colors.ink, writingDirection: 'ltr', letterSpacing: 1 },
});
