// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One item in an open draft, with its edit, move and remove actions, each named
// after the item. Removing saves at once, so it asks first, with the safe
// answer holding the focus.

import type { PackItem } from '@minhajna/core';
import type { Ref } from 'react';
import { Text, View, type ViewInstance } from 'react-native';
import { Button } from '../components/Button';
import { useDeviceText } from '../text/device-text';
import { editorStyles as s } from './editor-styles';

export function PackDraftItem({
  item,
  first,
  busy,
  asking,
  onMark,
  keepRef,
  onEdit,
  onUp,
  onAsk,
  onKeep,
  onRemove,
}: {
  readonly item: PackItem;
  readonly first: boolean;
  readonly busy: boolean;
  readonly asking: boolean;
  readonly onMark: (key: string, node: ViewInstance | null) => void;
  readonly keepRef: Ref<ViewInstance>;
  readonly onEdit: () => void;
  readonly onUp: () => void;
  readonly onAsk: () => void;
  readonly onKeep: () => void;
  readonly onRemove: () => void;
}) {
  const t = useDeviceText();
  return (
    <View style={s.card}>
      <Text selectable style={s.body}>
        {item.title}
      </Text>
      <View style={s.row}>
        <Button
          ref={(node) => onMark(`edit-${item.id}`, node)}
          testID={`draft-edit-${item.id}`}
          label={t('editorItem.edit')}
          name={t('editorItem.editNamed', { title: item.title })}
          variant="plain"
          disabled={busy}
          onPress={onEdit}
        />
        <Button
          testID={`draft-up-${item.id}`}
          label={t('editorItem.moveUp')}
          name={t('editorItem.moveUpNamed', { title: item.title })}
          variant="plain"
          disabled={busy || first}
          onPress={onUp}
        />
        <Button
          ref={(node) => onMark(`remove-${item.id}`, node)}
          testID={`draft-remove-${item.id}`}
          label={t('editorItem.remove')}
          name={t('editorItem.removeNamed', { title: item.title })}
          variant="plain"
          disabled={busy}
          onPress={onAsk}
        />
      </View>
      {asking && (
        <>
          <Text accessibilityLiveRegion="polite" style={s.body}>
            {t('editorItem.removeAsk', { title: item.title })}
          </Text>
          <View style={s.row}>
            <Button
              ref={keepRef}
              testID={`draft-remove-no-${item.id}`}
              label={t('editorItem.removeNo')}
              variant="plain"
              disabled={busy}
              onPress={onKeep}
            />
            <Button
              testID={`draft-remove-yes-${item.id}`}
              label={t('editorItem.removeYes')}
              variant="danger"
              disabled={busy}
              onPress={onRemove}
            />
          </View>
        </>
      )}
    </View>
  );
}
