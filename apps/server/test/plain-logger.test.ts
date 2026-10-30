// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Log lines carry a level, a part and a message: never a clock time.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { logLine, PlainLogger } from '../src/plain-logger.js';

describe('the plain logger', () => {
  it('writes the level, the part and the message on one line', () => {
    assert.equal(logLine('log', 'started', 'Server'), 'log [Server] started');
    assert.equal(logLine('warn', 'two\nlines'), 'warn two lines');
    assert.equal(logLine('error', new Error('broken'), 'Worlds'), 'error [Worlds] broken');
  });

  it('drops a part that is not a short name, such as a stack', () => {
    const stack = 'Error: broken\n    at run (/srv/app/dist/src/worlds.js:12:5)';
    assert.equal(logLine('error', 'failed', stack), 'error failed');
    const lines: string[] = [];
    new PlainLogger(undefined, (l) => lines.push(l)).error('failed', stack);
    assert.deepEqual(lines, ['error failed']);
  });

  it('never writes a date or a time', () => {
    const lines: string[] = [];
    const logger = new PlainLogger(
      (l) => lines.push(l),
      (l) => lines.push(l),
    );
    logger.log('a', 'A');
    logger.warn('b', 'B');
    logger.error('c', 'stack', 'C');
    logger.fatal('d');
    logger.debug('e');
    logger.verbose('f');
    assert.deepEqual(lines, ['log [A] a', 'warn [B] b', 'error [C] c', 'fatal d', 'debug e', 'verbose f']);
    for (const line of lines) assert.doesNotMatch(line, /\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}|\d+\/\d+\/\d+/);
  });
});
