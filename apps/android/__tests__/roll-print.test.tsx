// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing the roll-call book (#217, Roll-print, answers 260 and 261): it
// opens on the class and the latest month, and prints the month's two A4
// portrait pages with the paper book's marks, weekends grey, days with no
// session dotted, the absence and lateness dates and the totals so far; a
// morning of two sessions missed counts once; the yearly summary saves on A4
// landscape; the blank spread keeps the names and the shading over 50 rows;
// from the Documents tab it opens on the first class, and another prints
// alone; no signature choice while none is in use; the front pages print the
// cover's counts and legend, the list and the two confidential pages; the
// blank sheet steps through session days (answer 262); and the Roll screen's
// print icon opens it. Each print and saved PDF goes into the activity log
// with its period (#235). 4م1 has 45 made-up pupils and two sessions on
// Thursdays from 11 October 2026; today is Sunday 18 October.

import { eventOf, parseDay, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import pdf from '../src/native/NativeMinhajnaPdf';
import { RollScreen } from '../src/navigation/RecordScreens';
import { RollPrint, type RollPrintProps } from '../src/rollbook/RollPrint';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const savePdf = jest.spyOn(pdf, 'savePdf');
const TODAY = '2026-10-18';
const ROW = 'style="height:3.68mm"';
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(data: TestData, props: RollPrintProps = { courseId: 'c-1' }) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <RollPrint {...props} />, TODAY)}
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID)?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function select(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as { onSelect: (value: string) => void }).onSelect(value);
    await settle();
  });
}

const taken = (slot: number, absent: string[], late: string[]) => ({
  kind: 'roll-call.taken' as const,
  rollCall: {
    unit: unitKey(slot),
    classId: 'k-1',
    groupId: 'k-1-w',
    day: '2026-10-15' as Day,
    half: 'morning' as const,
    absent: absent.map((pupilId) => ({ pupilId, justified: false })),
    late,
  },
});

/** What the activity log holds of the outputs made: the document, the period and how. */
const logged = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event = eventOf(entry);
    return event?.kind === 'output.recorded' ? [[event.output.document, event.output.period, event.output.how]] : [];
  });

async function printed(): Promise<string[]> {
  await press('roll-print-print');
  const [html] = printHtml.mock.calls[0];
  return html.split('<section class="page"').slice(1);
}

test('opens on the class and the latest month, and prints its two portrait pages with the marks and totals', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [taken(1, ['p-3'], ['p-4']), taken(2, [], [])]);
  await mount(data);
  expect(tree!.root.findAllByProps({ testID: 'roll-print-month' })[0]?.props.selected).toBe('2026-10');
  expect(tree!.root.findAllByProps({ testID: 'roll-print-confidential' }).length).toBeGreaterThan(0);
  const pages = await printed();
  const [, title, landscape] = printHtml.mock.calls[0];
  expect([title, landscape]).toEqual(['دفتر المناداة · أكتوبر 2026', false]);
  expect(pages).toHaveLength(2);
  expect(pages.every((page) => page.startsWith(' data-book="k-1">'))).toBe(true);
  expect(pages[0]).toContain('4م1 · اللغة العربية · متوسطة النجاح');
  expect(pages[0]).toContain(`<td ${ROW}>-</td>`);
  expect(pages[0]).toContain('<th class="off"><bdi>16</bdi></th><th class="off"><bdi>17</bdi></th>');
  expect(pages[0]).toContain('<th class="none"><bdi>18</bdi></th>');
  expect(pages[0].match(/<td class="name"[^>]*>[^<]+<\/td>/g)).toHaveLength(45);
  expect(pages[0].match(/<td class="name"[^>]*><\/td>/g)).toHaveLength(5);
  expect(pages[1]).toContain(`<td ${ROW}>1</td><td ${ROW}>0</td><td class="wrap" ${ROW}>15</td>`);
  expect(pages[1]).toContain(`<td class="wrap" ${ROW}></td><td class="wrap" ${ROW}>15</td></tr>`);
  expect(pages[1]).toContain('ح-ك 1 لكل تلميذ');
  expect(pages[1]).toContain('حتى \u206618/10\u2069، وما بعده يُملأ باليد.');
  expect(pages[1]).toContain('<th><bdi>22</bdi></th>');
  expect(pages[1]).toContain(`<td>${text.rollPrint.teacher}</td>`);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('a morning of two sessions missed prints once and counts one half-day', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [taken(1, ['p-3'], []), taken(2, ['p-3'], [])]);
  await mount(data);
  const pages = await printed();
  const row = pages[1].split('<tr>').find((one) => one.startsWith(`<td ${ROW}>3</td>`)) ?? '';
  expect(row).toContain(`<td ${ROW}>1</td><td ${ROW}>0</td><td class="wrap" ${ROW}>15</td>`);
  expect(
    pages[0]
      .split('<tr>')
      .find((one) => one.startsWith(`<td ${ROW}>3</td>`))
      ?.match(/>-</g),
  ).toHaveLength(1);
});

test('the yearly summary saves on A4 landscape, and the month chips go', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [taken(1, ['p-3'], []), taken(2, [], [])]);
  await mount(data);
  expect(texts()).toContain('من سبتمبر إلى جوان · صفحة A4 أفقية');
  await select('roll-print-what', 'year');
  expect(tree!.root.findAllByProps({ testID: 'roll-print-month' })).toHaveLength(0);
  expect(texts()).toContain(text.rollPrint.yearNote);
  await press('roll-print-save');
  const [html, made, landscape] = makePdf.mock.calls[0];
  expect([made, landscape]).toEqual(['roll-year', true]);
  expect(html.match(/<section class="page"/g)).toHaveLength(1);
  expect(html).toContain('<tr class="total">');
  expect(savePdf).toHaveBeenCalledWith('roll-year', `${text.documents.rollBook} 4م1 ${data.year.id}.pdf`);
  expect(logged(data)).toEqual([['roll', data.year.id, 'pdf']]);
});

test('the blank spread keeps the names and the shading over 50 rows, with no marks or figures', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [taken(1, ['p-3'], ['p-4']), taken(2, [], [])]);
  await mount(data);
  await select('roll-print-version', 'blank');
  expect(texts()).toContain(text.documents.output.blankRoll);
  const pages = await printed();
  expect(pages[0].match(/<td class="name"[^>]*>[^<]+<\/td>/g)).toHaveLength(45);
  expect(pages[0]).not.toContain(`<td ${ROW}>-</td>`);
  expect(pages[1]).not.toContain(`<td class="wrap" ${ROW}>15</td>`);
  expect(pages[1]).not.toContain('ح-ك 1 لكل تلميذ');
  expect(pages[0]).toContain('<th class="off"><bdi>16</bdi></th>');
});

test('from the Documents tab it opens on the first class and the latest month, and another class prints alone', async () => {
  await mount(await withPupils(), {});
  const chips = tree!.root.findByProps({ testID: 'roll-print-class' }).props as { selected: string };
  expect(chips.selected).toBe('k-1/k-1-w');
  await select('roll-print-class', 'k-2/k-2-w');
  await select('roll-print-month', '2026-09');
  const pages = await printed();
  expect(pages.every((page) => page.startsWith(' data-book="k-2">'))).toBe(true);
  expect(printHtml.mock.calls[0][1]).toBe('دفتر المناداة · سبتمبر 2026');
  expect(pages[0]).toContain('4م2 · اللغة العربية');
});

test('with no drawn signature in use, nothing is offered and the boxes print blank', async () => {
  await mount(await withPupils());
  const choices = tree!.root.findAll(
    (node) => node.props.testID === 'roll-print-signature' && 'selected' in node.props,
  );
  expect(choices).toHaveLength(0);
  expect(texts()).toContain(text.rollPrint.signatureNote);
});

test('the front pages print the cover with the counts and the legend, the list, then the two confidential pages', async () => {
  await mount(await withPupils());
  await select('roll-print-what', 'front');
  expect(texts()).toContain(text.rollPrint.front.note);
  expect(tree!.root.findAllByProps({ testID: 'roll-print-signature-line' })).toHaveLength(0);
  const pages = await printed();
  expect(printHtml.mock.calls[0][2]).toBe(false);
  expect(pages).toHaveLength(4);
  expect(pages[0]).toContain('الذكور 23 · الإناث 22 · المجموع 45');
  expect(pages[0]).toContain('4م1 · اللغة العربية · متوسطة النجاح');
  expect(pages[0]).toContain(`(-) ${text.rollBook.legend.justified}`);
  expect(pages[1].match(/<tr><td class="n">\d+<\/td><td>[^<]+<\/td>/g)).toHaveLength(45);
  expect(pages[1].match(/<tr><td class="n">\d+<\/td>/g)).toHaveLength(50);
  expect(pages[2]).toContain(text.rollPrint.front.recordOne);
  expect(pages[3]).toContain(`<th>${text.rollPrint.front.address}</th>`);
  expect(pages[3].match(/<tr><td class="n">\d+<\/td>/g)).toHaveLength(50);
  printHtml.mockClear();
  await select('roll-print-version', 'blank');
  const blank = await printed();
  expect(blank[1].match(/<tr><td class="n">\d+<\/td><td>[^<]+<\/td>/g)).toBeNull();
  expect(blank[0]).not.toContain('المجموع 45');
});

test('the blank sheet steps through the class’s session days from the next one, a box per roll call', async () => {
  await mount(await withPupils());
  await select('roll-print-what', 'day');
  expect(tree!.root.findAllByProps({ testID: 'roll-print-version' })).toHaveLength(0);
  expect(texts()).toContain(text.rollPrint.day.confidential);
  expect(texts()).not.toContain(text.documents.output.confidentialLine);
  expect(texts()).toContain('الخميس 22 أكتوبر');
  await press('roll-print-day-before');
  expect(texts()).toContain('الخميس 15 أكتوبر');
  expect(control('roll-print-day-before')?.props.disabled).toBe(true);
  await press('roll-print-save');
  const [html, made, landscape] = makePdf.mock.calls[0];
  expect([made, landscape]).toEqual(['roll-day-2026-10-15', false]);
  expect(html).toContain('ورقة المناداة · الخميس 15 أكتوبر 2026');
  expect(html.match(/<th><bdi>/g)).toHaveLength(2);
  expect(html).toContain('08:00 – 09:00');
  expect(html.match(/<tr><td class="n"/g)).toHaveLength(50);
  expect(html).toContain(text.rollPrint.day.key);
  expect(savePdf).toHaveBeenCalledWith(
    'roll-day-2026-10-15',
    `${text.documents.rollBook} 4م1 ${text.rollPrint.day.name} 2026-10-15.pdf`,
  );
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('the Roll screen’s print icon opens the blank sheet of its class and day', async () => {
  let options: { headerRight: () => React.ReactElement } | undefined;
  const navigation = {
    setOptions: (next: typeof options) => {
      options = next;
    },
    navigate: jest.fn(),
    goBack: jest.fn(),
  };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          await withPupils(),
          <RollScreen
            navigation={navigation as never}
            route={
              {
                key: 'r',
                name: 'Roll',
                params: { key: 'c-1/2026-10-15/m1/k-1-w', day: '2026-10-15', courseId: 'c-1' },
              } as never
            }
          />,
          TODAY,
        )}
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
  const icon = options?.headerRight().props as PressableProps & { accessibilityLabel: string };
  expect(icon.accessibilityLabel).toBe(text.rollPrint.day.open);
  icon.onPress?.({} as never);
  expect(navigation.navigate).toHaveBeenCalledWith('RollPrint', { courseId: 'c-1', choice: 'day', day: '2026-10-15' });
});
