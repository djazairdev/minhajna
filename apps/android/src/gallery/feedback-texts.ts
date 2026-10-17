// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up content for the Notice and Snackbar samples, in each interface
// language: never a real pupil, teacher or school.

import type { Language } from '../text/i18n';

export type FeedbackTexts = {
  readonly reassurance: string;
  readonly longReassurance: string;
  readonly badge: string;
  readonly title: string;
  readonly instruction: string;
  readonly confirmation: string;
  readonly longConfirmation: string;
  readonly undo: string;
  readonly show: string;
  readonly undone: string;
};

/** The Notice and Snackbar samples' texts, by interface language. */
export const feedbackTexts: Readonly<Record<Language, FeedbackTexts>> = {
  ar: {
    reassurance: 'يمكن تصحيح أي حصة لاحقاً، ويُحفظ كل تعديل.',
    longReassurance: 'الحضور هو الأصل، ويُعلَّم الغياب والتأخر فقط. يمكن التسجيل بعد الحصة، والتصحيح في أي وقت.',
    badge: 'أولاً',
    title: 'اختر التقويم',
    instruction: 'اختر التقويم الدراسي قبل المتابعة لتحديد أيام الدراسة والعطل.',
    confirmation: 'كُتبت الحصة في دفتر النصوص',
    longConfirmation: 'سُجّلت حصة مراجعة الجمع وحلّ التمرين 5 في دفتر النصوص للقسم التجريبي.',
    undo: 'تراجع',
    show: 'جرّب التأكيد',
    undone: 'أُلغي التأكيد التجريبي.',
  },
  fr: {
    reassurance: 'Chaque séance peut être corrigée plus tard. Chaque modification est conservée.',
    longReassurance:
      'La présence est la règle : seuls les absences et retards sont à noter. Vous pouvez compléter l’appel après la séance et le corriger plus tard.',
    badge: 'D’abord',
    title: 'Choisir le calendrier',
    instruction:
      'Choisissez le calendrier scolaire avant de continuer pour définir les jours de classe et les vacances.',
    confirmation: 'La séance a été notée.',
    longConfirmation:
      'La séance de révision de l’addition et de correction de l’exercice 5 a été notée pour la classe de démonstration.',
    undo: 'Annuler',
    show: 'Essayer',
    undone: 'La confirmation de démonstration a été annulée.',
  },
  en: {
    reassurance: 'You can correct any session later. Each change is kept.',
    longReassurance:
      'Pupils are present by default: record only absences and lateness. You can complete the roll call after the session and correct it later.',
    badge: 'First',
    title: 'Choose the calendar',
    instruction: 'Choose the school calendar before continuing to set teaching days and holidays.',
    confirmation: 'The session was recorded.',
    longConfirmation:
      'The session revising addition and correcting exercise 5 was recorded in the journal for the demo class.',
    undo: 'Undo',
    show: 'Try it',
    undone: 'The demonstration confirmation was undone.',
  },
};
