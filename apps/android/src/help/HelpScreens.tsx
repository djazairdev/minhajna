// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TFunction } from 'i18next';
import { Text } from 'react-native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useText } from '../text/i18n';
import { AboutBuild } from './BuildFacts';
import { HelpPage, HelpRow, helpStyles } from './HelpPage';
import { SourceLink } from './SourceLink';
import { useAppLicences } from './useAppLicences';

/** The preview and its checksums, the privacy notice, connections and licences; reports, settings and privacy controls remain later work. */
export function HelpScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Help'>) {
  const t = useText();
  return (
    <HelpPage>
      <Text accessibilityRole="header" style={helpStyles.heading}>
        {t('help.about')}
      </Text>
      <AboutBuild />
      <HelpRow label={t('privacy.helpTitle')} onPress={() => navigation.navigate('PrivacyNotice')} />
      <HelpRow label={t('connections.title')} onPress={() => navigation.navigate('Connections')} />
      <HelpRow label={t('help.licences')} detail={t('help.offline')} onPress={() => navigation.navigate('Licences')} />
    </HelpPage>
  );
}

/** Every public asset gets an entry, including future filenames unknown to this UI. */
export function LicencesScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Licences'>) {
  const t = useText();
  const { result, retry } = useAppLicences();
  return (
    <HelpPage>
      <Text style={helpStyles.body}>{t('help.appLicence')}</Text>
      <SourceLink />
      {result.status === 'ready' ? (
        <>
          <Text style={helpStyles.body}>{t('help.version', { version: result.value.version })}</Text>
          {result.value.notices.map((notice) => (
            <HelpRow
              key={notice.name}
              label={noticeTitle(notice.name, t)}
              detail={notice.name}
              onPress={() => navigation.navigate('LicenceNotice', { name: notice.name })}
            />
          ))}
        </>
      ) : (
        <LoadState status={result.status} retry={retry} />
      )}
    </HelpPage>
  );
}

/** Contents stay out of route state and remain selectable, verbatim paragraphs. */
export function LicenceNoticeScreen({ route }: NativeStackScreenProps<RootStackParamList, 'LicenceNotice'>) {
  const { result, retry } = useAppLicences();
  const notice =
    result.status === 'ready' ? result.value.notices.find((item) => item.name === route.params.name) : undefined;
  return (
    <HelpPage>
      {notice ? (
        notice.text.split(/\n\s*\n/u).map((paragraph, index) => <NoticeParagraph key={index} paragraph={paragraph} />)
      ) : (
        <LoadState status={result.status === 'ready' ? 'refused' : result.status} retry={retry} />
      )}
    </HelpPage>
  );
}

/** Known titles are translated; future filenames remain visible, never omitted. */
export function noticeTitle(name: string, t: TFunction): string {
  return new Map(Object.entries(t('help.noticeTitles', { returnObjects: true }))).get(name) ?? name;
}

function LoadState({ status, retry }: { status: 'loading' | 'refused'; retry: () => void }) {
  const t = useText();
  return (
    <>
      <Text accessibilityLiveRegion="polite" style={helpStyles.body}>
        {status === 'loading' ? t('help.loading') : t('help.refused')}
      </Text>
      {status === 'refused' && <HelpRow label={t('help.retry')} onPress={retry} />}
    </>
  );
}

/** Android otherwise inherits RTL even for English legal text and its wrapped URLs. */
function NoticeParagraph({ paragraph }: { paragraph: string }) {
  const firstLetter = paragraph.match(/\p{Letter}/u)?.[0] ?? '';
  const rtl = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u.test(firstLetter);
  return (
    <Text
      selectable
      style={[
        helpStyles.notice,
        {
          direction: rtl ? 'rtl' : 'ltr',
          writingDirection: rtl ? 'rtl' : 'ltr',
          textAlign: rtl ? 'right' : 'left',
        },
      ]}
    >
      {paragraph}
    </Text>
  );
}
