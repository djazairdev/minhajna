// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pupils' names replaced in a problem report (#249, answer 483), from the
// demo class's made-up names and a few more: whole or in part, in either
// order, Arabic or Latin, with vowel marks, another alef, ة typed ه, ى typed
// ي, one or two attached prefixes, and two or three name words typed joined,
// apart or with a hyphen, a prefix on the first; a short given name; a
// registration number, also in groups; numbered in the order pupils first
// appear; particles only beside a name; and «على» never read as «علي».

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEMO_PUPILS, nameKey, replaceNames, type NamedPupil } from '../src/index.ts';

const label = (n: number) => `تلميذ ${n}`;
const pupils: readonly NamedPupil[] = [
  ...DEMO_PUPILS,
  { name: 'علي بلقاسم' },
  { name: 'حداد إسراء', latinName: 'Haddad Isra' },
  { name: 'مي بوعلام', latinName: 'Li Boualem' },
  { name: 'عبدالرحمن سعدي', latinName: 'Abderrahmane Saadi' },
  { name: 'عبد القادر مصطفى', latinName: 'Abdelkader Moustafa', registration: '1600123456789012' },
  { name: 'العربي زروقي' },
];
const replaced = (text: string) => replaceNames(text, pupils, label);

describe('Names in a problem report', () => {
  it('replaces whole names and their parts, in either order, numbered as they first appear', () => {
    assert.equal(
      replaced('بعد مناداة شريف مريم ثم بوزيد ياسين، اختفى غياب ياسين بوزيد ومريم.'),
      'بعد مناداة تلميذ 1 ثم تلميذ 2، اختفى غياب تلميذ 2 وتلميذ 1.',
    );
  });

  it('keeps a compound name in one piece, and a short part only beside a longer one', () => {
    assert.equal(replaced('نقطة بن عبد الرحمن فاطمة الزهراء خاطئة'), 'نقطة تلميذ 1 خاطئة');
    assert.equal(replaced('ذهب بن إلى القسم'), 'ذهب بن إلى القسم');
  });

  it('reads names without vowel marks, with any alef, and after an attached prefix', () => {
    assert.equal(replaced('سألتُ مَرْيَم ثم قلتُ لآية وأنس'), 'سألتُ تلميذ 1 ثم قلتُ لتلميذ 2 وتلميذ 3');
    assert.equal(replaced('غاب اسراء'), 'غاب تلميذ 1');
  });

  it('reads Latin names without case or accents', () => {
    assert.equal(replaced('yacine BOUZID et Mériem'), 'تلميذ 1 et تلميذ 2');
  });

  it('gives a part shared by several pupils to the first, unless the rest names another', () => {
    assert.equal(replaced('حداد'), 'تلميذ 1');
    assert.equal(replaced('حداد إسراء ثم حداد أنس'), 'تلميذ 1 ثم تلميذ 2');
  });

  it('never reads «على» as «علي», and leaves text with no name as it is', () => {
    assert.equal(replaced('على الصفحة 67 علي'), 'على الصفحة 67 تلميذ 1');
    assert.equal(replaced('لا يظهر الواجب في سجل الواجبات ص 67.'), 'لا يظهر الواجب في سجل الواجبات ص 67.');
    assert.equal(nameKey('آيَـة'), 'ايه');
  });

  it('reads ة typed ه and ى typed ي, and one or two attached prefixes', () => {
    assert.equal(replaced('فاطمه ومصطفي'), 'تلميذ 1 وتلميذ 2');
    assert.equal(replaced('ولفاطمة وبمصطفى للعربي وللعربي بالعربي'), 'ولتلميذ 1 وبتلميذ 2 لتلميذ 3 ولتلميذ 3 بتلميذ 3');
  });

  it('reads two name words typed joined or apart as one', () => {
    assert.equal(replaced('عبدالقادر غاب وعبد الرحمن حضر'), 'تلميذ 1 غاب وتلميذ 2 حضر');
    assert.equal(replaced('Abdelkader et Abdel Kader'), 'تلميذ 1 et تلميذ 1');
  });

  it('replaces a short given name alone, and a registration number', () => {
    assert.equal(replaced('مي غائبة، ولمي واجب. Li est là'), 'تلميذ 1 غائبة، ولتلميذ 1 واجب. تلميذ 1 est là');
    assert.equal(replaced('الرقم ١٦٠٠١٢٣٤٥٦٧٨٩٠١٢ ثم 1600123456789012'), 'الرقم تلميذ 1 ثم تلميذ 1');
    assert.equal(
      replaced('رقمه 1600 1234 5678 9012 أو 1600-1234-5678-9012، ص 67 12'),
      'رقمه تلميذ 1 أو تلميذ 1، ص 67 12',
    );
  });

  it('reads a compound held joined but typed apart after a prefix, and three Latin words typed joined', () => {
    const alone: readonly NamedPupil[] = [{ name: 'عبدالقادر بن علي', latinName: 'Abd El Kader Benali' }];
    const only = (text: string) => replaceNames(text, alone, label);
    assert.equal(only('وعبد القادر غاب ولعبد القادر واجب'), 'وتلميذ 1 غاب ولتلميذ 1 واجب');
    assert.equal(only('Abdelkader, Abdel Kader et Abd El Kader'), 'تلميذ 1, تلميذ 1 et تلميذ 1');
    assert.equal(only('عبد-القادر وعبد_القادر'), 'تلميذ 1 وتلميذ 1');
  });
});
