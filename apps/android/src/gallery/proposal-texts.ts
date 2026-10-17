// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up content for the Proposal and DueStrip samples, in each interface
// language: never a real pupil, teacher or school.

import type { Language } from '../text/i18n';

export type ProposalTexts = {
  readonly tag: string;
  readonly continuesTag: string;
  readonly domain: string;
  readonly topic: string;
  readonly domainValue: string;
  readonly topicValue: string;
  readonly stages: readonly string[];
  readonly longTopic: string;
  readonly longStages: readonly string[];
  readonly noAbsence: string;
  readonly rollCall: string;
  readonly homeworkDue: string;
  readonly count: string;
};

/** The Proposal and DueStrip samples' texts, by interface language. */
export const proposalTexts: Readonly<Record<Language, ProposalTexts>> = {
  ar: {
    tag: 'مقترح من المخطط',
    continuesTag: 'مقترح من المخطط · يتابع من الحصة السابقة',
    domain: 'الميدان',
    topic: 'الموضوع',
    domainValue: 'أعمال موجهة',
    topicValue: 'مراجعة العدد والمعدود',
    stages: ['- مجموعة من التطبيقات حول درس الظاهرة اللغوية', '- تصحيح الواجب المنزلي'],
    longTopic:
      'تابع: قراءة نص «رحلة إلى الواحة» وفهمه، مع شرح المفردات الجديدة واستخراج الفكرة العامة والأفكار الأساسية',
    longStages: ['- المرحلة 3 من 4: التطبيق', '- المرحلة 4 من 4: التقويم'],
    noAbsence: 'لا غياب مسجّل',
    rollCall: 'المناداة',
    homeworkDue: 'يُسلَّم اليوم: التمرين 2 ص 21',
    count: 'إحصاء',
  },
  fr: {
    tag: 'Proposé par le plan',
    continuesTag: 'Proposé par le plan · suite de la séance précédente',
    domain: 'Domaine',
    topic: 'Sujet',
    domainValue: 'Travaux dirigés',
    topicValue: 'Révision du nombre et du dénombré',
    stages: ['- Exercices sur la leçon de grammaire', '- Correction du devoir à la maison'],
    longTopic:
      'Suite : lecture et compréhension du texte « Voyage à l’oasis », avec le nouveau vocabulaire, l’idée générale et les idées principales',
    longStages: ['- Étape 3 sur 4 : application', '- Étape 4 sur 4 : évaluation'],
    noAbsence: 'Aucune absence notée',
    rollCall: 'Appel',
    homeworkDue: 'À rendre aujourd’hui : exercice 2 p. 21',
    count: 'Compter',
  },
  en: {
    tag: 'Proposed by the plan',
    continuesTag: 'Proposed by the plan · continues from last session',
    domain: 'Domain',
    topic: 'Topic',
    domainValue: 'Guided work',
    topicValue: 'Revising numbers and counted nouns',
    stages: ['- Exercises on the grammar lesson', '- Correcting the homework'],
    longTopic:
      'Continued: reading and understanding the text “A trip to the oasis”, with the new words, the main idea and the key points',
    longStages: ['- Stage 3 of 4: practice', '- Stage 4 of 4: assessment'],
    noAbsence: 'No absence recorded',
    rollCall: 'Roll call',
    homeworkDue: 'Due today: exercise 2, p. 21',
    count: 'Count',
  },
};
