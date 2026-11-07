// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference's desk once the code opened it (answers 804, 805 and 809): the
// title, how many changes wait to be published and the way to publish them;
// the tabs for the levels' options, the schools and publishing; the side panel
// a tab opens. Each change is saved to the draft as it is made, over the
// revision read last; publishing waits until the draft is saved. Before the
// first save, the draft is the profile's options with no school.

import type { CountryProfile, ReferenceDraft, ReferenceList } from '@minhajna/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { DashboardFrame } from './DashboardFrame';
import { publishedList, referenceState, saveDraft, type ReferenceState } from './directory-api';
import { DirectoryStatus } from './DirectoryStatus';
import { LevelsTab } from './LevelsTab';
import { PageTitle } from './page-parts';
import { PublishTab } from './PublishTab';
import { changeCount, draftChanges, startingDraft } from './reference-rules';
import { SchoolsTab } from './SchoolsTab';
import { useDirectoryCall } from './use-directory-call';
import { useSavedDoc } from './use-saved-doc';

type Tab = 'levels' | 'schools' | 'publish';

export type ReferenceDeskProps = {
  readonly profile: CountryProfile;
  readonly code: string;
  readonly start: ReferenceState;
  readonly onLock: () => void;
  readonly onBack: () => void;
};

/** The Ministry's list, as its holder edits and publishes it. */
export function ReferenceDesk({ profile, code, start, onLock, onBack }: ReferenceDeskProps) {
  const t = useDeviceText();
  const call = useDirectoryCall();
  const { run } = call;
  const [state, setState] = useState(start);
  const [list, setList] = useState<ReferenceList | null>(null);
  const [tab, setTab] = useState<Tab>('levels');
  const [aside, setAside] = useState<ReactNode>(null);
  const save = useCallback(
    async (revision: number, draft: ReferenceDraft, options: Parameters<typeof saveDraft>[3]) => ({
      revision: await saveDraft(code, revision, draft, options),
    }),
    [code],
  );
  const saved = useSavedDoc({ doc: start.draft ?? startingDraft(profile), revision: start.revision }, save, call);
  const loadList = useCallback(
    () => void run(publishedList).then((read) => read !== undefined && setList(read)),
    [run],
  );
  useEffect(loadList, [loadList]);
  const reload = async () => {
    const read = await run((options) => referenceState(code, options));
    if (read === undefined) return;
    setState(read);
    saved.replace(read.draft ?? startingDraft(profile), read.revision);
    loadList();
  };
  const base = list ?? startingDraft(profile);
  const changes = draftChanges(saved.doc, base);
  const pending = changeCount(changes);
  const show = (next: Tab) => {
    setTab(next);
    setAside(null);
  };
  return (
    <DashboardFrame who={t('dashboard.who.ministry')} onLock={onLock} onBack={onBack} aside={aside}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <PageTitle>{t('dashboard.home.reference')}</PageTitle>
        </View>
        <Badge testID="reference-pending" label={t('dashboard.reference.pending', { count: pending })} />
        <View>
          <Button
            testID="reference-go-publish"
            icon={controlIcon('globe')}
            label={t('dashboard.reference.publish')}
            onPress={() => show('publish')}
          />
        </View>
      </View>
      <DirectoryStatus
        call={call}
        retry={
          call.problem === 'stale'
            ? { label: t('dashboard.reload'), onPress: () => void reload() }
            : saved.unsaved
              ? { label: t('dashboard.tryAgain'), onPress: saved.retry }
              : undefined
        }
      />
      <View style={styles.tabs}>
        <SegmentedControl
          testID="reference-tab"
          label={t('dashboard.home.reference')}
          choices={[
            { value: 'levels', label: t('dashboard.reference.tab.levels') },
            { value: 'schools', label: t('dashboard.reference.tab.schools') },
            { value: 'publish', label: t('dashboard.reference.tab.publish') },
          ]}
          selected={tab}
          onSelect={show}
        />
      </View>
      {tab === 'levels' && (
        <LevelsTab
          profile={profile}
          draft={saved.doc}
          onChange={saved.change}
          onUpdate={saved.update}
          onAside={setAside}
        />
      )}
      {tab === 'schools' && (
        <SchoolsTab
          profile={profile}
          draft={saved.doc}
          onChange={saved.change}
          onUpdate={saved.update}
          onAside={setAside}
        />
      )}
      {tab === 'publish' && (
        <PublishTab
          code={code}
          state={state}
          draft={saved.doc}
          revision={saved.revision}
          changes={changes}
          ready={!saved.unsaved && !call.busy}
          firstSave={state.draft === null && saved.revision === start.revision}
          onPublished={() => void reload()}
        />
      )}
    </DashboardFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-12'] },
  grow: { flex: 1, minWidth: 0 },
  tabs: { maxWidth: 560 },
});
