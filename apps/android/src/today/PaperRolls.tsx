// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إدخال مناداة من الورقة» in Today's backlog (#38, Today-backlog): a roll
// call kept on paper, by a substitute or on a day without the phone, is
// entered later. The sheet lists the earlier sessions of the week shown
// whose roll call is not recorded yet; each opens Roll-past, which records
// it on the session's own date (PRD §3.4).

import type { Context, Day, Session } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { OptionRow } from '../components/OptionRow';
import { colors, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { unitTime } from '../roll/roll-labels';
import { rollsToEnter } from '../roll/roll-rules';
import { dayName } from './DayMark';

export function PaperRolls(props: { context: Context; from: Day; to: Day; onRoll: (session: Session) => void }) {
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, bells, calendar } = useAppData();
  const [open, setOpen] = useState(false);
  const opener = useRef<ViewInstance>(null);
  const units = useMemo(
    () => (open ? rollsToEnter(props.context, props.from, props.to) : []),
    [open, props.context, props.from, props.to],
  );
  const language = currentLanguage();
  const align = { writingDirection: direction, textAlign: 'start' } as const;

  return (
    <>
      <View ref={opener} collapsable={false}>
        <OptionRow
          testID="backlog-paper"
          label={t('roll.paper')}
          sub={t('roll.paperSub')}
          directional
          onPress={() => setOpen(true)}
        />
      </View>
      <BottomSheet
        testID="paper-sheet"
        visible={open}
        title={t('roll.paper')}
        context={t('roll.paperSub')}
        reassurance={t('roll.official')}
        returnFocusRef={opener}
        onClose={() => setOpen(false)}
      >
        {units.length === 0 && (
          <Text style={[typography.body, { color: colors.ink2 }, align]}>{t('roll.paperNone')}</Text>
        )}
        {units.map((unit) => {
          const schoolClass = state.classes.get(unit.classId);
          const time = unitTime({ state, bells, calendar }, unit, direction);
          const first = unit.sessions[0];
          return (
            <OptionRow
              key={unit.key}
              testID={`paper-${unit.key}`}
              label={dayName(t, unit.day, language, profile)}
              sub={[time, schoolClass?.name].filter(Boolean).join(' · ')}
              directional
              onPress={() => {
                setOpen(false);
                if (first !== undefined) props.onRoll(first);
              }}
            />
          );
        })}
      </BottomSheet>
    </>
  );
}
