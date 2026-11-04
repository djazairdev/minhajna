// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Only made-up pages. The bridge is replaced, not the source-image UI.

import { act } from 'react-test-renderer';
import { field, press, rendered, show, shown, source, type, unmount } from '../jest/editor-form';
import { SourcePdf } from '../src/editor/SourcePdf';
import { PackDraft } from '../src/editor/PackDraft';
import { ItemForm } from '../src/editor/ItemForm';
import en from '../src/editor/item-text/en.json';

import PdfSource from '../src/native/NativeMinhajnaPdfSource';
jest.mock('../src/native/NativeMinhajnaPdfSource', () => ({
  __esModule: true,
  default: { pick: jest.fn(), page: jest.fn(), drop: jest.fn(), cancelPick: jest.fn() },
}));
const mockPdf = jest.mocked(PdfSource!);
afterEach(async () => {
  await unmount();
  jest.clearAllMocks();
});

test('local page navigation, unchecked row suggestions and cleanup', async () => {
  mockPdf.pick.mockResolvedValue({ token: 'made-up', pages: 2 });
  mockPdf.page.mockResolvedValue({ uri: 'blob:made-up', width: 600, height: 800, rows: ['٢ عنوان مختلق'] });
  const row = jest.fn(),
    pages = jest.fn();
  await show(<SourcePdf onRow={row} onPages={pages} />);
  await press('pdf-pick');
  expect(pages).toHaveBeenCalledWith(2);
  expect(mockPdf.page.mock.calls).toContainEqual(['made-up', 1, 1]);
  await press('pdf-row-0');
  expect(row).toHaveBeenCalledWith({ title: 'عنوان مختلق', page: 1, week: 2 });
  await press('pdf-next');
  expect(mockPdf.page.mock.calls.at(-1)).toEqual(['made-up', 2, 1]);
  await press('pdf-close');
  expect(mockPdf.drop.mock.calls).toContainEqual(['made-up']);
  expect(pages).toHaveBeenLastCalledWith(null);
  expect(shown('pdf-image')).toBe(false);
});

test('an engine that will not load has its own message, apart from a bad PDF', async () => {
  mockPdf.pick.mockRejectedValueOnce(new Error('E_PDF_ENGINE'));
  await show(<SourcePdf onRow={() => undefined} onPages={() => undefined} />, 'en');
  await press('pdf-pick');
  expect(JSON.stringify(rendered().toJSON())).toContain(en.pdfEngine);
  mockPdf.pick.mockRejectedValueOnce(new Error('E_PDF_OPEN'));
  await press('pdf-pick');
  const said = JSON.stringify(rendered().toJSON());
  expect(said).toContain(en.pdfError);
  expect(said).not.toContain(en.pdfEngine);
});

test('a picker that finishes after leaving destroys its token', async () => {
  let resolve!: (source: { token: string; pages: number }) => void;
  mockPdf.pick.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await show(<SourcePdf onRow={() => undefined} onPages={() => undefined} />);
  await press('pdf-pick');
  await unmount();
  await act(() => resolve({ token: 'late', pages: 1 }));
  expect(mockPdf.drop.mock.calls).toContainEqual(['late']);
});

test('a failed page keeps the document open until the worker closes', async () => {
  mockPdf.pick.mockResolvedValue({ token: 'four-pages', pages: 4 });
  const image = { uri: 'blob:made-up', width: 600, height: 800, rows: ['Made-up title'] };
  mockPdf.page
    .mockResolvedValueOnce(image)
    .mockRejectedValueOnce(new Error('E_PDF_PAGE'))
    .mockResolvedValueOnce(image)
    .mockRejectedValueOnce(new Error('E_PDF_CLOSED'));
  const pages = jest.fn();
  await show(<SourcePdf onRow={jest.fn()} onPages={pages} />);
  await press('pdf-pick');
  await press('pdf-next');
  expect(shown('pdf-problem')).toBe(true);
  expect(shown('pdf-image')).toBe(false);
  expect(pages.mock.calls).toEqual([[4]]);
  expect(mockPdf.drop.mock.calls).toEqual([]);
  await press('pdf-next');
  expect(mockPdf.page.mock.calls.at(-1)).toEqual(['four-pages', 3, 1]);
  expect(shown('pdf-image')).toBe(true);
  expect(shown('pdf-problem')).toBe(false);
  await press('pdf-next');
  expect(pages.mock.calls).toEqual([[4], [null]]);
  expect(shown('pdf-next')).toBe(false);
  expect(shown('pdf-problem')).toBe(true);
});

test('an extracted title and every number need independent re-entry against the page', async () => {
  const save = jest.fn();
  await show(
    <ItemForm
      pack={source}
      item={null}
      suggestion={{ title: 'عنوان مستخرج مختلق', page: 1 }}
      sourcePages={2}
      onSave={save}
      onCancel={() => undefined}
    />,
  );
  expect(field('item-title').props.value).toBe('عنوان مستخرج مختلق');
  expect(field('item-title-check').props.value).toBe('');
  await type('item-id', 'extracted');
  await type('item-budget', '1');
  await type('item-retyped-budget', '1');
  await type('item-retyped-sourcePage', '1');
  await press('item-save');
  expect(save).not.toHaveBeenCalled();
  await type('item-title-check', 'عنوان مستخرج مختلق');
  await press('item-save');
  expect(save).toHaveBeenCalledTimes(1);
  await type('item-sourcePage', '3');
  await type('item-retyped-sourcePage', '3');
  await press('item-save');
  expect(save).toHaveBeenCalledTimes(1);
  await type('item-title', 'عنوان مصحح مختلق');
  expect(field('item-title-check').props.value).toBe('');
  expect(rendered().root.findAllByProps({ testID: 'item-problems' }).length).toBeGreaterThan(0);
});

test('the source can be opened while an item is being edited without replacing typed fields', async () => {
  mockPdf.pick.mockResolvedValue({ token: 'editing-source', pages: 5 });
  mockPdf.page.mockResolvedValue({
    uri: 'blob:editing',
    width: 600,
    height: 800,
    rows: ['2 Another synthetic lesson'],
  });
  await show(
    <PackDraft
      initial={source}
      revision={1}
      country="dz"
      busy={false}
      onSave={() => Promise.resolve(null)}
      onClose={() => undefined}
    />,
  );
  await press('draft-edit-lesson');
  await type('item-title', 'عنوان مختلق قيد التحرير');
  await press('pdf-pick');
  expect(shown('pdf-image')).toBe(true);
  expect(field('item-title').props.value).toBe('عنوان مختلق قيد التحرير');
  await press('pdf-row-0');
  expect(field('item-id').props.value).toBe('lesson');
  expect(field('item-title').props.value).toBe('عنوان مختلق قيد التحرير');
});
