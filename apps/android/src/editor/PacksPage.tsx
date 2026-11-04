// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curator works on source releases only. This page is keyed by world
// so a checked day change preserves the form. It receives no teacher data.
// A read failure blocks draft edits. Published releases are immutable.

import { packReleaseKey, type PlanPack } from '@minhajna/core';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { PackDraft } from './PackDraft';
import { PackList } from './PackList';
import { SourceForm } from './SourceForm';
import { editorStyles as s } from './editor-styles';
import type { PackEditor } from './pack-release-session';
import { isCuratorDraft, usePackDrafts } from './usePackDrafts';

export function PacksPage(
  props: PackEditor & {
    readonly packs: readonly PlanPack[];
    readonly send?: Send;
    readonly refusedPacks?: number;
    readonly setOpen?: Dispatch<SetStateAction<OpenWorld | null>>;
  },
) {
  return <Desk key={props.world?.world ?? ''} {...props} />;
}

function Desk(props: Parameters<typeof PacksPage>[0]) {
  const t = useDeviceText();
  const desk = usePackDrafts(props, props.packs, props.send, props.setOpen);
  const reserved = [...props.packs.map((pack) => packReleaseKey(pack.id, pack.release)), ...desk.records.keys()];
  const [opened, setOpened] = useState<{ pack: PlanPack; revision: number } | null>(null);
  const [sourceForm, setSourceForm] = useState<{ initial: PlanPack | null } | null>(null);
  const canOpen = desk.ready && sourceForm === null;
  const close = () => {
    setOpened(null);
    setSourceForm(null);
    desk.dismiss();
  };
  return (
    <View testID="editor-packs-page" style={s.page}>
      {desk.problem !== null && (
        <Text accessibilityRole="alert" style={s.error}>
          {t(`editorItem.${desk.problem}`)}
        </Text>
      )}
      {opened !== null ? (
        <PackDraft
          key={packReleaseKey(opened.pack.id, opened.pack.release)}
          initial={opened.pack}
          revision={opened.revision}
          country={props.profile.code}
          busy={desk.busy}
          loading={!desk.ready && desk.problem === null}
          changed={desk.problem === 'packChanged'}
          latest={desk.records.get(packReleaseKey(opened.pack.id, opened.pack.release))}
          onLatest={desk.dismiss}
          onSave={desk.save}
          onClose={close}
        />
      ) : (
        <>
          {!desk.ready && desk.problem === null && (
            <Text accessibilityLiveRegion="polite" style={s.body}>
              {t('editorItem.loading')}
            </Text>
          )}
          <Button
            testID="draft-reload"
            label={t('editorItem.reload')}
            variant="plain"
            disabled={desk.busy}
            onPress={desk.reload}
          />
          <Button
            testID="draft-new"
            label={t('editorItem.newPack')}
            disabled={!canOpen}
            onPress={() => {
              if (canOpen) setSourceForm({ initial: null });
            }}
          />
          {sourceForm !== null && (
            <SourceForm
              reserved={reserved}
              country={props.profile.code}
              pack={null}
              initial={sourceForm.initial}
              onKeep={(pack) => {
                setOpened({ pack, revision: 0 });
                setSourceForm(null);
              }}
              onCancel={close}
            />
          )}
          <Text accessibilityRole="header" style={s.title}>
            {t('editorItem.drafts')}
          </Text>
          {[...desk.records.values()].map((one) => (
            <View key={packReleaseKey(one.pack.id, one.pack.release)} style={s.card}>
              <Text style={s.body}>
                {isolate(one.pack.id)} · {isolate(one.pack.release)}
              </Text>
              <Text style={s.body}>{t(`editorItem.stage.${one.stage}`)}</Text>
              <Badge
                label={t(`plan.status.${one.pack.status}`)}
                variant={one.pack.status === 'stale' || one.pack.status === 'example' ? 'warning' : 'default'}
              />
              {isCuratorDraft(one) ? (
                <Button
                  testID={`draft-open-${one.pack.release}`}
                  label={t('editorItem.open')}
                  name={t('editorItem.openNamed', { name: `${isolate(one.pack.id)} · ${isolate(one.pack.release)}` })}
                  disabled={!canOpen}
                  onPress={() => {
                    if (canOpen) setOpened({ pack: one.pack, revision: one.revision });
                  }}
                />
              ) : (
                <Text style={s.body}>{t('editorItem.readOnly')}</Text>
              )}
              <Button
                label={t('editorItem.copy')}
                name={t('editorItem.copyNamed', { name: `${isolate(one.pack.id)} · ${isolate(one.pack.release)}` })}
                variant="plain"
                disabled={!canOpen}
                onPress={() => {
                  if (canOpen) setSourceForm({ initial: one.pack });
                }}
              />
            </View>
          ))}
          <PackList
            packs={props.packs}
            profile={props.profile}
            refusedPacks={props.refusedPacks}
            onCopy={canOpen ? (initial) => setSourceForm({ initial }) : undefined}
          />
        </>
      )}
    </View>
  );
}
