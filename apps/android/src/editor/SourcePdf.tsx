// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Page images and unverified extracted rows from the browser-only adapter.
// Closing or replacing a source destroys it. A late picker or render result
// cannot leak into another release/world or survive the component leaving.

import { sourceNumber } from '@minhajna/core';
import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import PdfSource from '../native/NativeMinhajnaPdfSource';
import { useDeviceText } from '../text/device-text';
import { editorStyles as s } from './editor-styles';

export interface SourceRow {
  readonly title: string;
  readonly page: number;
  readonly week?: number;
}

export function SourcePdf({
  onRow,
  onPages,
  disabled = false,
  rowDisabled = false,
}: {
  readonly onRow: (row: SourceRow) => void;
  readonly onPages: (pages: number | null) => void;
  readonly disabled?: boolean;
  readonly rowDisabled?: boolean;
}) {
  const t = useDeviceText();
  const [source, setSource] = useState<{ token: string; pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState('1');
  const [width, setWidth] = useState(600);
  const [image, setImage] = useState<{ uri: string; width: number; height: number; rows: readonly string[] } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'pdfError' | 'pdfPageError' | 'pdfEngine' | null>(null);
  const alive = useRef(true);
  const token = useRef<string | null>(null);
  const choosing = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      PdfSource?.cancelPick();
      if (token.current !== null) PdfSource?.drop(token.current);
    };
  }, []);
  useEffect(() => {
    let current = true;
    if (source === null || PdfSource == null) return;
    void PdfSource.page(source.token, page, Number(scale))
      .then((answer) => {
        if (current) setImage(answer);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setImage(null);
        if (cause instanceof Error && cause.message === 'E_PDF_CLOSED') {
          setError('pdfError');
          token.current = null;
          setSource(null);
          onPages(null);
        } else {
          setError('pdfPageError');
        }
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [source, page, scale, onPages]);
  const choose = async () => {
    if (disabled || choosing.current || PdfSource == null) return;
    choosing.current = true;
    setBusy(true);
    setError(null);
    let started = false;
    try {
      const next = await PdfSource.pick();
      if (!alive.current) {
        if (next !== null) PdfSource.drop(next.token);
        return;
      }
      if (next === null) return;
      if (token.current !== null) PdfSource.drop(token.current);
      token.current = next.token;
      started = true;
      setImage(null);
      setPage(1);
      setScale('1');
      setSource(next);
      onPages(next.pages);
    } catch (cause) {
      if (alive.current)
        setError(cause instanceof Error && cause.message === 'E_PDF_ENGINE' ? 'pdfEngine' : 'pdfError');
    } finally {
      choosing.current = false;
      if (alive.current && !started) setBusy(false);
    }
  };
  const close = () => {
    if (token.current !== null) PdfSource?.drop(token.current);
    token.current = null;
    setSource(null);
    setImage(null);
    onPages(null);
    setError(null);
    setBusy(false);
  };
  return (
    <View testID="editor-pdf" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {t('editorItem.pdfTitle')}
      </Text>
      <Text style={s.body}>{t('editorItem.pdfLocal')}</Text>
      <Button
        testID="pdf-pick"
        label={t('editorItem.pdfPick')}
        disabled={busy || disabled || PdfSource == null}
        onPress={() => void choose()}
      />
      {source !== null && (
        <>
          <Text accessibilityLiveRegion="polite" style={s.body}>
            {t('editorItem.pdfPage', { page, count: source.pages })}
          </Text>
          <View style={s.row}>
            <Button
              testID="pdf-previous"
              label={t('editorItem.previous')}
              variant="plain"
              disabled={busy || page === 1}
              onPress={() => {
                setBusy(true);
                setImage(null);
                setError(null);
                setPage((old) => old - 1);
              }}
            />
            <Button
              testID="pdf-next"
              label={t('editorItem.next')}
              variant="plain"
              disabled={busy || page === source.pages}
              onPress={() => {
                setBusy(true);
                setImage(null);
                setError(null);
                setPage((old) => old + 1);
              }}
            />
            <Button testID="pdf-close" label={t('editorItem.pdfClose')} variant="plain" onPress={close} />
          </View>
          <SegmentedControl
            label={t('editorItem.zoom')}
            selected={scale}
            onSelect={(value) => {
              if (!busy && value !== scale) {
                setBusy(true);
                setImage(null);
                setError(null);
                setScale(value);
              }
            }}
            choices={[
              { value: '1', label: '100%' },
              { value: '1.5', label: '150%' },
              { value: '2', label: '200%' },
            ]}
          />
        </>
      )}
      {busy && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {t('editorItem.pdfLoading')}
        </Text>
      )}
      {error !== null && (
        <Text testID="pdf-problem" accessibilityRole="alert" style={s.error}>
          {t(`editorItem.${error}`)}
        </Text>
      )}
      {image !== null && (
        <>
          <View
            onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width - 20))}
            tabIndex={0}
            accessibilityLabel={t('editorItem.pdfPage', { page, count: source?.pages })}
            style={{ maxHeight: 640, overflow: 'scroll', direction: 'ltr' }}
          >
            <Image
              testID="pdf-image"
              accessibilityLabel={t('editorItem.pdfPage', { page, count: source?.pages })}
              source={{ uri: image.uri }}
              style={{ width: width * Number(scale), height: (width * Number(scale) * image.height) / image.width }}
              resizeMode="contain"
            />
          </View>
          <Text style={s.body}>{t('editorItem.pdfDraft')}</Text>
          {image.rows.length === 0 && <Text style={s.body}>{t('editorItem.pdfNoText')}</Text>}
          {image.rows.map((title, at) => (
            <View key={at} style={s.card}>
              <Text selectable style={s.body}>
                {title}
              </Text>
              <Button
                testID={`pdf-row-${at}`}
                label={t('editorItem.useRow')}
                name={t('editorItem.useRowNamed', { title })}
                variant="plain"
                disabled={disabled || rowDisabled}
                onPress={() => {
                  if (disabled || rowDisabled) return;
                  const match = /^([0-9\u0660-\u0669\u06f0-\u06f9]+)[\s|:.-]+(.+)$/u.exec(title);
                  const week = match === null ? null : sourceNumber(match[1] ?? '', true);
                  onRow({ title: match?.[2] ?? title, page, ...(week === null ? {} : { week }) });
                }}
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}
