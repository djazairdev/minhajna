// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { Text } from 'react-native';
import { Notice } from '../components/Notice';
import { Switch } from '../components/Switch';
import { controlIcon } from '../design/Icon';
import native from '../native/NativeMinhajnaCrash';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PILOT_BUILD } from '../pilot/pilot-build';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { AboutBuild } from './BuildFacts';
import { HelpPage, HelpRow, helpStyles } from './HelpPage';
import { SourceLink } from './SourceLink';
import { useAppLicences } from './useAppLicences';

/**
 * Help as drawn (#249, answer 483): the demo class, which opens «الأقسام والتلاميذ»; «توقيتاتي» in pilot builds;
 * «الإبلاغ عن مشكلة», the plan-error row, which opens the Classes tab (answer 301), and a refused update file, by
 * hand (answer 307); «تقارير الأعطال», off until the teacher turns it on, and turning it off deletes a kept report;
 * the teacher's channels; then the privacy notice, connections and licences, and the build.
 */
export function HelpScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Help'>) {
  const t = useText();
  const { state } = useAppData();
  const demo = [...state.classes.values()].some((schoolClass) => schoolClass.demo === true);
  const [crashes, setCrashes] = useState(() => native.reportsOn());
  const [crashesFailed, setCrashesFailed] = useState(false);
  return (
    <HelpPage>
      <HelpRow
        testID="help-demo"
        label={t('help.demo')}
        detail={t(demo ? 'help.demoThere' : 'help.demoAdd')}
        onPress={() => navigation.navigate('SettingsClasses')}
      />
      {PILOT_BUILD && (
        <HelpRow
          testID="help-timings"
          label={t('pilotTimings.title')}
          detail={t('help.timingsLine')}
          onPress={() => navigation.navigate('PilotTimings')}
        />
      )}
      <Text accessibilityRole="header" style={helpStyles.heading}>
        {t('help.reports')}
      </Text>
      <HelpRow
        testID="help-problem"
        label={t('report.title')}
        detail={t('help.problemLine')}
        onPress={() => navigation.navigate('ProblemReport')}
      />
      <HelpRow
        testID="help-plan-error"
        label={t('help.planError')}
        detail={t('help.planErrorHow')}
        onPress={() => navigation.popTo('Home', { screen: 'Classes' })}
      />
      <Switch
        testID="help-crashes"
        label={t('help.crashes')}
        description={t('help.crashesLine')}
        value={crashes}
        onValueChange={(on) => {
          const saved = native.setReports(on);
          if (saved) setCrashes(on);
          setCrashesFailed(!saved);
        }}
      />
      {crashesFailed && (
        <Notice testID="help-crashes-failed" icon={controlIcon('info')} message={t('settings.failed')} />
      )}
      <Text accessibilityRole="header" style={helpStyles.heading}>
        {t('help.updateRefused')}
      </Text>
      <Text testID="help-update-refused" selectable style={helpStyles.body}>
        {t('help.updateRefusedHow')}
      </Text>
      <Text accessibilityRole="header" style={helpStyles.heading}>
        {t('help.contact')}
      </Text>
      <Text testID="help-contact" selectable style={helpStyles.body}>
        {t('help.contactMail')}
      </Text>
      <Text style={helpStyles.body}>{t('help.contactGroup')}</Text>
      <Text style={helpStyles.body}>{t('help.contactSafe')}</Text>
      <Text accessibilityRole="header" style={helpStyles.heading}>
        {t('help.privacy')}
      </Text>
      <HelpRow label={t('privacy.helpTitle')} onPress={() => navigation.navigate('PrivacyNotice')} />
      <HelpRow label={t('security.title')} onPress={() => navigation.navigate('Security')} />
      <HelpRow label={t('connections.title')} onPress={() => navigation.navigate('Connections')} />
      <HelpRow label={t('help.licences')} detail={t('help.offline')} onPress={() => navigation.navigate('Licences')} />
      <Text accessibilityRole="header" style={helpStyles.heading}>
        {t('help.about')}
      </Text>
      <AboutBuild />
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
