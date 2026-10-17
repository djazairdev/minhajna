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
  },
};

/** Fills a sample's {{name}} placeholders. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => String(values[name] ?? whole));
}
