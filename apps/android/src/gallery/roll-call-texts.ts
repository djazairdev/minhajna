// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up content for the RollCallRow and Stats samples, in each interface
// language: a class of 45 pupils whose names are each made of a made-up
// family name and first name, never a real pupil.

import type { Language } from '../text/i18n';

export type RollCallTexts = {
  readonly families: readonly string[];
  readonly firsts: readonly string[];
  readonly present: string;
  readonly absent: string;
  readonly late: string;
};

/** Nine family names by five first names: 45 made-up pupils. */
export function madeUpClass(texts: RollCallTexts): string[] {
  return texts.families.flatMap((family) => texts.firsts.map((first) => `${family} ${first}`));
}

/** The RollCallRow and Stats samples' texts, by interface language. */
export const rollCallTexts: Readonly<Record<Language, RollCallTexts>> = {
  ar: {
    families: ['مختلق', 'تجريبي', 'نموذجي', 'مثالي', 'افتراضي', 'خيالي', 'وهمي', 'تخيلي', 'صوري'],
    firsts: ['ريان', 'آية', 'سلمى', 'زكرياء', 'نور'],
    present: 'حضور',
    absent: 'غياب',
    late: 'تأخر، لا يُحسب غياباً',
  },
  fr: {
    families: ['Exemple', 'Essai', 'Modèle', 'Fictif', 'Imaginé', 'Inventé', 'Factice', 'Témoin', 'Brouillon'],
    firsts: ['Rayane', 'Aya', 'Salma', 'Zakaria', 'Nour'],
    present: 'Présents',
    absent: 'Absences',
    late: 'Retards, non comptés comme absences',
  },
  en: {
    families: ['Sample', 'Trial', 'Model', 'Fictive', 'Imagined', 'Invented', 'Madeup', 'Mock', 'Draft'],
    firsts: ['Rayane', 'Aya', 'Salma', 'Zakaria', 'Nour'],
    present: 'Present',
    absent: 'Absent',
    late: 'Late, not counted as absent',
  },
};
