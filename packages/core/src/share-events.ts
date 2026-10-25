// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sharing history's events (#439, answer 486), and reader mode's
// statements received and teachers named (#246, answer 489), in the
// shared-statement layer: they go to the user's own devices and full export,
// never into a statement. Apart from statement-shares.ts and
// statement-received.ts, which read them, so the events module imports no
// module that imports it back.

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
  | { readonly kind: 'statement.sent'; readonly sent: { readonly id: string; readonly to: ShareRole } }
  /** A signed statement opened in reader mode, its signature checked, kept exactly as it came. */
  | { readonly kind: 'statement.received'; readonly received: ReceivedStatement }
  /** The name a reader gives the teacher who signs with a key; a later one replaces it. */
  | { readonly kind: 'teacher.named'; readonly named: TeacherName };

/** How a received statement came: a QR code scanned, a signed file, or a PDF's statement link. */
export const RECEIVED_HOWS = ['qr', 'file', 'pdf'] as const;

export type ReceivedHow = (typeof RECEIVED_HOWS)[number];

export interface ReceivedStatement {
  readonly id: string;
  /** The signed statement's text, exactly as it was checked. */
  readonly text: string;
  readonly how: ReceivedHow;
}

/** A teacher as the reader knows them: the key they sign with (SPKI, base64), a name, and optionally a school. */
export interface TeacherName {
  readonly spki: string;
  readonly name: string;
  readonly school?: string;
}

export const SHARE_KINDS = {
  'statement.shared': true,
  'statement.sent': true,
  'statement.received': true,
  'teacher.named': true,
} as const;

/** Whether an event is in the shared-statement layer. */
export const isShareEvent = (event: { readonly kind: string }): event is ShareEvent =>
  Object.hasOwn(SHARE_KINDS, event.kind);
