// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التوقيع المرسوم» (#236, Signature, answer 411): the pad, where each
// stroke is kept as it ends; «مسح وإعادة الرسم», which also turns the
// signature off, so a new drawing is never used before it is turned on
// again (R-3.8-41); the switch that lets the documents carry it, off by
// default and only once something is drawn; and the notes: it stays on this
// phone, only its shape is kept, where it goes and where never, and that it
// is no legal signature. The screen holds the signature and the switch it
// last kept, so a stroke ending before the one before is saved still builds
// on it.

import { personalWith, signatureOf, type Point, type Signature, type TeacherPersonal } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Switch } from '../components/Switch';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { useText } from '../text/i18n';
import { SignaturePad } from './SignaturePad';
import { strokesOf } from './strokes';

const NOTES = ['phoneOnly', 'shapeOnly', 'where', 'legal'] as const;

/** Whether the signature is drawn, and whether the documents carry it, for the rows that open it. */
export function signatureStatus(t: ReturnType<typeof useText>, personal: TeacherPersonal | null): string {
  if (personal?.signature === undefined) return t('settings.signature.statusNone');
  return t(personal.signatureOn === true ? 'settings.signature.statusOn' : 'settings.signature.statusOff');
}

export function DrawnSignature() {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { state, record, unsaved } = useAppData();
  const [signature, setSignature] = useState<Signature | null>(state.personal?.signature ?? null);
  const [on, setOn] = useState(state.personal?.signatureOn === true);
  const [width, setWidth] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [tooLong, setTooLong] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const strokes = useMemo(
    () => (signature === null || width === 0 ? [] : strokesOf(signature, width)),
    [signature, width],
  );
  const keep = (next: Signature | null, nextOn: boolean) => {
    setSignature(next);
    setOn(nextOn);
    record({
      kind: 'teacher.personal.set',
      personal: personalWith(state.personal, { signature: next, signatureOn: nextOn }),
    });
  };
  const stroke = (points: Point[]) => {
    if (width === 0) return;
    const next = signatureOf([...strokes, points], { width, height: width / 3 });
    setTooLong(next === null);
    if (next !== null) keep(next, on);
  };
  return (
    <ScrollView
      style={styles.screen}
      scrollEnabled={!drawing}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text style={[styles.sub, align]}>{t('settings.signature.intro')}</Text>
      <SignaturePad
        strokes={strokes}
        label={t('settings.signature.pad')}
        status={signature === null ? t('settings.signature.statusNone') : t('settings.signature.drawn')}
        hint={t('settings.signature.padHint')}
        empty={t('settings.signature.empty')}
        onWidth={setWidth}
        onDrawing={setDrawing}
        onStroke={stroke}
      />
      {tooLong && (
        <Notice testID="signature-too-long" icon={controlIcon('info')} message={t('settings.signature.tooLong')} />
      )}
      {unsaved && <Notice testID="signature-not-saved" icon={controlIcon('info')} message={t('settings.failed')} />}
      <Button
        testID="signature-redraw"
        variant="line"
        label={t('settings.signature.redraw')}
        disabled={signature === null}
        onPress={() => {
          setTooLong(false);
          keep(null, false);
        }}
      />
      <View style={styles.group}>
        <Switch
          testID="signature-use"
          label={t('settings.signature.use')}
          description={signature === null ? t('settings.signature.drawFirst') : undefined}
          value={signature !== null && on}
          disabled={signature === null}
          onValueChange={(value) => keep(signature, value)}
        />
      </View>
      <View testID="signature-notes" accessible style={styles.card}>
        {NOTES.map((note) => (
          <Text key={note} style={[styles.body, align]}>
            {t(`settings.signature.${note}`)}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
