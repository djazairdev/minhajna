// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Why a confirmed session was corrected: added after confirming, an entry
// error, or another reason, whose words stay in the private note. The code
// shows with the correction (PRD §5.5).

export const CORRECTION_REASONS = ['added-later', 'entry-error', 'other'] as const;

export type CorrectionReason = (typeof CORRECTION_REASONS)[number];
