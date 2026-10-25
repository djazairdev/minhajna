// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sharing history's events (#439, answer 486), in the shared-statement
// layer: they go to the teacher's own devices and full export, never into a
// statement. Apart from statement-shares.ts, which reads them, so the events
// module imports no module that imports it back.

/** How a statement left: printed, saved as a PDF, shown as a QR code, or sent as a signed file. */
export const SHARE_HOWS = ['print', 'pdf', 'qr', 'file'] as const;

export type ShareHow = (typeof SHARE_HOWS)[number];

/** Who received it, by role only: never a person's name (PRD §3.10). */
export const SHARE_ROLES = ['director', 'inspector', 'coordinator', 'teacher', 'other'] as const;

export type ShareRole = (typeof SHARE_ROLES)[number];

/** One statement that left, on its entry's day. */
export interface StatementShare {
  readonly id: string;
  readonly courseId: string;
  readonly how: ShareHow;
}

export type ShareEvent =
  /** A statement printed, saved, shown or sent, when it left. */
  | { readonly kind: 'statement.shared'; readonly share: StatementShare }
  /** The role a share went to, said then or later; the latest one counts. */
  | { readonly kind: 'statement.sent'; readonly sent: { readonly id: string; readonly to: ShareRole } };

export const SHARE_KINDS = { 'statement.shared': true, 'statement.sent': true } as const;
