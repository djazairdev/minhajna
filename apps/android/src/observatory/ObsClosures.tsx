// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Obs-Report's card of what closures took (#627, answer 680): for each wilaya
// the server shows, by its code and name, the school days closures took in the
// term and the classes behind its figure, with where the days come from and why
// they are days. No hidden wilaya is listed, or counted; none shown is said so.
// On a PC the table is read cell by cell, and on a phone each row is one
// element, as ChartFigure's.

import { useLocale } from '@react-navigation/native';
import type { CountryProfile } from '@minhajna/core';
import { Text, View } from 'react-native';
import { localized } from '../setup/names';
import { onPc, useDeviceText } from '../text/device-text';
import { formatFigure } from '../text/figures';
import { currentLanguage } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { obsStyles as styles } from './obs-styles';
import type { ClosureRow } from './report-closures';

export type ClosuresCardProps = {
  readonly rows: readonly ClosureRow[];
  readonly profile: CountryProfile;
};

/** The school days closures took, by the wilayas shown. */
export function ClosuresCard({ rows, profile }: ClosuresCardProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const web = onPc();
  const heading = t('demo.obsReport.closures');
  const written = (value: number) => formatFigure(value, currentLanguage());
  const nameOf = ({ code }: ClosureRow) => {
    const zone = profile.zones?.find((one) => one.code === code);
    return isolate(zone === undefined ? code : `${code} ${localized(zone.name)}`);
  };
  const label = (row: ClosureRow) =>
    [
      nameOf(row),
      `${t('demo.obsReport.days')}${t('chart.colon')}${written(row.days)}`,
      `${t('demo.obsReport.classes')}${t('chart.colon')}${written(row.classes)}`,
    ].join(t('chart.separator'));
  return (
    <View testID="obs-closures" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {heading}
      </Text>
      {rows.length === 0 ? (
        <Text style={[styles.small, align]}>{t('demo.obsReport.noWilayas')}</Text>
      ) : (
        <View role="table" focusable={web} accessibilityLabel={web ? heading : undefined}>
          <View
            role="row"
            style={styles.row}
            accessibilityElementsHidden={!web}
            importantForAccessibility={web ? 'auto' : 'no-hide-descendants'}
          >
            <Text role="columnheader" style={[styles.small, styles.wide, align]}>
              {t('demo.obsReport.wilaya')}
            </Text>
            <Text role="columnheader" style={[styles.small, styles.cell, align]}>
              {t('demo.obsReport.days')}
            </Text>
            <Text role="columnheader" style={[styles.small, styles.cell, align]}>
              {t('demo.obsReport.classes')}
            </Text>
          </View>
          {rows.map((row) => (
            <View
              key={row.code}
              testID={`obs-closure-${row.code}`}
              role="row"
              accessible={!web}
              accessibilityLabel={web ? undefined : label(row)}
              style={[styles.row, styles.ruled]}
            >
              <Text role="rowheader" style={[styles.small, styles.wide, align]}>
                {nameOf(row)}
              </Text>
              <Text role="cell" style={[styles.small, styles.cell, align]}>
                {written(row.days)}
              </Text>
              <Text role="cell" style={[styles.small, styles.cell, align]}>
                {written(row.classes)}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text style={[styles.small, align]}>{t('demo.obsReport.closuresFrom')}</Text>
    </View>
  );
}
