// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curator works on source releases only. This page is keyed by world
// and day, and receives no store, journal or teacher pin. A read failure
// blocks creating drafts. Published and other actors' releases are immutable.

import { packReleaseKey, type PlanPack } from '@minhajna/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { Send } from '../demo/world-session';
import { useDeviceText } from '../text/device-text';
import { PackDraft } from './PackDraft';
import { PackList } from './PackList';
import { SourceForm } from './SourceForm';
import { editorStyles as s } from './editor-styles';
import type { PackEditor } from './pack-release-session';
import { usePackDrafts } from './usePackDrafts';

export function PacksPage(
  props: PackEditor & { readonly packs: readonly PlanPack[]; readonly send?: Send; readonly refusedPacks?: number },
) {
  return <Desk key={`${props.world?.world ?? ''}/${props.world?.date ?? ''}`} {...props} />;
}

function Desk(props: Parameters<typeof PacksPage>[0]) {
  const t = useDeviceText();
  const desk = usePackDrafts(props, props.packs, props.send);
  const reserved = [...props.packs.map((pack) => packReleaseKey(pack.id, pack.release)), ...desk.records.keys()];
  const [opened, setOpened] = useState<{ pack: PlanPack; revision: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [copy, setCopy] = useState<PlanPack | null>(null);
  const [copying, setCopying] = useState(false);
  const close = () => {
    setOpened(null);
    setCreating(false);
    setCopy(null);
    setCopying(false);
  };
  return (
    <View testID="editor-packs-page" style={s.page}>
      {desk.error && (
        <Text accessibilityRole="alert" style={s.error}>
          {t('editorItem.saveError')}
        </Text>
      )}
      {opened !== null ? (
        <PackDraft
          key={packReleaseKey(opened.pack.id, opened.pack.release)}
          initial={opened.pack}
          revision={opened.revision}
          country={props.profile.code}
          busy={desk.busy}
          onSave={desk.save}
          onClose={close}
        />
      ) : (
        <>
          {!desk.ready && !desk.error && (
            <Text accessibilityLiveRegion="polite" style={s.body}>
              {t('editorItem.loading')}
            </Text>
          )}
          <Button
            testID="draft-reload"
            label={t('editorItem.reload')}
            variant="plain"
            disabled={desk.busy}
            onPress={() => {
              close();
              desk.reload();
            }}
          />
          <Button
            testID="draft-new"
            label={t('editorItem.newPack')}
            disabled={!desk.ready}
            onPress={() => {
              if (!desk.ready) return;
              setCopy(null);
              setCreating(true);
              setCopying(false);
            }}
          />
          {creating && (
            <SourceForm
              reserved={reserved}
              country={props.profile.code}
              pack={null}
              initial={copy}
              onKeep={(pack) => {
                setOpened({ pack, revision: 0 });
                setCreating(false);
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
                {one.pack.id} · {one.pack.release}
              </Text>
              <Text style={s.body}>{t(`editorItem.stage.${one.stage}`)}</Text>
              {one.actor === 'curator' && ['draft', 'under-review'].includes(one.stage) ? (
                <Button
                  testID={`draft-open-${one.pack.release}`}
                  label={t('editorItem.open')}
                  disabled={!desk.ready}
                  onPress={() => setOpened({ pack: one.pack, revision: one.revision })}
                />
              ) : (
                <Text style={s.body}>{t('editorItem.readOnly')}</Text>
              )}
              <Button
                label={t('editorItem.copy')}
                variant="plain"
                disabled={!desk.ready}
                onPress={() => {
                  setCopy(one.pack);
                  setCopying(true);
                }}
              />
            </View>
          ))}
          <PackList
            packs={props.packs}
            profile={props.profile}
            refusedPacks={props.refusedPacks}
            onCopy={
              desk.ready
                ? (pack) => {
                    setCopy(pack);
                    setCopying(true);
                  }
                : undefined
            }
          />
          {copying && copy !== null && (
            <SourceForm
              reserved={reserved}
              key={packReleaseKey(copy.id, copy.release)}
              country={props.profile.code}
              pack={null}
              initial={copy}
              onKeep={(pack) => {
                setOpened({ pack, revision: 0 });
                setCopying(false);
              }}
              onCancel={close}
            />
          )}
        </>
      )}
    </View>
  );
}
