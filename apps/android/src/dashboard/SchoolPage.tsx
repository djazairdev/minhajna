// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's page (D-Classes, answers 807 and 809): choosing the school from
// the published list, wilaya, commune then school; its edit-code gate; then its
// book. While nothing is published the page says so, with a retry. Locking
// forgets the code and shows the gate again. The book opens on its desk
// (SchoolDesk.tsx).

import type { BellData, CountryProfile, DirectorySchool, ReferenceList } from '@minhajna/core';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { CodeGate } from './CodeGate';
import { DashboardFrame } from './DashboardFrame';
import { claimSchool, publishedList, schoolBook, schoolClaimed, type SavedBook } from './directory-api';
import { DirectoryStatus } from './DirectoryStatus';
import { PickField } from './PickField';
import { schoolChoices, schoolCommuneChoices, wilayaChoices } from './place-rules';
import { PageTitle, Quiet } from './page-parts';
import { SchoolDesk } from './SchoolDesk';
import { useDirectoryCall } from './use-directory-call';

/** Wilaya, commune and school selects, from the published list. */
function ChooseSchool({
  profile,
  list,
  onChoose,
}: {
  profile: CountryProfile;
  list: ReferenceList;
  onChoose: (school: DirectorySchool) => void;
}) {
  const t = useDeviceText();
  const [wilaya, setWilaya] = useState<string | null>(null);
  const [commune, setCommune] = useState<string | null>(null);
  const [school, setSchool] = useState<string | null>(null);
  const chosen = list.schools.find((one) => one.id === school);
  return (
    <View style={styles.choose}>
      <PickField
        testID="school-wilaya"
        label={t('dashboard.place.wilaya')}
        choices={wilayaChoices(profile, list.schools)}
        value={wilaya}
        onChange={(value) => {
          setWilaya(value);
          setCommune(null);
          setSchool(null);
        }}
      />
      <PickField
        testID="school-commune"
        label={t('dashboard.place.commune')}
        choices={schoolCommuneChoices(list.schools, wilaya)}
        value={commune}
        disabled={wilaya === null}
        onChange={(value) => {
          setCommune(value);
          setSchool(null);
        }}
      />
      <PickField
        testID="school-school"
        label={t('dashboard.place.school')}
        choices={schoolChoices(list, commune)}
        value={school}
        disabled={commune === null}
        onChange={setSchool}
      />
      <Button
        testID="school-next"
        icon={controlIcon('chevron')}
        iconEnd
        label={t('dashboard.next')}
        disabled={chosen === undefined}
        onPress={() => chosen !== undefined && onChoose(chosen)}
      />
    </View>
  );
}

/** A school's page, from choosing it to its book. */
export function SchoolPage({
  profile,
  bells,
  onBack,
}: {
  profile: CountryProfile;
  bells: BellData;
  onBack: () => void;
}) {
  const t = useDeviceText();
  const call = useDirectoryCall();
  const { run } = call;
  const [list, setList] = useState<ReferenceList | null | undefined>(undefined);
  const [school, setSchool] = useState<DirectorySchool | null>(null);
  const [opened, setOpened] = useState<{ code: string; saved: SavedBook } | null>(null);
  const load = useCallback(() => {
    void run(publishedList).then(setList);
  }, [run]);
  useEffect(load, [load]);
  const id = school?.id ?? '';
  const claimed = useCallback((options: Parameters<typeof schoolClaimed>[1]) => schoolClaimed(id, options), [id]);
  const lock = () => setOpened(null);
  if (school !== null && opened !== null && list != null)
    return (
      <SchoolDesk
        profile={profile}
        bells={bells}
        list={list}
        school={school}
        code={opened.code}
        start={opened.saved}
        onLock={lock}
        onBack={onBack}
      />
    );
  return (
    <DashboardFrame
      who={school?.name ?? t('dashboard.home.school')}
      onBack={school === null ? onBack : () => setSchool(null)}
    >
      {school === null ? (
        <>
          <PageTitle>{t('dashboard.home.school')}</PageTitle>
          <DirectoryStatus
            call={call}
            retry={list === undefined ? { label: t('dashboard.tryAgain'), onPress: load } : undefined}
          />
          {list === null && (
            <View style={styles.none}>
              <Quiet testID="school-nothing">{t('dashboard.place.nothing')}</Quiet>
              <Button
                testID="school-reload"
                variant="line"
                icon={controlIcon('chevron')}
                label={t('dashboard.tryAgain')}
                onPress={load}
              />
            </View>
          )}
          {list != null && <ChooseSchool profile={profile} list={list} onChoose={setSchool} />}
        </>
      ) : (
        <CodeGate
          key={school.id}
          title={school.name}
          claimed={claimed}
          claim={(code, options) => claimSchool(id, code, options)}
          read={(code, options) => schoolBook(id, code, options)}
          onOpen={(code, saved) => setOpened({ code, saved })}
        />
      )}
    </DashboardFrame>
  );
}

const styles = StyleSheet.create({
  choose: { gap: spacing['space-12'], maxWidth: 420 },
  none: { gap: spacing['space-12'], alignItems: 'flex-start' },
});
