// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ملف مجلس القسم» (#244, Council, Council-t2, answer 470): the hub's row
// with the class average; the screen's figures, a 9.995 shown at 10.00 named
// and left below it, the bands, boys and girls, the ranks and the lists; the
// thresholds changed for every class, refused out of order, put back, and
// recording nothing when unchanged, typed and read on a 10 scale too; a term
// with no average; the comparison with the previous term, its trends and each
// rank's change shown as an arrow and read in words; and every text found in
// each language. Made-up records only.

import { councilPack, eventOf, type CouncilPack } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { context, DAY, hubProps, mount, press, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { CouncilRanks } from '../src/marks/CouncilRanks';
import { Marks } from '../src/marks/Marks';
import { MarksCouncil } from '../src/marks/MarksCouncil';
import { thresholdWords, typedThresholds } from '../src/marks/council-rules';
import { assessmentData } from '../src/marks/marks-rules';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const screen = (term = 1) => <MarksCouncil courseId="c-1" term={term} onTerm={jest.fn()} />;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const label = (testID: string) =>
  (root().findByProps({ testID }).props as { accessibilityLabel: string }).accessibilityLabel;
async function type(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    const [field] = root().findAll(
      (node) =>
        node.props.testID === testID && typeof (node.props as { onChangeText?: unknown }).onChangeText === 'function',
    );
    (field?.props as { onChangeText: (text: string) => void }).onChangeText(value);
    await Promise.resolve();
  });
}
const thresholds = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event = eventOf(entry);
    return event?.kind === 'council-thresholds.set' ? [event.thresholds] : [];
  });

test('the hub’s row gives the class average and opens the pack', async () => {
  const onCouncil = jest.fn();
  await mount(await marked(), <Marks courseId="c-1" {...hubProps()} onComponents={jest.fn()} onCouncil={onCouncil} />);
  expect(texts()).toEqual(expect.arrayContaining(['ملف مجلس القسم', 'معدل القسم 12.55 · 10 فما فوق: 2 من 3']));
  await press('marks-council');
  expect(onCouncil).toHaveBeenCalledWith(1);
});

test('the figures, bands, boys and girls, ranks and lists, over the pupils with an average', async () => {
  await mount(await marked(), screen());
  expect(texts()).toEqual(
    expect.arrayContaining([
      '4م1 · اللغة العربية · الفصل الأول',
      'داخلي · سري',
      'تُقارن العتبات والترتيب بالقيمة الكاملة.',
      'لا مقارنة: هذا الفصل الأول.',
      'لا أحد.',
      'العتبتان باختياري، إذ لا عتبات رسمية.',
    ]),
  );
  expect(label('council-mean')).toBe('12.55 معدل القسم');
  expect(label('council-highest')).toBe('16.00 أعلى معدل');
  expect(label('council-lowest')).toBe('10.00 أدنى معدل');
  expect(label('council-reached')).toBe('66.7% 10 فما فوق: 2 من 3');
  expect(has('council-at-threshold')).toBe(true);
  expect(label('council-rate')).toBe('— الحضور في الفصل');
  expect(texts()).toContain('لا مناداة مسجّلة لهذا القسم في هذا الفصل بعد.');
  expect(label('council-band-8')).toBe('من 8 إلى 10: 1');
  expect(label('council-band-10')).toBe('من 10 إلى 12: 1');
  expect(label('council-band-16')).toBe('16 فأكثر: 1');
  expect(label('council-sex-f')).toBe('الإناث: العدد 3، 10 فما فوق 2، المعدل 12.55');
  expect(label('council-sex-m')).toBe('الذكور: العدد 0، 10 فما فوق 0، المعدل —');
  expect(label('council-rank-p-3')).toBe('1 · \u2068تلميذة ثالثة\u2069، 16.00');
  expect(label('council-rank-p-2')).toBe('3 · \u2068تلميذة ثانية\u2069، 10.00');
  expect(has('council-distinction-p-3')).toBe(true);
  expect(has('council-remedial-p-2')).toBe(false);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('the thresholds change for every class, are refused out of order, and go back to the defaults', async () => {
  const data = await marked();
  await mount(data, screen());
  await press('council-thresholds');
  await type('council-remedial-field', '12');
  await type('council-distinction-field', '10');
  await press('council-thresholds-keep');
  expect(texts()).toContain('اكتب عتبتين أكبر من 0 وحتى 20، برقمين على الأكثر بعد الفاصلة، والأولى أقل من الثانية.');
  expect(thresholds(data)).toEqual([]);
  await type('council-remedial-field', '10');
  await type('council-distinction-field', '12,5');
  await press('council-thresholds-keep');
  expect(thresholds(data)).toEqual([{ remedial: 10, distinction: 12.5 }]);
  expect(has('council-remedial-p-2')).toBe(true);
  expect(has('council-distinction-p-3')).toBe(true);
  expect(texts()).toEqual(expect.arrayContaining(['أقل من 10', '12.5 فأكثر']));
  await press('council-thresholds', 'council-thresholds-default');
  expect(thresholds(data).at(-1)).toEqual({ remedial: 8, distinction: 15 });
  await press('council-thresholds', 'council-thresholds-keep', 'council-thresholds', 'council-thresholds-default');
  expect(thresholds(data)).toHaveLength(2);
});

test('on a 10 scale, thresholds are typed and read halved, and kept on 20', () => {
  expect(typedThresholds('4', '7,5', 10)).toEqual({ thresholds: { remedial: 8, distinction: 15 } });
  expect(typedThresholds('0', '5', 10)).toEqual({ problem: 'range' });
  expect(typedThresholds('4', '11', 10)).toEqual({ problem: 'invalid' });
  expect(thresholdWords({ remedial: 4, distinction: 7.5 })).toEqual({ remedial: '4', distinction: '7.5' });
});

test('a term with no average says so', async () => {
  await mount(await marked(), screen(2));
  expect(has('council-empty')).toBe(true);
  expect(texts()).toContain('لا معدل في القسم لهذا الفصل بعد، فلا أرقام لمجلس القسم.');
});

test('from term 2, the comparison and each rank’s change, shown as an arrow and read in words', async () => {
  const data = await marked();
  const pack = councilPack(context(data), assessmentData(data.profile)!, 'c-1', 1, DAY)!;
  const previous: Record<string, number | null> = { 'p-3': 2, 'p-1': 1, 'p-2': null };
  const later: CouncilPack = {
    ...pack,
    previous: { mean: 11, reached: 1, counted: 3 },
    ranks: pack.ranks.map((row) => ({ ...row, previous: previous[row.pupilId] ?? null })),
  };
  const names: Record<string, string> = { 'p-1': 'تلميذة أولى', 'p-2': 'تلميذة ثانية', 'p-3': 'تلميذة ثالثة' };
  await mount(data, <CouncilRanks pack={later} term={2} nameOf={(id) => names[id] ?? ''} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'المقارنة مع الفصل الأول',
      'معدل القسم: من 11.00 إلى 12.55 ↑',
      '10 فما فوق: من 1 من 3 (33.3%) إلى 2 من 3 (66.7%) ↑',
      'سابقاً 2 · ↑ 1',
      'سابقاً 1 · ↓ 1',
      'سابقاً — · —',
    ]),
  );
  expect(label('council-compare')).toBe(
    'معدل القسم: من 11.00 إلى 12.55 ارتفاع. 10 فما فوق: من 1 من 3 (33.3%) إلى 2 من 3 (66.7%) ارتفاع',
  );
  expect(label('council-rank-p-3')).toBe('1 · \u2068تلميذة ثالثة\u2069، 16.00، سابقاً 2، تقدّم في الترتيب: 1');
  expect(label('council-rank-p-2')).toBe('3 · \u2068تلميذة ثانية\u2069، 10.00، سابقاً —، دون مرتبة سابقة');
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  const data = await marked();
  await mount(data, <Marks courseId="c-1" {...hubProps()} onComponents={jest.fn()} />);
  await unmount();
  await mount(data, screen());
  await press('council-thresholds');
  await unmount();
  await mount(data, screen(2));
  expect(missingKeys).toEqual([]);
});
