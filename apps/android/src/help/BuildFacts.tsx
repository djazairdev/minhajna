// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the installed preview is (#48, choice F9 in #49): a preview, for made-up
// pupils only, or, in the build the Ministry runs, one that takes real names
// once the lock is set, under its declaration (#211); its version; and the
// checksums of its APK and of the certificate that signed it, which anyone can
// compare with those published with the build. Checksums are Latin text, cut
// into groups of four and selectable, so they can be read aloud or copied.

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Notice } from '../components/Notice';
import native, { type BuildFacts } from '../native/NativeMinhajnaBuild';
import { spacing } from '../design/tokens';
import { buildDeclaration, REAL_NAMES, realNamesDeclaration } from '../privacy/real-names';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { helpStyles } from './HelpPage';

type Result = { status: 'loading' | 'refused' } | { status: 'ready'; value: BuildFacts };

/** A checksum in groups of four characters. */
export function grouped(hex: string): string {
  return hex.match(/.{1,4}/g)?.join(' ') ?? '';
}

function useBuildFacts(): Result {
  const [result, setResult] = useState<Result>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    native.describe().then(
      (value) => {
        if (active) setResult({ status: 'ready', value });
      },
      () => {
        if (active) setResult({ status: 'refused' });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return result;
}

/** The preview's notice: one line on the welcome, so its button stays in view, and in full in Help. */
export function PreviewNotice({ short = false, lockSet = true }: { short?: boolean; lockSet?: boolean }) {
  const t = useText();
  const declaration = realNamesDeclaration(REAL_NAMES, lockSet);
  if (buildDeclaration(REAL_NAMES) !== null && (short || declaration === null)) {
    return (
      <Notice
        testID="preview-notice"
        variant="notice"
        badge={t('realNames.badge')}
        message={t(declaration === null ? 'realNames.beforeLock' : 'realNames.setup')}
      />
    );
  }
  if (declaration !== null) {
    return (
      <Notice
        testID="preview-notice"
        variant="notice"
        badge={t('realNames.badge')}
        title={t('realNames.title')}
        message={t('realNames.message', { declaration: isolate(declaration) })}
      />
    );
  }
  return short ? (
    <Notice testID="preview-notice" variant="notice" badge={t('preview.badge')} message={t('preview.short')} />
  ) : (
    <Notice
      testID="preview-notice"
      variant="notice"
      badge={t('preview.badge')}
      title={t('preview.title')}
      message={t('preview.message')}
    />
  );
}

function Checksum({ label, hex }: { label: string; hex: string }) {
  return (
    <View style={{ gap: spacing['space-4'] }}>
      <Text style={helpStyles.body}>{label}</Text>
      <Text selectable style={[helpStyles.notice, { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' }]}>
        {grouped(hex)}
      </Text>
    </View>
  );
}

/** The preview's notice, version and checksums, at the head of Help. */
export function AboutBuild() {
  const t = useText();
  const result = useBuildFacts();
  return (
    <View style={{ gap: spacing['space-12'] }}>
      <PreviewNotice />
      {result.status === 'ready' ? (
        <>
          <Text style={helpStyles.body}>
            {t('preview.version', { version: result.value.version, code: result.value.versionCode })}
          </Text>
          <Checksum label={t('preview.apk')} hex={result.value.apkSha256} />
          {result.value.signerSha256 !== null && (
            <Checksum label={t('preview.signer')} hex={result.value.signerSha256} />
          )}
          <Text style={helpStyles.body}>
            {t(buildDeclaration(REAL_NAMES) === null ? 'preview.compare' : 'realNames.compare')}
          </Text>
        </>
      ) : (
        <Text accessibilityLiveRegion="polite" style={helpStyles.body}>
          {result.status === 'loading' ? t('preview.reading') : t('preview.refused')}
        </Text>
      )}
    </View>
  );
}
