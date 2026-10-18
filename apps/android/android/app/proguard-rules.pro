# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# CI checks calls to these methods because their receiver permission is
# deliberately absent. Keep their names and prevent inlining so that the
# DEX guard still recognises a new caller after R8. Unused methods may go.
-keep,allowshrinking class androidx.core.content.ContextCompat {
    public static *** registerReceiver(...);
}

# WebViewPdf makes the print adapter's callbacks, whose constructors only
# code in android.print may call. Keep it and its callbacks where they are,
# so that no optimisation moves them out of the package and breaks PDFs.
-keep class android.print.WebViewPdf { *; }
-keep class android.print.WebViewPdf$* { *; }
