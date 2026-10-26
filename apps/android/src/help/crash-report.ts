// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A crash report as it leaves the phone (#249, Crash-preview, R-1.5-07,
// answer 483): the error's type, where it happened in the code, the last
// screens opened by name, the version and Android's version. The error's
// message is never read: a stack's frames are taken only once its first
// line, which holds the message, is known and set aside, and each frame
// keeps a function's name and its line and column in the bundle, no path;
// a frame in Hermes's own code keeps its name only, as no map reads it.
// Only a JavaScript crash that stops the app is kept, by native code, and
// only while the switch in Help is on.

import native from '../native/NativeMinhajnaCrash';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;

/** How many places in the code a report names, innermost first. */
export const FRAMES_KEPT = 10;

export type CrashReport = {
  readonly type: string;
  readonly frames: readonly string[];
  readonly steps: readonly string[];
  readonly version: string;
  readonly android: string;
};

const TYPE = /^[A-Za-z_$][\w$.]{0,79}$/u;
const FRAME = /^\s*at ([\w$.<>?[\]-]{1,60}) \((?:address at )?([^()]*?):(\d{1,9}):(\d{1,9})\)$/u;
const BARE = /^\s*at ([\w$.<>?[\]-]{1,60}) \((?:native|unknown)\)$/u;

/** The error's type as its code names it, such as TypeError; never its message. */
export function crashType(error: unknown): string {
  const name: unknown = error instanceof Error ? error.name : undefined;
  return typeof name === 'string' && TYPE.test(name) ? name : 'Error';
}

/** The places in the code a stack names, without the message, or none when the message cannot be set aside. */
export function crashFrames(error: unknown): string[] {
  if (!(error instanceof Error) || typeof error.stack !== 'string') return [];
  const head = error.message === '' ? error.name : `${error.name}: ${error.message}`;
  if (!error.stack.startsWith(`${head}\n`)) return [];
  return error.stack
    .slice(head.length + 1)
    .split('\n')
    .flatMap((line) => {
      const at = FRAME.exec(line);
      if (at !== null) return [at[2].endsWith('InternalBytecode.js') ? at[1] : `${at[1]} ${at[3]}:${at[4]}`];
      const bare = BARE.exec(line);
      return bare === null ? [] : [bare[1]];
    })
    .slice(0, FRAMES_KEPT);
}

/** Keeps one crash, if the switch is on; false when nothing was kept. */
function keep(error: unknown): boolean {
  try {
    return native.keep(crashType(error), crashFrames(error));
  } catch {
    return false;
  }
}

/** Keeps a JavaScript crash that stops the app, if the switch is on, then lets it go on as it would. */
export function keepCrashes(): void {
  const before = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    if (isFatal === true) keep(error);
    before(error, isFatal);
  });
}

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((one) => typeof one === 'string');

/** A kept report's JSON as a report, or null when it does not read as one. */
function readCrash(json: string): CrashReport | null {
  try {
    const value: unknown = JSON.parse(json);
    if (typeof value !== 'object' || value === null) return null;
    const { type, frames, steps, version, android } = value as Record<string, unknown>;
    if (typeof type !== 'string' || !TYPE.test(type) || !strings(frames) || !strings(steps)) return null;
    if (typeof version !== 'string' || typeof android !== 'string') return null;
    return { type, frames: frames.slice(0, FRAMES_KEPT), steps, version, android };
  } catch {
    return null;
  }
}

let offered = false;

/**
 * The report kept by the last crash, once since the app started; null after that, when there is none, or when it
 * does not read as one, which is then deleted.
 */
export function offeredCrash(): CrashReport | null {
  if (offered) return null;
  offered = true;
  const json = native.kept();
  const report = json === null ? null : readCrash(json);
  if (json !== null && report === null) native.drop();
  return report;
}

/** Offers a kept report again, as a new start of the app does. */
export function clearOffer(): void {
  offered = false;
}

/** The report's lines, in the teacher's language, exactly as they are shared. */
export function crashLines(t: Translate, report: CrashReport): string[] {
  return [
    t('crash.heading'),
    t('crash.lineType', { type: isolate(report.type) }),
    t('crash.lineFrames', {
      frames: report.frames.length === 0 ? t('report.noSteps') : isolate(report.frames.join(', ')),
    }),
    t('report.lineVersion', { version: isolate(report.version), android: isolate(report.android) }),
    t('report.lineSteps', {
      steps: report.steps.length === 0 ? t('report.noSteps') : isolate(report.steps.join(' › ')),
    }),
  ];
}
