// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Comments go at the head of a function, never between its steps
// (docs/contributing/engineering.md#comments). Two exceptions: tool
// directives, which a tool reads where they stand, and a comment directly in
// a `describe` block, which heads the test below it.

const DIRECTIVE = /^\s*(eslint-|@ts-|prettier-ignore)/;
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const SUITES = new Set(['describe', 'suite']);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow comments inside function bodies' },
    schema: [],
    messages: {
      inside: "Move this comment to the function's head comment, or name the step as a function of its own.",
    },
  },
  create(context) {
    const { sourceCode } = context;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (DIRECTIVE.test(comment.value)) continue;
          let node = sourceCode.getNodeByRangeIndex(comment.range[0]);
          while (node) {
            if (FUNCTIONS.has(node.type) && node.body.type === 'BlockStatement' && inside(node.body, comment)) {
              if (!isSuite(node)) context.report({ loc: comment.loc, messageId: 'inside' });
              break;
            }
            node = node.parent;
          }
        }
      },
    };
  },
};

/** A test suite's callback, such as `describe('…', () => { … })`. */
function isSuite(fn) {
  const call = fn.parent;
  return call?.type === 'CallExpression' && call.callee.type === 'Identifier' && SUITES.has(call.callee.name);
}

function inside(block, comment) {
  return comment.range[0] > block.range[0] && comment.range[1] < block.range[1];
}
