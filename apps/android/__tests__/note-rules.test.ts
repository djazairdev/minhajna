// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind the lesson note screens (#237, answers 416 to 419): the
// lesson a session's note is for, the paragraphs in grey or in ink with
// their titles and the textbook's pages, and whether a note has text.

import type { LessonNote, NoteDraft, SessionRecord } from '@minhajna/core';
import { hasText, noteBlocks, planTitle, proposedText, sessionItem } from '../src/notes/note-rules';
import { i18n } from '../src/text/i18n';

const t = i18n.t.bind(i18n);

const draft: NoteDraft = {
  unit: 'المقطع 1 (مثال)',
  resource: 'فهم المكتوب 1 (مثال)',
  minutes: 120,
  pages: '12–13',
  proposals: [
    { key: 'indicator', text: '' },
    { key: 'objectives', text: '' },
    { key: 'resources', text: '' },
    { key: 'stage-1', stage: 'تهيئة', text: '' },
    { key: 'stage-2', stage: 'بناء', text: 'قراءة نموذجية' },
  ],
};

const note = (paragraphs: LessonNote['paragraphs']): LessonNote => ({
  id: 'n-1',
  courseId: 'c-1',
  itemId: 'u1-3',
  number: 3,
  paragraphs,
});

afterEach(() => i18n.changeLanguage('ar'));

test('finds the lesson a session’s note is for: proposed, or first taught, and none for free content', () => {
  const recorded = (coverage: SessionRecord['coverage']) => ({ coverage }) as unknown as SessionRecord;
  const proposal = { item: { id: 'u1-2' } } as never;
  expect(sessionItem({ proposal, record: null })).toBe('u1-2');
  expect(sessionItem({ proposal: null, record: null })).toBeNull();
  expect(
    sessionItem({
      proposal: null,
      record: recorded([
        { op: 'skipped', item: 'u1-1' },
        { op: 'taught', item: 'u1-2', from: 0, to: 2 },
      ]),
    }),
  ).toBe('u1-2');
  expect(sessionItem({ proposal: null, record: recorded([{ op: 'retaught', item: 'd1' }]) })).toBe('d1');
  expect(sessionItem({ proposal: null, record: recorded([]) })).toBeNull();
});

test('titles the plan paragraphs and proposes the textbook’s pages for «السندات»', () => {
  expect(planTitle(t, 'indicator', draft)).toBe('مؤشر الكفاءة');
  expect(planTitle(t, 'stage-2', draft)).toBe('بناء');
  expect(planTitle(t, 'stage-7', draft)).toBe('المرحلة 7');
  expect(proposedText(t, 'resources', draft)).toBe('الكتاب المدرسي ص 12–13');
  expect(proposedText(t, 'resources', { ...draft, pages: undefined })).toBe('');
  expect(proposedText(t, 'stage-2', draft)).toBe('قراءة نموذجية');
});

test('shows the plan’s paragraphs in grey until kept, then any left from an older plan, then the teacher’s own', () => {
  expect(noteBlocks(t, draft, undefined).map((block) => [block.key, block.inked, block.text])).toEqual([
    ['indicator', false, ''],
    ['objectives', false, ''],
    ['resources', false, 'الكتاب المدرسي ص 12–13'],
    ['stage-1', false, ''],
    ['stage-2', false, 'قراءة نموذجية'],
  ]);
  const kept = note([
    { key: 'objectives', text: 'يقرأ' },
    { key: 'stage-5', text: 'من مذكرة سابقة' },
    { title: 'الواجب', text: 'التمرين 3' },
    { title: 'ملاحظة', text: 'السبورة' },
  ]);
  const blocks = noteBlocks(t, draft, kept);
  expect(blocks.map((block) => [block.key ?? block.own, block.title, block.inked, block.text])).toEqual([
    ['indicator', 'مؤشر الكفاءة', false, ''],
    ['objectives', 'الأهداف', true, 'يقرأ'],
    ['resources', 'السندات', false, 'الكتاب المدرسي ص 12–13'],
    ['stage-1', 'تهيئة', false, ''],
    ['stage-2', 'بناء', false, 'قراءة نموذجية'],
    ['stage-5', 'المرحلة 5', true, 'من مذكرة سابقة'],
    [0, 'الواجب', true, 'التمرين 3'],
    [1, 'ملاحظة', true, 'السبورة'],
  ]);
  expect(blocks[1]?.proposed).toBe('');
});

test('says whether a note has any written text', () => {
  expect(hasText(undefined)).toBe(false);
  expect(hasText(note([]))).toBe(false);
  expect(hasText(note([{ key: 'indicator', text: '  ' }]))).toBe(false);
  expect(hasText(note([{ title: 'الواجب', text: 'التمرين 3' }]))).toBe(true);
});

test('words the paragraphs in French and English', async () => {
  await i18n.changeLanguage('fr');
  expect(planTitle(t, 'resources', draft)).toBe('Supports');
  expect(proposedText(t, 'resources', draft)).toBe('Manuel p. 12–13');
  await i18n.changeLanguage('en');
  expect(planTitle(t, 'stage-3', draft)).toBe('Stage 3');
});
