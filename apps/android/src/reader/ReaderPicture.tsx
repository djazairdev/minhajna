// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «صورة المؤسسة» (#246, R-Picture, answers 489 and 490): the statements
// teachers shared, for the latest school year among them, one grade at a time,
// with how many statements and teachers its cells hold, how many were left out
// as misdated, and a hint to name teachers by school while rows may merge. It
// opens a new statement, the list of those received, and each cell's statement.
// As a director's or an inspector's home, started from the welcome, it heads
// the page itself, with Settings and Help, and offers setting the app up for
// teaching.

import { receivedStatements, statementPicture, teacherNames, type PictureGrade } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { IconButton } from '../components/IconButton';
import { PageHeading } from '../components/PageHeading';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { frontDate } from '../documents/front-tables';
import { settingsStyles as styles } from '../settings/styles';
import { gradeName } from '../setup/names';
import { subjectName } from '../sharing/statement-lines';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { PictureGrid } from './PictureGrid';

export type ReaderPictureProps = {
  readonly onOpen: (id?: string) => void;
  readonly onList: () => void;
  /** Given for the reader's home: the page heads itself and offers these. */
  readonly home?: { readonly onSettings: () => void; readonly onHelp: () => void; readonly onTeach: () => void };
};

export function ReaderPicture({ onOpen, onList, home }: ReaderPictureProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { entries, profile } = useAppData();
  const [chosen, setChosen] = useState<string | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const list = receivedStatements(entries());
  const picture = statementPicture(list, teacherNames(entries()));
  const grades = profile.levels.flatMap((level) => level.grades.map((grade) => grade.code));
  const rank = (codes: readonly string[], code: string) => {
    const at = codes.indexOf(code);
    return at === -1 ? codes.length : at;
  };
  const parts = [...picture.grades].sort((a, b) => rank(grades, a.grade) - rank(grades, b.grade));
  const part: PictureGrade | undefined = parts.find((one) => one.grade === chosen) ?? parts[0];
  const codes = profile.subjects.map((subject) => subject.code);
  const subjects = [...(part?.subjects ?? [])]
    .sort((a, b) => rank(codes, a) - rank(codes, b))
    .map((code) => ({ code, name: subjectName(profile, code) }));
  const scope =
    picture.latest === null
      ? t('reader.picture.scope')
      : t('reader.picture.scopeDay', { day: frontDate(picture.latest) });
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingTop: home === undefined ? spacing['space-16'] : insets.top + spacing['space-8'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      {home === undefined ? (
        <Text style={[styles.sub, align]}>{scope}</Text>
      ) : (
        <PageHeading
          testID="reader-home"
          title={t('reader.picture.title')}
          scope={scope}
          actions={
            <>
              <IconButton
                testID="reader-settings"
                icon={controlIcon('tune')}
                accessibilityLabel={t('settings.title')}
                onPress={home.onSettings}
              />
              <IconButton
                testID="reader-help"
                icon={controlIcon('info')}
                accessibilityLabel={t('today.help')}
                onPress={home.onHelp}
              />
            </>
          }
        />
      )}
      <View style={{ gap: spacing['space-8'] }}>
        <Button testID="reader-picture-open" label={t('reader.open')} onPress={() => onOpen()} />
        <Button testID="reader-picture-list" variant="line" label={t('reader.title')} onPress={onList} />
      </View>
      {part === undefined ? (
        <Text testID="reader-picture-empty" style={[styles.body, align]}>
          {t('reader.picture.empty')}
        </Text>
      ) : (
        <>
          <ChipGroup
            testID="reader-grade"
            label={t('reader.picture.grades')}
            choices={parts.map((one) => ({ value: one.grade, label: gradeName(profile, one.grade) }))}
            selected={part.grade}
            onSelect={setChosen}
          />
          <Text testID="reader-grade-count" accessibilityRole="header" style={[styles.title, align]}>
            {t('reader.picture.gradeCount', {
              grade: gradeName(profile, part.grade),
              statements: t('reader.count', { count: part.statements }),
              teachers: t('reader.teachers', { count: part.teachers }),
            })}
          </Text>
          <PictureGrid key={part.grade} part={part} subjects={subjects} onOpen={onOpen} />
          <Text style={[styles.sub, align]}>{t('reader.picture.note')}</Text>
          {picture.mayMerge && (
            <Text testID="reader-picture-merge" style={[styles.sub, align]}>
              {t('reader.picture.nameSchools')}
            </Text>
          )}
        </>
      )}
      {picture.leftOut > 0 && (
        <Text testID="reader-picture-left-out" style={[styles.sub, align]}>
          {t('reader.picture.leftOut', { count: picture.leftOut })}
        </Text>
      )}
      {home !== undefined && (
        <Button testID="reader-teach" variant="plain" label={t('reader.picture.teach')} onPress={home.onTeach} />
      )}
    </ScrollView>
  );
}
