// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo class (PRD §1.5, §5.12): 45 made-up pupils whose names look like a
// real Algerian class list, for trying the app, screenshots, tutorials and
// bug reports, never a real pupil. The names are common given names and
// family names put together at random. They are written as class lists write
// them, family name first, in Arabic and in Latin letters. Some are long, some
// carry a hamza, and some pupils share a family name, so nothing is told apart
// by name. Registration numbers start with 99, which no school gives out.

import type { Pupil } from './records.ts';

export interface DemoPupil {
  readonly name: string;
  readonly latinName: string;
  readonly sex: 'f' | 'm';
}

const pupil = (name: string, latinName: string, sex: 'f' | 'm'): DemoPupil => ({ name, latinName, sex });

/** In no order: a class list is sorted when it is shown. */
export const DEMO_PUPILS: readonly DemoPupil[] = [
  pupil('بوزيد ياسين', 'Bouzid Yacine', 'm'),
  pupil('حداد أنس', 'Haddad Anes', 'm'),
  pupil('شريف مريم', 'Cherif Meriem', 'f'),
  pupil('بن عبد الرحمن فاطمة الزهراء', 'Benabderrahmane Fatima Zohra', 'f'),
  pupil('زروقي عبد الرؤوف', 'Zerrouki Abderraouf', 'm'),
  pupil('بوزيد آية', 'Bouzid Aya', 'f'),
  pupil('مسعودي إسراء', 'Messaoudi Israa', 'f'),
  pupil('بلقاسمي أيوب', 'Belkacemi Ayoub', 'm'),
  pupil('بن علي لؤي', 'Benali Louai', 'm'),
  pupil('عمراني عائشة', 'Amrani Aicha', 'f'),
  pupil('قاسمي هيثم', 'Kacemi Haithem', 'm'),
  pupil('بن عيسى نور الهدى', 'Benaissa Nour El Houda', 'f'),
  pupil('حداد رميساء', 'Haddad Roumaissa', 'f'),
  pupil('بوعلام سيف الدين', 'Boualem Seif Eddine', 'm'),
  pupil('لعرابي شيماء', 'Larabi Chaima', 'f'),
  pupil('مسعودي زكرياء', 'Messaoudi Zakaria', 'm'),
  pupil('بن يوسف هبة الرحمن', 'Benyoucef Hibat Errahmane', 'f'),
  pupil('خليفي إلياس', 'Khelifi Ilyes', 'm'),
  pupil('سعيداني ملاك', 'Saidani Malak', 'f'),
  pupil('بوزيد محمد أمين', 'Bouzid Mohamed Amine', 'm'),
  pupil('دحماني سلسبيل', 'Dahmani Salsabil', 'f'),
  pupil('عبد اللاوي رؤوف', 'Abdellaoui Raouf', 'm'),
  pupil('بن علي إيناس', 'Benali Ines', 'f'),
  pupil('رحماني آدم', 'Rahmani Adam', 'm'),
  pupil('طالبي أميرة', 'Talbi Amira', 'f'),
  pupil('بن شيخ عبد الحق', 'Bencheikh Abdelhak', 'm'),
  pupil('مزياني خديجة', 'Meziani Khadidja', 'f'),
  pupil('ولد علي نور الدين', 'Ould Ali Nour Eddine', 'm'),
  pupil('قادري دعاء', 'Kadri Douaa', 'f'),
  pupil('بوشامة أسامة', 'Bouchama Oussama', 'm'),
  pupil('حمادي بشرى', 'Hamadi Bochra', 'f'),
  pupil('بن ناصر يوسف', 'Bennacer Youcef', 'm'),
  pupil('عثماني لينة', 'Otmani Lina', 'f'),
  pupil('فرحات حمزة', 'Ferhat Hamza', 'm'),
  pupil('بلعيد رانيا', 'Belaid Rania', 'f'),
  pupil('صالحي وائل', 'Salhi Wail', 'm'),
  pupil('بن عمر ياسمين', 'Benamar Yasmine', 'f'),
  pupil('مداني مصطفى', 'Medani Mustapha', 'm'),
  pupil('زيتوني فائزة', 'Zitouni Faiza', 'f'),
  pupil('بوقرة رياض', 'Bouguerra Riad', 'm'),
  pupil('شايب هديل', 'Chaib Hadil', 'f'),
  pupil('عبد الرحمن بن عبد الله إسحاق', 'Abderrahmane Benabdellah Ishak', 'm'),
  pupil('بن عيسى نسرين', 'Benaissa Nesrine', 'f'),
  pupil('يحياوي عبد الرحمن', 'Yahiaoui Abderrahmane', 'm'),
  pupil('سليماني سارة', 'Slimani Sara', 'f'),
];

/** The demo pupils in one class, each with a new ID and a registration number no school gives out. */
export function demoPupils(classId: string, newId: () => string): Pupil[] {
  return DEMO_PUPILS.map((demo, index) => ({
    id: newId(),
    classId,
    registration: `99${String(index + 1).padStart(8, '0')}`,
    name: demo.name,
    latinName: demo.latinName,
    sex: demo.sex,
    groups: [],
    movements: [],
  }));
}
