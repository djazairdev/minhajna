// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Offering a class's own list as a community pack (#227, Plan-offer,
// R-4.2-21, answer 347): exactly what goes, the level, grade, subject,
// school year, the source «عملي الخاص» and the saved items, then the
// licence CC BY-SA 4.0 and the credit, no name by default or a name the
// teacher types. Nothing from sessions, the class or pupils goes. Sending
// hands the file to Android's share sheet, to send to contact@djazair.dev
// as the error report does; a PC, whose browser may share no JSON file,
// saves it instead, for the teacher to send (answer 509). The app sends
// nothing itself. Once shared or saved, the offer is recorded, and the
// list's history shows it.

import { formatDay, listOffer, listOfferFile, offerFreeList, OFFER_CREDIT_MAX } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { canShareFiles } from '../components/device-abilities';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { spacing } from '../design/tokens';
import NativeInput from '../native/NativeMinhajnaCalendarInput';
import files from '../native/NativeMinhajnaFiles';
import { settingsStyles as styles } from '../settings/styles';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { plain } from './error-report';
import { titleOf } from './free-rules';

export type PlanOfferProps = { readonly courseId: string; readonly onDone?: () => void };

type Credit = 'none' | 'name';

export function PlanOffer({ courseId, onDone }: PlanOfferProps) {
  const t = useDeviceText();
  const data = useAppData();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const [made] = useState(() => data.today());
  const [credit, setCredit] = useState<Credit>('none');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'sent' | 'unrecorded' | 'failed' | null>(null);
  const sharing = useRef(false);
  const named = titleOf(name);
  const built = useMemo(() => {
    const offer = listOffer(coreContext(data), courseId, credit === 'name' && named !== '' ? named : null, made);
    return offer === null ? null : { offer, file: listOfferFile(offer, data.profile) };
  }, [data, courseId, credit, named, made]);
  const { profile } = data;
  const level = profile.levels.find((one) => one.code === built?.offer.level);
  const grade = level?.grades.find((one) => one.code === built?.offer.grade);
  const subject = profile.subjects.find((one) => one.code === built?.offer.subject);
  const share = () => {
    const list = data.state.lists.get(courseId);
    if (built?.file == null || list === undefined || sharing.current) return;
    sharing.current = true;
    setBusy(true);
    setOutcome(null);
    const file = built.file;
    const fileName = `minhajna-list-${made}.json`;
    const handed = canShareFiles()
      ? NativeInput.shareText(fileName, file, t('planOffer.shareTitle')).then(() => true)
      : files.makeText(file, fileName, '').then((token) => files.saveFile(token));
    handed
      .then(
        (done) => {
          if (!done) return;
          try {
            data.record(offerFreeList(data.state.courses, list, made));
            setOutcome('sent');
          } catch {
            setOutcome('unrecorded');
          }
        },
        () => setOutcome('failed'),
      )
      .finally(() => {
        sharing.current = false;
        setBusy(false);
      });
  };
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
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
      {built === null ? (
        <Text testID="offer-none" style={[styles.body, align]}>
          {t('planOffer.none')}
        </Text>
      ) : (
        <>
          <Text style={[styles.body, align]}>{t('planOffer.intro')}</Text>
          <View testID="offer-preview" accessible style={[styles.card, { gap: spacing['space-4'] }]}>
            {[
              t('planOffer.level', { name: isolate(level === undefined ? built.offer.level : localized(level.name)) }),
              t('planOffer.grade', { name: isolate(grade === undefined ? built.offer.grade : localized(grade.name)) }),
              t('planOffer.subject', {
                name: isolate(subject === undefined ? built.offer.subject : localized(subject.name)),
              }),
              t('planOffer.year', { year: isolate(built.offer.year) }),
              t('planOffer.source'),
              t('planOffer.made', { day: formatDay(made) }),
            ].map((line) => (
              <Text key={line} style={[styles.body, align]}>
                {line}
              </Text>
            ))}
            {built.offer.items.map((item, index) => (
              <Text key={item.id} style={[item.kind === 'unit' ? styles.title : styles.body, align]}>
                {[
                  `${index + 1}. ${isolate(item.title)}`,
                  t(`planFree.kinds.${item.kind}`),
                  ...(item.sessions === undefined ? [] : [t('planDetails.sessions', { count: item.sessions })]),
                  ...((item.stages ?? []).length > 0
                    ? [t('planFree.stagesLine', { stages: (item.stages ?? []).map(isolate).join(comma) })]
                    : []),
                ].join(' · ')}
              </Text>
            ))}
            <Text style={[styles.sub, align]}>{t('planOffer.ids')}</Text>
          </View>
          <Text style={[styles.sub, align]}>{t('planOffer.never')}</Text>
          <View style={styles.group}>
            <Text accessibilityRole="header" style={[styles.title, align]}>
              {t('planOffer.licence')}
            </Text>
            <Text style={[styles.body, align]}>{t('planOffer.licenceMeaning')}</Text>
          </View>
          <SegmentedControl<Credit>
            testID="offer-credit"
            label={t('planOffer.credit')}
            choices={[
              { value: 'none', label: t('planOffer.noName') },
              { value: 'name', label: t('planOffer.byName') },
            ]}
            selected={credit}
            onSelect={setCredit}
          />
          {credit === 'name' && (
            <TextField
              testID="offer-name"
              label={t('planOffer.name')}
              placeholder={t('planOffer.namePlaceholder')}
              value={name}
              maxLength={OFFER_CREDIT_MAX}
              onChangeText={(value) => setName(plain(value).replace(/[\r\n\t]+/g, ' '))}
            />
          )}
          <Text testID="offer-credit-line" style={[styles.sub, align]}>
            {credit === 'name' && named !== ''
              ? t('planOffer.creditLine', { name: isolate(named) })
              : t('planOffer.creditNone')}
          </Text>
          <Text selectable style={[styles.body, align]}>
            {t('planOffer.sendTo')}
          </Text>
          {built.file === null && (
            <Text testID="offer-cannot" style={[styles.sub, align]}>
              {t('planOffer.cannot')}
            </Text>
          )}
          {credit === 'name' && named === '' && (
            <Text testID="offer-needs" style={[styles.sub, align]}>
              {t('planOffer.needsName')}
            </Text>
          )}
          <Button
            testID="offer-share"
            label={t('planOffer.share')}
            disabled={built.file === null || busy || (credit === 'name' && named === '')}
            onPress={share}
          />
          {onDone !== undefined && (
            <Button testID="offer-cancel" variant="plain" label={t('planOffer.cancel')} onPress={onDone} />
          )}
          {outcome !== null && (
            <Text testID={`offer-${outcome}`} accessibilityLiveRegion="polite" style={[styles.sub, align]}>
              {t(`planOffer.${outcome}`)}
            </Text>
          )}
          <Text style={[styles.sub, align]}>{t('planOffer.offline')}</Text>
        </>
      )}
    </ScrollView>
  );
}
