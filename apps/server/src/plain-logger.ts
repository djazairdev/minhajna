// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The server's only logger. Each line holds a level, the part of the server
// that wrote it and its message: no clock time, no address and no name, so
// the logs never show when anyone was active (PRD §6.5, §6.7). Requests are
// never logged.

import type { LoggerService } from '@nestjs/common';

export type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

export type LogSink = (line: string) => void;

export function logLine(level: LogLevel, message: unknown, context?: unknown): string {
  const text = message instanceof Error ? message.message : String(message);
  const part = typeof context === 'string' && /^[\w.-]{1,64}$/.test(context) ? ` [${context}]` : '';
  return `${level}${part} ${text.replace(/\s+/g, ' ').trim()}`;
}

export class PlainLogger implements LoggerService {
  private readonly out: LogSink;
  private readonly err: LogSink;

  constructor(out: LogSink = (line) => process.stdout.write(line + '\n'), err?: LogSink) {
    this.out = out;
    this.err = err ?? ((line) => process.stderr.write(line + '\n'));
  }

  log(message: unknown, context?: unknown): void {
    this.out(logLine('log', message, context));
  }

  warn(message: unknown, context?: unknown): void {
    this.err(logLine('warn', message, context));
  }

  error(message: unknown, ...rest: unknown[]): void {
    this.err(logLine('error', message, rest.at(-1)));
  }

  fatal(message: unknown, context?: unknown): void {
    this.err(logLine('fatal', message, context));
  }

  debug(message: unknown, context?: unknown): void {
    this.out(logLine('debug', message, context));
  }

  verbose(message: unknown, context?: unknown): void {
    this.out(logLine('verbose', message, context));
  }
}
