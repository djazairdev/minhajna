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
  },
};

/** Fills a sample's {{name}} placeholders. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => String(values[name] ?? whole));
}
