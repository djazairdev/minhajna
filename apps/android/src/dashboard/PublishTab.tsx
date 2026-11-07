// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference's publishing tab (answers 805 and 809): the version the draft
// becomes, what changed since the last version, publishing it, and every
// version published, newest first, each of which can be published again as a
// new one. The version's number is the server's, on its own date; the page
// shows the one it expects. A draft never saved is saved first.

import { nextReferenceVersion, type ReferenceDraft } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { publishDraft, republish, saveDraft, type ReferenceState } from './directory-api';
import { DirectoryStatus } from './DirectoryStatus';
import { Figure, Figures, Quiet, RowLink } from './page-parts';
import { changeCount, type DraftChanges } from './reference-rules';
import { Table } from './Table';
import { useDirectoryCall } from './use-directory-call';

export type PublishTabProps = {
  readonly code: string;
  readonly state: ReferenceState;
  readonly draft: ReferenceDraft;
  readonly revision: number;
  readonly changes: DraftChanges;
  /** False while a change waits to be saved. */
  readonly ready: boolean;
  /** True while the draft was never saved, so publishing saves it first. */
  readonly firstSave: boolean;
  readonly onPublished: () => void;
};

/** A day as the boards write it, 12/11/2029. */
export const dayShown = (day: string) => day.split('-').reverse().join('/');

/** Publishing the draft, and the versions. */
export function PublishTab(props: PublishTabProps) {
  const { code, state, draft, revision, changes, ready, firstSave, onPublished } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const call = useDirectoryCall();
  const { run } = call;
  const next = nextReferenceVersion(state.versions[0]?.version ?? null, new Date().getFullYear());
  const publish = async () => {
    const done = await run(async (options) => {
      const from = firstSave ? await saveDraft(code, revision, draft, options) : revision;
      return publishDraft(code, from, options);
    });
    if (done !== undefined) onPublished();
  };
  const again = async (version: string) => {
    const done = await run((options) => republish(code, version, options));
    if (done !== undefined) onPublished();
  };
  return (
    <View style={styles.tab}>
      <View style={styles.card}>
        <View style={styles.grow}>
          <Text style={[styles.version, { writingDirection: direction, textAlign: 'start' }]}>
            {t('dashboard.publish.version', { version: next })}
          </Text>
          <Quiet>{state.published === null ? t('dashboard.publish.none') : t('dashboard.publish.draft')}</Quiet>
        </View>
        <View>
          <Button
            testID="publish-now"
            icon={controlIcon('globe')}
            label={t('dashboard.publish.now', { version: next })}
            disabled={!ready || call.busy || (state.published !== null && changeCount(changes) === 0)}
            onPress={() => void publish()}
          />
        </View>
      </View>
      <DirectoryStatus call={call} />
      <Figures>
        <Figure testID="publish-added" value={changes.added} label={t('dashboard.publish.added')} />
        <Figure testID="publish-edited" value={changes.edited} label={t('dashboard.publish.edited')} />
        <Figure testID="publish-hidden" value={changes.hidden} label={t('dashboard.publish.hidden')} />
        <Figure testID="publish-options" value={changes.options} label={t('dashboard.publish.options')} />
      </Figures>
      {state.versions.length > 0 && (
        <Table
          testID="publish-versions"
          label={t('dashboard.publish.versions')}
          columns={[
            { id: 'version', label: t('dashboard.publish.column.version'), width: 150 },
            { id: 'day', label: t('dashboard.publish.column.day'), grow: 1 },
            { id: 'again', label: '', width: 150 },
          ]}
          rows={state.versions.map(({ version, published }) => ({
            key: version,
            cells: [
              version,
              dayShown(published),
              version === state.published ? (
                <Quiet key="now">{t('dashboard.publish.current')}</Quiet>
              ) : (
                <RowLink
                  key="again"
                  testID={`publish-again-${version}`}
                  label={t('dashboard.publish.again')}
                  name={`${t('dashboard.publish.again')}: ${version}`}
                  onPress={() => void again(version)}
                />
              ),
            ],
          }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: spacing['space-12'] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  grow: { flex: 1, minWidth: 0 },
  version: { ...typography.h3, color: colors.ink },
});
