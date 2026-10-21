// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A signed plan pack whose signature checks (Import-update board, #223 part
// 2, R-4.8-03, R-4.8-04, answers 326 and 329): who signed it, the plan and
// release it holds, and, for a new release, that it joins the plans while
// each class pinned to another release of the same pack stays on it.

import { formatDay, parsePackId, type PackAddStatus, type PackUpdate, type TrustedKey } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { groupName } from '../plan/pack-labels';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { SignedBy } from './UpdateDetails';

export function PackDetails({
  update,
  signer,
  status,
  via,
}: {
  update: PackUpdate;
  signer: TrustedKey;
  status: PackAddStatus;
  via: string;
}) {
  const t = useText();
  const { direction } = useLocale();
  const { state, profile, year } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { pack, published } = update;
  const parts = parsePackId(pack.id);
  const staying = [...state.courses.values()].flatMap((course) =>
    course.year === year.id && course.pack?.id === pack.id && course.pack.release !== pack.release
      ? [
          {
            id: course.id,
            name: state.classes.get(course.classId)?.name ?? course.classId,
            release: course.pack.release,
          },
        ]
      : [],
  );
  return (
    <View testID="pack-details" style={styles.card}>
      <SignedBy signer={signer} status={status} via={via} />
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.update.contents')}
      </Text>
      <Text style={[styles.body, align]}>
        {t('calendarView.update.pack.title', {
          group: parts === null ? isolate(pack.id) : groupName(t, profile, parts),
        })}
      </Text>
      <Text style={[styles.body, align]}>
        {t('calendarView.update.release', { release: isolate(pack.release), day: formatDay(published) })}
      </Text>
      {status === 'new' && (
        <>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('calendarView.update.changes')}
          </Text>
          <Text style={[styles.body, align]}>
            {t('calendarView.update.pack.added', { release: isolate(pack.release) })}
          </Text>
          {staying.map((one) => (
            <Text key={one.id} testID={`pack-stays-${one.id}`} style={[styles.body, align]}>
              {t('calendarView.update.pack.stays', { class: isolate(one.name), release: isolate(one.release) })}
            </Text>
          ))}
        </>
      )}
      {status === 'held' && <Text style={[styles.body, align]}>{t('calendarView.update.pack.held')}</Text>}
      {status === 'older' && <Text style={[styles.body, align]}>{t('calendarView.update.pack.older')}</Text>}
    </View>
  );
}
