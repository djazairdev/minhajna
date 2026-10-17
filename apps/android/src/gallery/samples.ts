// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The gallery's own words and its made-up content, in each interface language.
// The gallery is a developer's tool in debug builds only, so these texts stay
// out of the catalogues and out of Weblate. A component's own texts, such as
// its screen-reader labels, still come from the catalogue. Content is made up:
// never a real pupil, teacher or school.

import type { Language } from '../text/i18n';
import type { ButtonVariant } from '../components/Button';

export type Sample = {
  readonly title: string;
  readonly textSize: string;
  readonly direction: string;
  readonly rtl: string;
  readonly ltr: string;
  readonly design: string;
  readonly heading: string;
  readonly longHeading: string;
  readonly tabs: readonly [string, string, string];
  readonly longTabs: readonly [string, string, string];
  readonly buttons: Readonly<Record<ButtonVariant, string>>;
  readonly addButton: string;
  readonly enabled: string;
  readonly disabled: string;
  readonly back: string;
  readonly add: string;
  readonly activations: string;
  readonly headings: {
    readonly day: string;
    readonly date: string;
    readonly fact: string;
    readonly scope: string;
    readonly settings: string;
    readonly addSession: string;
    readonly section: string;
    readonly count: string;
    readonly emptyCount: string;
  };
  readonly feedback: {
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
  readonly fields: {
    readonly label: string;
    readonly example: string;
    readonly value: string;
    readonly areaLabel: string;
    readonly areaValue: string;
    readonly noteLabel: string;
    readonly optionalLabel: string;
    readonly error: string;
    readonly codeLabel: string;
    readonly codeExample: string;
    readonly codeValue: string;
    readonly numberLabel: string;
    readonly numberExample: string;
    readonly numberValue: string;
  };
  readonly choices: {
    readonly check: string;
    readonly stage: string;
    readonly option: string;
    readonly other: string;
    readonly privacy: string;
  };
};

/** The gallery's texts and made-up content, by interface language. */
export const samples: Readonly<Record<Language, Sample>> = {
  ar: {
    title: 'معرض المكوّنات',
    textSize: 'حجم الخط: {{percent}}%. غيّره من إعدادات الهاتف.',
    direction: 'الاتجاه',
    rtl: 'من اليمين',
    ltr: 'من اليسار',
    design: 'صفحته في نظام التصميم:',
    heading: 'حصة الرياضيات',
    longHeading: 'تصحيح الفرض المحروس الأول في الرياضيات مع القسم الأول متوسط',
    tabs: ['اليوم', 'الأقسام', 'الوثائق'],
    longTabs: ['حصص اليوم كلها', 'أقسامي هذه السنة', 'وثائق المؤسسة'],
    buttons: { primary: 'حفظ', line: 'تعديل', soft: 'المناداة', plain: 'تراجع', danger: 'حذف' },
    addButton: 'إضافة',
    enabled: 'متاح',
    disabled: 'غير متاح',
    back: 'رجوع',
    add: 'إضافة حصة',
    activations: 'عدد الضغطات المتاحة: {{count}}',
    headings: {
      day: 'الأحد',
      date: '4 أكتوبر 2026',
      fact: '3 حصص بانتظار التأكيد',
      scope: 'المؤسسة التجريبية · 2026/2027',
      settings: 'الإعدادات',
      addSession: '+ حصة',
      section: 'الفوج الأول',
      count: '18 تلميذاً',
      emptyCount: '0 تلاميذ',
    },
    feedback: {
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
    fields: {
      label: 'الواجب',
      example: 'مثال: التمرين 5',
      value: 'التمرين 5',
      areaLabel: 'المحتوى',
      areaValue: 'مراجعة الجمع.\nحلّ التمرين 5.\nتصحيح الحلّ.',
      noteLabel: 'ملاحظة',
      optionalLabel: 'اختياري',
      error: 'أدخل الواجب.',
      codeLabel: 'الرمز',
      codeExample: 'مثال: CEM-01',
      codeValue: 'CEM-01',
      numberLabel: 'العدد',
      numberExample: 'مثال: 12',
      numberValue: '12',
    },
    choices: {
      check: 'أُجري فرض في هذه الحصة',
      stage: 'تصحيح الواجب المنزلي',
      option: 'لم تُنجز الحصة',
      other: 'إعادة درس سابق',
      privacy: 'ذكر السبب اختياري، ويبقى على الهاتف',
    },
  },
  fr: {
    title: 'Galerie des composants',
    textSize: 'Taille du texte : {{percent}} %. Changez-la dans les réglages du téléphone.',
    direction: 'Sens',
    rtl: 'De droite à gauche',
    ltr: 'De gauche à droite',
    design: 'Sa page dans le système de conception :',
    heading: 'Séance de mathématiques',
    longHeading: 'Correction du premier devoir surveillé de mathématiques avec la première année moyenne',
    tabs: ['Aujourd’hui', 'Classes', 'Documents'],
    longTabs: ['Toutes les séances du jour', 'Mes classes de l’année', 'Documents de l’établissement'],
    buttons: {
      primary: 'Enregistrer',
      line: 'Modifier',
      soft: 'Appel',
      plain: 'Annuler',
      danger: 'Supprimer',
    },
    addButton: 'Ajouter',
    enabled: 'Disponible',
    disabled: 'Indisponible',
    back: 'Retour',
    add: 'Ajouter une séance',
    activations: 'Activations disponibles : {{count}}',
    headings: {
      day: 'Dimanche',
      date: '4 octobre 2026',
      fact: '3 séances attendent une confirmation',
      scope: 'Établissement de démonstration · 2026/2027',
      settings: 'Réglages',
      addSession: '+ Séance',
      section: 'Premier groupe',
      count: '18 élèves',
      emptyCount: '0 élève',
    },
    feedback: {
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
    fields: {
      label: 'Devoir',
      example: 'Ex. : exercice 5',
      value: 'Exercice 5',
      areaLabel: 'Contenu',
      areaValue: 'Réviser l’addition.\nFaire l’exercice 5.\nCorriger les réponses.',
      noteLabel: 'Note',
      optionalLabel: 'facultatif',
      error: 'Indiquez le devoir.',
      codeLabel: 'Code',
      codeExample: 'Ex. : CEM-01',
      codeValue: 'CEM-01',
      numberLabel: 'Nombre',
      numberExample: 'Ex. : 12',
      numberValue: '12',
    },
    choices: {
      check: 'Un devoir a eu lieu pendant cette séance',
      stage: 'Correction du travail à la maison',
      option: 'Séance non tenue',
      other: 'Reprendre une leçon',
      privacy: 'Le motif est facultatif et reste sur le téléphone',
    },
  },
  en: {
    title: 'Component gallery',
    textSize: 'Text size: {{percent}}%. Change it in the phone’s settings.',
    direction: 'Direction',
    rtl: 'Right to left',
    ltr: 'Left to right',
    design: 'Its page in the design system:',
    heading: 'Mathematics lesson',
    longHeading: 'Going over the first mathematics test with the first year of middle school',
    tabs: ['Today', 'Classes', 'Documents'],
    longTabs: ['All of today’s lessons', 'My classes this year', 'The school’s documents'],
    buttons: {
      primary: 'Save',
      line: 'Edit',
      soft: 'Roll call',
      plain: 'Cancel',
      danger: 'Delete',
    },
    addButton: 'Add',
    enabled: 'Available',
    disabled: 'Unavailable',
    back: 'Back',
    add: 'Add lesson',
    activations: 'Available activations: {{count}}',
    headings: {
      day: 'Sunday',
      date: '4 October 2026',
      fact: '3 sessions await confirmation',
      scope: 'Demo school · 2026/2027',
      settings: 'Settings',
      addSession: '+ Session',
      section: 'First group',
      count: '18 pupils',
      emptyCount: '0 pupils',
    },
    feedback: {
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
    fields: {
      label: 'Homework',
      example: 'e.g. Exercise 5',
      value: 'Exercise 5',
      areaLabel: 'Content',
      areaValue: 'Revise addition.\nDo exercise 5.\nCorrect the answers.',
      noteLabel: 'Note',
      optionalLabel: 'optional',
      error: 'Enter the homework.',
      codeLabel: 'Code',
      codeExample: 'e.g. CEM-01',
      codeValue: 'CEM-01',
      numberLabel: 'Number',
      numberExample: 'e.g. 12',
      numberValue: '12',
    },
    choices: {
      check: 'A test took place in this session',
      stage: 'Going over homework',
      option: 'Session not held',
      other: 'Re-teach a lesson',
      privacy: 'A reason is optional and stays on this phone',
    },
  },
};

/** Fills a sample's {{name}} placeholders. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => String(values[name] ?? whole));
}
