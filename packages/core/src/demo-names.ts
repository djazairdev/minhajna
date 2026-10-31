// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up names for demo worlds (#546, answer 578): twelve wilayas from the
// country's reference data, spread across Algeria, in the official order of
// their codes, and a seeded generator of school and staff names, in Arabic
// and in Latin letters. A school is named for a quality, as many are, with a
// part of the town after it, never for a person, and carries no code, so
// nothing resembles a real school's. Staff names join common given names and
// family names, as the demo class's do. One generator never repeats a name,
// and the same seed always gives the same names in the same order.

import type { Zone } from './reference.ts';

/** The levels a demo school may teach, as Algeria's reference data names them. */
export type DemoLevel = 'primary' | 'cem' | 'lycee';

/** The wilayas a demo world holds, by code, as the reference data's zones name them. */
export const DEMO_WILAYA_CODES = ['05', '06', '09', '13', '15', '16', '19', '25', '30', '31', '39', '47'] as const;

/** A made-up name, in Arabic and in Latin letters. */
export interface DemoName {
  readonly name: string;
  readonly latinName: string;
}

/** A made-up member of staff, with the sex the name carries. */
export interface DemoPerson extends DemoName {
  readonly sex: 'f' | 'm';
}

type Pair = readonly [string, string];

/** Each level's kind of school, in Arabic and in French, whose gender the Latin part of town follows. */
const SCHOOL_KINDS: Readonly<Record<DemoLevel, readonly [string, string, 'f' | 'm']>> = {
  primary: ['مدرسة', 'École', 'f'],
  cem: ['متوسطة', 'CEM', 'm'],
  lycee: ['ثانوية', 'Lycée', 'm'],
};

const QUALITIES: readonly Pair[] = [
  ['النجاح', 'En-Nadjah'],
  ['الأمل', 'El Amel'],
  ['الفتح', 'El Fath'],
  ['النور', 'En-Nour'],
  ['الهدى', 'El Houda'],
  ['الرشاد', 'Er-Rachad'],
  ['الفلاح', 'El Falah'],
  ['الإرشاد', 'El Irchad'],
  ['التقدم', 'Et-Takadoum'],
  ['المستقبل', 'El Moustakbal'],
  ['الوفاء', 'El Wafa'],
  ['السلام', 'Es-Salam'],
  ['الأخوة', 'El Oukhouwa'],
  ['الوحدة', 'El Wahda'],
  ['الاستقلال', 'El Istiklal'],
  ['الحرية', 'El Hourria'],
  ['الياسمين', 'El Yasmine'],
  ['الزيتون', 'Ez-Zitoun'],
  ['النخيل', 'En-Nakhil'],
  ['الربيع', 'Er-Rabie'],
  ['الفجر', 'El Fadjr'],
  ['الإخلاص', 'El Ikhlas'],
  ['المعرفة', 'El Maarifa'],
  ['الحكمة', 'El Hikma'],
  ['العلم', 'El Ilm'],
];

/** A part of the town: in Arabic, then in French after a feminine and a masculine kind of school. */
const QUARTERS: readonly (readonly [string, string, string])[] = [
  ['', '', ''],
  ['الجديدة', 'Nouvelle', 'Nouveau'],
  ['الشرقية', 'Est', 'Est'],
  ['الغربية', 'Ouest', 'Ouest'],
  ['الشمالية', 'Nord', 'Nord'],
  ['الجنوبية', 'Sud', 'Sud'],
  ['المركزية', 'Centrale', 'Central'],
  ['القديمة', 'Ancienne', 'Ancien'],
  ['الحديثة', 'Moderne', 'Moderne'],
];

const FAMILIES: readonly Pair[] = [
  ['بوزيد', 'Bouzid'],
  ['حداد', 'Haddad'],
  ['شريف', 'Cherif'],
  ['زروقي', 'Zerrouki'],
  ['مسعودي', 'Messaoudi'],
  ['بلقاسمي', 'Belkacemi'],
  ['بن علي', 'Benali'],
  ['عمراني', 'Amrani'],
  ['قاسمي', 'Kacemi'],
  ['بن عيسى', 'Benaissa'],
  ['بوعلام', 'Boualem'],
  ['لعرابي', 'Larabi'],
  ['بن يوسف', 'Benyoucef'],
  ['خليفي', 'Khelifi'],
  ['سعيداني', 'Saidani'],
  ['دحماني', 'Dahmani'],
  ['رحماني', 'Rahmani'],
  ['طالبي', 'Talbi'],
  ['مزياني', 'Meziani'],
  ['قادري', 'Kadri'],
  ['حمادي', 'Hamadi'],
  ['عثماني', 'Otmani'],
  ['فرحات', 'Ferhat'],
  ['بلعيد', 'Belaid'],
  ['صالحي', 'Salhi'],
  ['زيتوني', 'Zitouni'],
  ['شايب', 'Chaib'],
  ['يحياوي', 'Yahiaoui'],
  ['سليماني', 'Slimani'],
  ['سوالمي', 'Soualmi'],
];

const GIVEN: Readonly<Record<'f' | 'm', readonly Pair[]>> = {
  f: [
    ['سعاد', 'Souad'],
    ['نوال', 'Nawal'],
    ['فاطمة', 'Fatima'],
    ['أمينة', 'Amina'],
    ['خديجة', 'Khadidja'],
    ['سميرة', 'Samira'],
    ['نادية', 'Nadia'],
    ['حياة', 'Hayat'],
    ['وهيبة', 'Wahiba'],
    ['ليلى', 'Leila'],
    ['كريمة', 'Karima'],
    ['صبرينة', 'Sabrina'],
    ['منيرة', 'Mounira'],
    ['زهية', 'Zahia'],
    ['حنان', 'Hanane'],
  ],
  m: [
    ['محمد', 'Mohamed'],
    ['عبد القادر', 'Abdelkader'],
    ['رشيد', 'Rachid'],
    ['كمال', 'Kamel'],
    ['سليم', 'Salim'],
    ['مراد', 'Mourad'],
    ['نبيل', 'Nabil'],
    ['يوسف', 'Youcef'],
    ['عمر', 'Omar'],
    ['جمال', 'Djamel'],
    ['فريد', 'Farid'],
    ['حسين', 'Hocine'],
    ['مصطفى', 'Mustapha'],
    ['إبراهيم', 'Brahim'],
    ['عز الدين', 'Azzedine'],
  ],
};

/** The demo world's wilayas, from the reference data's zones, in the order of their codes. */
export function demoWilayas(zones: readonly Zone[]): Zone[] {
  return DEMO_WILAYA_CODES.map((code) => {
    const zone = zones.find((one) => one.code === code);
    if (zone === undefined) throw new RangeError(`The reference data has no wilaya ${code}`);
    return zone;
  });
}

/** A 32-bit seed from any text, by FNV-1a over its UTF-16 code units. */
function seedOf(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  return hash >>> 0;
}

/** Mulberry32: a small, fast generator; the same seed gives the same draws, which is all a demo needs. */
function draws(seed: string): (count: number) => number {
  let state = seedOf(seed);
  return (count) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return Math.floor((((value ^ (value >>> 14)) >>> 0) / 2 ** 32) * count);
  };
}

/** Draws, from `count` combinations, one not drawn before; throws once every one is taken. */
function unused(draw: (count: number) => number, taken: Set<number>, count: number): number {
  if (taken.size >= count) throw new RangeError('No made-up name is left');
  let pick = draw(count);
  while (taken.has(pick)) pick = (pick + 1) % count;
  taken.add(pick);
  return pick;
}

/** One world's names: schools and staff, each new to it, drawn in the same order for the same seed. */
export interface DemoNames {
  readonly school: (level: DemoLevel) => DemoName;
  readonly person: (sex: 'f' | 'm') => DemoPerson;
}

/** A generator of made-up school and staff names for one world, from its seed. */
export function demoNames(seed: string): DemoNames {
  const draw = draws(seed);
  const schools = new Map<DemoLevel, Set<number>>();
  const people = { f: new Set<number>(), m: new Set<number>() };
  const join = (...parts: readonly string[]) => parts.filter((part) => part !== '').join(' ');
  return {
    school(level) {
      const kind = SCHOOL_KINDS[level];
      const taken = schools.get(level) ?? new Set<number>();
      schools.set(level, taken);
      const pick = unused(draw, taken, QUALITIES.length * QUARTERS.length);
      const [quality, quarter] = [QUALITIES[pick % QUALITIES.length]!, QUARTERS[Math.floor(pick / QUALITIES.length)]!];
      const latin = quarter[kind[2] === 'f' ? 1 : 2];
      return { name: join(kind[0], quality[0], quarter[0]), latinName: join(kind[1], quality[1], latin) };
    },
    person(sex) {
      const given = GIVEN[sex];
      const pick = unused(draw, people[sex], FAMILIES.length * given.length);
      const [family, first] = [FAMILIES[pick % FAMILIES.length]!, given[Math.floor(pick / FAMILIES.length)]!];
      return { name: join(family[0], first[0]), latinName: join(family[1], first[1]), sex };
    },
  };
}
