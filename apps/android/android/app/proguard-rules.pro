# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# CI checks calls to these methods because their receiver permission is
# deliberately absent. Keep their names and prevent inlining so that the
# DEX guard still recognises a new caller after R8. Unused methods may go.
-keep,allowshrinking class androidx.core.content.ContextCompat {
    public static *** registerReceiver(...);
}
