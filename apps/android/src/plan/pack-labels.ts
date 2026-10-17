// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words for a plan pack (#30, PRD §4.2): its status, its timing, where
// it comes from, and the grade and subject it is for. An example pack says
// what it is instead of a source, so it is never taken for a plan.

import type { CountryProfile, PlanPack } from '@minhajna/core';
import { localized } from '../setup/names';
import type { useText } from '../text/i18n';
import type { PlanGroup } from './plan-rules';

type Translate = ReturnType<typeof useText>;

/** Such as «اللغة العربية · السنة الرابعة متوسط». */
export function groupName(t: Translate, profile: CountryProfile, group: Pick<PlanGroup, 'grade' | 'subject'>): string {
  const subject = profile.subjects.find((candidate) => candidate.code === group.subject);
  const grade = profile.levels.flatMap((level) => level.grades).find((candidate) => candidate.code === group.grade);
  return t('plan.group', {
    subject: subject ? localized(subject.name) : group.subject,
    grade: grade ? localized(grade.name) : group.grade,
  });
}

/** Its timing and release, such as «التوقيت: حصص لكل عنصر · الإصدار 2026.1». */
export function packFacts(t: Translate, pack: PlanPack): string {
  const anchor = pack.anchor.kind === 'budgets' ? pack.anchor.unit : pack.anchor.kind;
  return `${t(`plan.anchor.${anchor}`)} · ${t('plan.release', { release: pack.release })}`;
}

/** Where it comes from, or, for an example, that it is not a plan. */
export function packSource(t: Translate, pack: PlanPack): string {
  return pack.status === 'example'
    ? t('plan.meaning.example')
    : t('plan.provenance', { edition: pack.provenance.edition, issuer: pack.provenance.issuer });
}
