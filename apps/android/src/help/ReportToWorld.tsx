// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Report screen's part for a demo world the device has open (#619, answer
// 657): under its heading, which of the report's lines go to the world's
// operators and what never does; a button that sends the report as previewed,
// which waits while sending or deleting, saying which, and while the report
// cannot be sent, saying why; then that it was sent, with the start of its ID
// and how long it is kept, and a button that deletes it while the screen stays
// open, since its token is kept in memory only; or the problem as an alert: the
// world holding its 200 reports, the world erased or no longer open, or
// another, in each request's own words; deleting from a world that is gone says
// the report is no longer there. Once deleted, or no longer in the world, it is
// said so, and the report may be sent again. One request at a time, and nothing
// is set once the screen has closed.

import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { Send } from '../demo/world-session';
import { colors, spacing } from '../design/tokens';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { settingsStyles as styles } from '../settings/styles';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { deleteFromWorld, sendToWorld, type SentReport, type WorldReport } from './report-world';

/** Why a report cannot be sent yet, in the catalogue's keys. */
export type WorldWhy = 'report.needsNote' | 'report.world.tooLong' | 'report.world.noVersion';

export type ReportToWorldProps = {
  /** The ID of the demo world the device has open. */
  readonly world: string;
  /** The report as previewed, or null while it cannot be sent. */
  readonly report: WorldReport | null;
  /** Why it cannot be sent, when that is known. */
  readonly why: WorldWhy | null;
  /** The demo server's client, the world's own unless a test gives one. */
  readonly send?: Send;
};

type Said = { readonly key: 'deleted' | 'gone'; readonly id: string };
type Problem =
  | ReturnType<typeof problemOf>
  | 'report.world.full'
  | 'report.world.erased'
  | 'report.world.closed'
  | 'report.world.closedDelete';
type Doing = 'send' | 'delete';

/** The problems each request says in its own words, by error code. */
const OWN_PROBLEMS: Record<Doing, Readonly<Record<string, Problem>>> = {
  send: {
    E_REPORTS_FULL: 'report.world.full',
    E_NO_SUCH_WORLD: 'report.world.erased',
    E_NO_WORLD: 'report.world.closed',
  },
  delete: { E_NO_WORLD: 'report.world.closedDelete' },
};
const problemInk = { color: colors['error-ink'] };

/** Sends the report to the open world's operators, and deletes it while the screen stays open. */
export function ReportToWorld({ world, report, why, send = worldRequest }: ReportToWorldProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [sent, setSent] = useState<SentReport | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [doing, setDoing] = useState<Doing | null>(null);
  const busy = doing !== null;
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = <T,>(what: Doing, step: () => Promise<T>, done: (value: T) => void) => {
    if (pending.current) return;
    pending.current = true;
    setDoing(what);
    setProblem(null);
    step().then(
      (value) => {
        pending.current = false;
        if (!mounted.current) return;
        setDoing(null);
        done(value);
      },
      (error: unknown) => {
        pending.current = false;
        if (!mounted.current) return;
        setDoing(null);
        const code = (error as { code?: unknown } | null)?.code;
        const own = OWN_PROBLEMS[what];
        setProblem(typeof code === 'string' && Object.hasOwn(own, code) ? own[code] : problemOf(error));
      },
    );
  };
  const erase = (one: SentReport) =>
    deleteFromWorld(world, one, send).catch((error: unknown) => {
      if ((error as { code?: unknown } | null)?.code === 'E_NO_SUCH_WORLD') return 'gone' as const;
      throw error;
    });
  const shortId = (id: string) => isolate(id.slice(0, 8));
  const live =
    doing !== null
      ? t(doing === 'send' ? 'report.world.sending' : 'report.world.deleting')
      : sent !== null
        ? t('report.world.sent', { id: shortId(sent.id) })
        : said === null
          ? ''
          : t(`report.world.${said.key}`, { id: shortId(said.id) });
  return (
    <View testID="report-world" style={[styles.card, { gap: spacing['space-8'] }]}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('report.world.title')}
      </Text>
      <Text style={[styles.sub, align]}>{t('report.world.what')}</Text>
      {sent === null ? (
        <>
          {why !== null && (
            <Text testID="report-world-why" style={[styles.sub, align]}>
              {t(why)}
            </Text>
          )}
          <Button
            testID="report-world-send"
            variant="line"
            label={t('report.world.send')}
            disabled={report === null || busy}
            onPress={() => {
              if (report === null) return;
              setSaid(null);
              run('send', () => sendToWorld(world, report, send), setSent);
            }}
          />
        </>
      ) : (
        <>
          <Text style={[styles.sub, align]}>{t('report.world.whileOpen')}</Text>
          <Button
            testID="report-world-delete"
            variant="line"
            label={t('report.world.delete')}
            disabled={busy}
            onPress={() =>
              run(
                'delete',
                () => erase(sent),
                (how) => {
                  setSent(null);
                  setSaid({ key: how, id: sent.id });
                },
              )
            }
          />
        </>
      )}
      <Text testID="report-world-said" accessibilityLiveRegion="polite" style={[styles.sub, align]}>
        {live}
      </Text>
      {problem !== null && (
        <Text
          testID="report-world-problem"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.body, problemInk, align]}
        >
          {t(problem)}
        </Text>
      )}
    </View>
  );
}
