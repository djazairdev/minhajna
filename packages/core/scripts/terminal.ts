// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the signing tools share at the terminal: a passphrase typed without
// echo, never passed as an argument where the shell's history would keep
// it, and a failure said in one line, with no stack. What is typed after
// Enter waits for the next question, so a pasted pair of lines answers
// both; arrow and other escape keys are not taken as part of it.

import process from 'node:process';

let waiting = '';

/**
 * Adds `text` to `line` up to Enter: the line and what follows it, or null
 * and the line so far. Ctrl-C or Ctrl-D throws.
 */
function take(text: string, line: string): { line: string | null; rest: string } {
  let read = line;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '\r' || char === '\n') {
      const rest = text.slice(index + (char === '\r' && text[index + 1] === '\n' ? 2 : 1));
      return { line: read, rest };
    }
    if (char === '\u0003' || char === '\u0004') throw new Error('Stopped.');
    if (char === '\u001b') return { line: null, rest: read };
    if (char === '\u007f' || char === '\b') read = [...read].slice(0, -1).join('');
    else if (char >= ' ') read += char;
  }
  return { line: null, rest: read };
}

/** Asks for a line without showing what is typed; only in a terminal. */
export function askHidden(question: string): Promise<string> {
  const { stdin, stderr } = process;
  if (!stdin.isTTY) return Promise.reject(new Error('Run this in a terminal: the passphrase is typed, never piped.'));
  stderr.write(question);
  return new Promise((resolve, reject) => {
    let line = '';
    const finish = (end: () => void) => {
      stdin.off('data', read);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write('\n');
      end();
    };
    const read = (chunk: string) => {
      try {
        const taken = take(chunk, line);
        if (taken.line === null) {
          line = taken.rest;
          return;
        }
        waiting = taken.rest;
        finish(() => resolve(taken.line!));
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.on('data', read);
    stdin.resume();
    const queued = waiting;
    waiting = '';
    if (queued !== '') read(queued);
  });
}

/** Runs a tool, printing its failure as one line and exiting with 1. */
export function run(tool: () => Promise<void>): void {
  tool().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
