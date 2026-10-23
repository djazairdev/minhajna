// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصحيح بعد الفصل» (#243, Export-fix, answer 468): the hub of an ended term,
// with no row that enters marks and the row to corrections; the screen's
// pupils in list order, the term's marks with their days and what each
// records, the new value, in either digits, and the reason required, the
// effect on the averages before saving and the band's notice, or that a pupil
// has none; a component corrected to «غائب»; a correction recorded with the
// value before, listed, printed and saved as «تقرير تصحيح نقطة» and logged with
// the term, never a name; a mark the term no longer has named by its part; and
// every text found in each language. Made-up records only.

import { correctMark, eventOf, type RecordEvent } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { pupil } from '../jest/marks-class';
import { Marks } from '../src/marks/Marks';
import { MarksFix } from '../src/marks/MarksFix';
import pdf from '../src/native/NativeMinhajnaPdf';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const printHtml = jest.spyOn(pdf, 'printHtml');
const savePdf = jest.spyOn(pdf, 'savePdf');

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

/** A day after the first term's last, 17 December. */
const AFTER = '2026-12-20';
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
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
const events = (data: TestData, kind: RecordEvent['kind']) =>
  data.book.entries.flatMap((entry) => {
    const event = eventOf(entry);
    return event?.kind === kind ? [event] : [];
  });
const hub = (onFix = jest.fn()) => (
  <Marks
    courseId="c-1"
    term={1}
    onTerm={jest.fn()}
    onSetup={jest.fn()}
    onTests={jest.fn()}
    onCapture={jest.fn()}
    onComponents={jest.fn()}
    onBook={jest.fn()}
    onEntry={jest.fn()}
    onPart={jest.fn()}
    onObservations={jest.fn()}
    onAppreciations={jest.fn()}
    onExport={jest.fn()}
    onFix={onFix}
    onCouncil={jest.fn()}
  />
);
const screen = (onAppreciations = jest.fn()) => (
  <MarksFix courseId="c-1" term={1} onAppreciations={onAppreciations} onFile={jest.fn()} onSignature={jest.fn()} />
);

test('an ended term’s hub enters no marks and opens the corrections', async () => {
  const data = await marked();
  await mount(data, hub());
  expect(has('marks-fix')).toBe(false);
  expect(has('marks-components')).toBe(true);
  await unmount();
  const onFix = jest.fn();
  await mount(data, hub(onFix), AFTER);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'انتهى الفصل الأول: لا تتغيّر نقاطه إلا بتصحيح بعد الفصل، مع تقرير الأستاذ.',
      'تصحيح بعد الفصل',
      'لا تصحيح بعد',
    ]),
  );
  expect(has('marks-components')).toBe(false);
  expect(has('marks-book')).toBe(true);
  await press('marks-fix');
  expect(onFix).toHaveBeenCalledWith(1);
});

test('before the term ends, the screen says its marks change from the hub', async () => {
  await mount(await marked(), screen());
  expect(has('fix-open')).toBe(true);
  expect(has('fix-pupils')).toBe(false);
});

test('a correction asks for a value and a reason, and shows its effect first', async () => {
  const onAppreciations = jest.fn();
  const data = await marked();
  await mount(data, screen(onAppreciations), AFTER);
  expect(texts()).toEqual(
    expect.arrayContaining([
      '4م1 · اللغة العربية · الفصل الأول',
      'تُعلن الإدارة مدة فتح التصحيحات بعد الفصل؛ لا يحفظها «منهاجنا» ولا يفرضها.',
      '1 · \u2068تلميذة أولى\u2069',
      '3 · \u2068تلميذة ثالثة\u2069',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  await press('fix-pupil-p-1', 'fix-target-test:t-1');
  expect(texts()).toEqual(
    expect.arrayContaining(['1 · \u2068تلميذة أولى\u2069', 'الفرض الأول', 'الأحد 8 نوفمبر · المسجَّلة: 12.00']),
  );
  await press('fix-keep');
  expect(texts()).toEqual(expect.arrayContaining(['اختر سبب التصحيح.']));
  await type('fix-value', '12');
  expect(texts()).toContain('هذه هي القيمة المسجَّلة نفسها، فلا تصحيح.');
  expect(has('fix-effect')).toBe(false);
  await type('fix-value', '\u0661\u0666\u066b\u0665');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'معدل التلميذ في الفصل: من 11.67 إلى 12.42',
      'معدل القسم: من 12.55 إلى 12.80 · 10 فأكثر: من 2 إلى 2 من 3',
      'تغيّرت فئة المعدل: مراجعة التقدير',
    ]),
  );
  await press('fix-appreciations');
  expect(onAppreciations).toHaveBeenCalled();
  expect(accessibilityProblems(root())).toEqual([]);
  expect(events(data, 'mark.corrected')).toEqual([]);
});

test('a kept correction records the value before, is listed, printed, saved and logged', async () => {
  const data = await marked();
  await mount(data, screen(), AFTER);
  await press('fix-pupil-p-2', 'fix-target-exam', 'fix-how-absent', 'fix-reason-transcription-error');
  await type('fix-note', 'غابت يوم الاختبار');
  await press('fix-keep');
  const [event] = events(data, 'mark.corrected');
  expect(event).toEqual({
    kind: 'mark.corrected',
    fix: {
      mark: { courseId: 'c-1', term: 1, target: { kind: 'exam' }, pupilId: 'p-2', value: 'absent' },
      before: 9.25,
      reason: 'transcription-error',
      note: 'غابت يوم الاختبار',
    },
  });
  expect(has('fix-saved')).toBe(true);
  expect(has('fix-pupils')).toBe(false);
  const [entry] = data.book.state.markFixes;
  expect(entry).toBeDefined();
  expect(texts()).toEqual(
    expect.arrayContaining([
      'تصحيحات الفصل الأول',
      '\u2068الاختبار\u2069: من 9.25 إلى غائب',
      'خطأ في النقل · 20/12/2026',
    ]),
  );
  await press(`fix-print-${entry.entry}`);
  const [html] = printHtml.mock.calls[0];
  expect(html).toContain('تقرير تصحيح نقطة');
  expect(html).toContain('تلميذة ثانية');
  expect(html).toContain('خطأ في النقل: غابت يوم الاختبار');
  expect(html.match(/داخلي · سري/g)).toHaveLength(2);
  await press(`fix-save-${entry.entry}`);
  expect(savePdf).toHaveBeenLastCalledWith(
    expect.any(String),
    'تقرير تصحيح نقطة 4م1 · اللغة العربية الفصل الأول التلميذ 2 2026-12-20.pdf',
  );
  const outputs = events(data, 'output.recorded').map((one) =>
    one.kind === 'output.recorded' ? [one.output.document, one.output.period, one.output.how] : [],
  );
  expect(outputs).toEqual([
    ['mark-fix', 'term-1', 'print'],
    ['mark-fix', 'term-1', 'pdf'],
  ]);
});

test('a pupil with no average says so, and a component can become «غائب»', async () => {
  const data = await marked();
  await data.book.record(DAY, pupil('p-4', 'تلميذة رابعة'));
  await mount(data, screen(), AFTER);
  await press('fix-pupil-p-4', 'fix-target-exam');
  await type('fix-value', '11');
  expect(texts()).toContain('لا معدل لهذا التلميذ في الفصل قبل التصحيح ولا بعده: نقاطه ناقصة.');
  await press('fix-target-component:homework', 'fix-how-absent', 'fix-reason-other', 'fix-keep');
  expect(events(data, 'mark.corrected').map((one) => one.kind === 'mark.corrected' && one.fix.mark.value)).toEqual([
    'absent',
  ]);
});

test('a correction of a mark the term no longer weighs is named by its part', async () => {
  const data = await marked();
  const oral = { courseId: 'c-1', term: 1, target: { kind: 'oral' as const }, pupilId: 'p-1' };
  await data.book.record(DAY, correctMark(oral, null, 14, 20, 'appeal'));
  await mount(data, screen(), AFTER);
  expect(texts()).toContain('\u2068الشفهي\u2069: من — إلى 14.00');
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  const data = await marked();
  await mount(data, hub(), AFTER);
  await unmount();
  await mount(data, screen());
  await unmount();
  await mount(data, screen(), AFTER);
  await press('fix-pupil-p-1', 'fix-target-test:t-1', 'fix-keep');
  await type('fix-value', '16');
  await press('fix-reason-appeal', 'fix-keep');
  const [entry] = data.book.state.markFixes;
  await press(`fix-print-${entry.entry}`);
  expect(missingKeys).toEqual([]);
});
