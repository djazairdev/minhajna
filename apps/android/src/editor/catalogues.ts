// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pack list's own bundled namespace keeps editor work apart from the
// teacher catalogues and other workspaces being built in parallel.

import ar from './text/ar.json';
import fr from './text/fr.json';
import en from './text/en.json';

export const editorPackCatalogues = { ar, fr, en } as const;
