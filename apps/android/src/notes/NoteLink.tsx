// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The row «تفاصيل الحصة» gives a session's lesson note (#237, answer 419):
// «المذكرة 9» once it is kept, «مذكرة الدرس» before, with the lesson's
// title. A session with no lesson from the plan has none.

import type { Day } from '@minhajna/core';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { useText } from '../text/i18n';
import { useNote } from './useNote';

export function NoteLink({ sessionKey, day, onOpen }: { sessionKey: string; day: Day; onOpen: () => void }) {
  const t = useText();
  const note = useNote(sessionKey, day);
  if (note === null) return null;
  return (
    <RowLink
      testID="entry-note-link"
      icon={controlIcon('pencil')}
      title={note.note === undefined ? t('notes.link') : t('notes.number', { number: note.number })}
      description={note.draft.resource}
      onPress={onOpen}
    />
  );
}
