// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words of «إصدار جديد للمخطط» (#322, Pack-release, answers 487 and
// 488): the row on the plan and in Settings that names a newer release and
// its fixes; each change of «ما تغيّر» by kind; the classes on an older
// release, each on its own; the effect of a move on the class's buffer before
// the exams; each question in the plan's words, with the release's entry that
// makes it unclear; and how the class's own changes and each layer are carried.

import {
  compareReleases,
  courseSetup,
  findPackItem,
  isChange,
  newerRelease,
  packKey,
  releaseChain,
  releaseChanges,
  type Context,
  type MoveList,
  type MovePlan,
  type MoveQuestion,
  type PinnedPack,
  type PlanDecision,
  type PlanPack,
  type ReleaseChange,
  type TermCheck,
} from '@minhajna/core';
import { termName } from '../exams/course-label';
import { currentLanguage, type useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { changeText } from './changes-rules';

type Translate = ReturnType<typeof useText>;
type Moving = Extract<MovePlan, { ok: true }>;

const quoted = (t: Translate, title: string) => t('tests.quoted', { title: isolate(title) });
const comma = () => (currentLanguage() === 'ar' ? '، ' : ', ');

/** The row naming a newer release of the class's pack and its fixes; null when the app has none. */
export function newerRow(
  t: Translate,
  packs: Iterable<PlanPack>,
  pinned: PinnedPack,
): { readonly release: string; readonly text: string } | null {
  const all = [...packs];
  const newer = newerRelease(all, pinned);
  if (newer === null) return null;
  const from = all.find((pack) => pack.id === pinned.id && pack.release === pinned.release);
  const chain = releaseChain(all, newer, pinned.release);
  const words = { release: newer.release, current: pinned.release };
  if (from === undefined || !chain.ok) return { release: newer.release, text: t('packRelease.rowOnly', words) };
  const count = releaseChanges(from, newer, chain.steps).length;
  return { release: newer.release, text: t('packRelease.row', { ...words, fixes: t('packRelease.count', { count }) }) };
}

/** Each change of «ما تغيّر»: its kind and its line, with the note under a renamed item. */
export function changeRows(t: Translate, changes: readonly ReleaseChange[]): { kind: string; text: string }[] {
  const page = (value: string | undefined) =>
    value === undefined ? t('packRelease.noPage') : t('packRelease.pageNumber', { page: isolate(value) });
  return changes.map((change) => {
    const kind = t(`packRelease.kinds.${change.kind}`);
    switch (change.kind) {
      case 'page':
        return {
          kind,
          text: t('packRelease.page', {
            item: quoted(t, change.item.title),
            from: page(change.from),
            to: page(change.to),
          }),
        };
      case 'title':
        return {
          kind,
          text: t('packRelease.renamed', { from: quoted(t, change.from.title), to: quoted(t, change.to.title) }),
        };
      case 'split': {
        const parts = change.to.map((item) => quoted(t, item.title)).join(t('packRelease.then'));
        const into = t('packRelease.into', { count: change.to.length });
        return { kind, text: t('packRelease.split', { item: quoted(t, change.from.title), into, parts }) };
      }
      case 'merge': {
        const items = change.from.map((item) => quoted(t, item.title)).join(comma());
        return { kind, text: t('packRelease.merged', { items, item: quoted(t, change.to.title) }) };
      }
      default:
        return { kind, text: quoted(t, change.item.title) };
    }
  });
}

/** The classes on an older release of the pack, this year's and not archived, each with its release. */
export function classesOn(context: Context, pack: PlanPack): { courseId: string; name: string; release: string }[] {
  return [...context.state.courses.values()].flatMap((course) => {
    const schoolClass = context.state.classes.get(course.classId);
    const pin = course.pack;
    if (pin == null || pin.id !== pack.id || compareReleases(pin.release, pack.release) >= 0) return [];
    if (schoolClass === undefined || schoolClass.archivedFrom !== undefined) return [];
    if (course.year !== context.ref.year.id) return [];
    return [{ courseId: course.id, name: schoolClass.name, release: pin.release }];
  });
}

/** The class's buffer before its exams, now and once moved; null without a check. */
export function effectLine(
  t: Translate,
  className: string,
  before: TermCheck | null,
  after: TermCheck | null,
): string | null {
  if (before === null || after === null) return null;
  const spare = (check: TermCheck) => {
    const count = Math.round(check.gives - check.needs);
    return count >= 0
      ? t('classes.spare', { count })
      : t('packRelease.short', { sessions: t('count.sessions', { count: -count }) });
  };
  const words = { class: isolate(className) };
  if (spare(before) === spare(after)) return t('packRelease.effectSame', { ...words, spare: spare(before) });
  return t('packRelease.effect', { ...words, from: spare(before), to: spare(after) });
}

/** A change as the class reads it now, in the plan's words: one of its own, or an exam-window answer. */
export function decisionText(t: Translate, context: Context, courseId: string, plan: Moving, decision: PlanDecision) {
  const pack = courseSetup(context, courseId).pack ?? plan.from;
  if (isChange(decision)) return decision.kind === 'undo' ? '' : changeText(t, context, pack, plan.from)(decision).text;
  const named = (id: string) => quoted(t, findPackItem(pack, id)?.title ?? findPackItem(plan.from, id)?.title ?? id);
  switch (decision.kind) {
    case 'leave-out':
      return t('examWindow.leftOut', { item: named(decision.item) });
    case 'merge':
      return t('examWindow.merged', { first: named(decision.items[0]), second: named(decision.items[1]) });
    case 'postpone':
      return t('examWindow.postponedAfter', {
        term: termName(t, decision.term),
        items: decision.items.map(named).join(comma()),
      });
  }
}

/** A question in full: the change, where it is, and the newer release's entry that makes it unclear. */
export function questionText(t: Translate, context: Context, courseId: string, plan: Moving, question: MoveQuestion) {
  const older = (id: string) => quoted(t, findPackItem(plan.from, id)?.title ?? id);
  const where =
    question.layer === undefined
      ? t('packRelease.inMine')
      : t('packRelease.inLayer', { layer: quoted(t, question.layer.title) });
  const { entry } = question;
  const text =
    entry.kind === 'split'
      ? t('packRelease.entrySplit', {
          item: older(entry.from),
          into: t('packRelease.splitInto', { count: entry.to.length }),
        })
      : entry.kind === 'merge'
        ? t('packRelease.entryMerge', {
            items: entry.from.map(older).join(comma()),
            item: quoted(t, titleIn(plan.to, entry.to)),
          })
        : t('packRelease.entryOther');
  return t('packRelease.question', {
    what: decisionText(t, context, courseId, plan, question.decision),
    where,
    release: question.release,
    entry: text,
  });
}

/** An item's title in a release, or its ID. */
export function titleIn(pack: PlanPack, id: string): string {
  return findPackItem(pack, id)?.title ?? id;
}

/** How a list of changes is carried, as the layers section says it. */
export function listLine(t: Translate, list: MoveList): string {
  return t(
    list.carried === 'as-is'
      ? 'packRelease.asIs'
      : list.carried === 'asked'
        ? 'packRelease.asked'
        : 'packRelease.withEntries',
  );
}

/** The release's pack on the phone, by the route's pack ID and release. */
export function releaseOf(context: Context, packId: string, release: string): PlanPack | undefined {
  return context.ref.packs.get(packKey(packId, release));
}
