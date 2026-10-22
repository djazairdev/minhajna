// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «المذكرات» in «الوثائق» (#237, Docs, answer 419): the note of the next
// session from today still awaiting confirmation that has a lesson, with
// its number and whether every plan paragraph is kept, or a new one. A tap
// opens that note. With no such session the row is not shown.

import { courseSetup, noteDraft } from '@minhajna/core';
import { useMemo } from 'react';
import { RowLink } from '../components/RowLink';
import type { DocumentData } from '../documents/document-data';
import { controlIcon } from '../design/Icon';
import { coreContext } from '../storage/core-context';
import { useText } from '../text/i18n';
import { shortDay } from '../today/outcome-rules';
import { isolate } from '../week/grid-labels';
import { nextNoted, noteBlocks } from './note-rules';

export function NotesRow({ data, onOpen }: { data: DocumentData; onOpen: (key: string, day: string) => void }) {
  const t = useText();
  const line = useMemo(() => {
    const context = coreContext(data);
    const next = nextNoted(context, data.today ?? data.day);
    if (next === null) return null;
    const { session, itemId, note } = next;
    const className = isolate(courseSetup(context, session.courseId).schoolClass.name);
    const words = { className, day: shortDay(t, session.day) };
    const draft = noteDraft(context, session.courseId, itemId);
    const done = draft !== null && noteBlocks(t, draft, note).every((block) => block.inked);
    const text =
      note === undefined
        ? t('notes.row.fresh', words)
        : t(done ? 'notes.row.done' : 'notes.row.awaiting', { ...words, number: note.number });
    return { text, key: session.key, day: session.day };
  }, [data, t]);
  if (line === null) return null;
  return (
    <RowLink
      testID="documents-notes"
      icon={controlIcon('pencil')}
      title={t('notes.row.name')}
      description={line.text}
      onPress={() => onOpen(line.key, line.day)}
    />
  );
}
