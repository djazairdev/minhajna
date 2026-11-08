// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's privacy notice and the page on what the dashboard connects to
// (answer 857), in the dashboard's own words rather than the PC teacher app's:
// this browser's encrypted statements, reader mode sending nothing, the
// dashboard's address and its host, the directory pages and the demo server,
// no tracking and the crash reports, erasing this PC, the publisher and the
// reader's rights. Demo worlds, updates, an offline install and Help have no
// place here.

import type { IconName } from '../../android/src/design/Icon';
import type { NoticeTexts } from '../../android/src/help/PrivacyNotice';
import { useDashboardText } from './text';

/** Each section of the notice, by its key, and its icon. */
const SECTIONS = [
  ['phone', 'lock'],
  ['reader', 'offline'],
  ['site', 'globe'],
  ['directory', 'school'],
  ['tracking', 'no_tracking'],
  ['erase', 'cross'],
  ['publisher', 'publisher'],
  ['rights', 'rights'],
] as const satisfies readonly (readonly [string, IconName])[];

/** The paragraphs on what the dashboard connects to, in order. */
const CONNECTIONS = ['site', 'directory', 'reader', 'crashReport', 'register'] as const;

/** The notice's words in the dashboard. */
export function useReaderNotice(): NoticeTexts {
  const t = useDashboardText();
  return {
    heading: t('dashboard.reader.privacy.heading'),
    intro: t('dashboard.reader.privacy.intro'),
    sections: SECTIONS.map(([key, icon]) => ({
      key,
      icon,
      title: t(`dashboard.reader.privacy.${key}Title`),
      text: t(`dashboard.reader.privacy.${key}Text`),
    })),
    fileLine: t('dashboard.reader.privacy.fileLine'),
    connectionsTitle: t('dashboard.reader.connections.title'),
  };
}

/** The paragraphs on what the dashboard connects to, by key. */
export function useReaderConnections(): readonly (readonly [string, string])[] {
  const t = useDashboardText();
  return CONNECTIONS.map((key) => [key, t(`dashboard.reader.connections.${key}`)] as const);
}
