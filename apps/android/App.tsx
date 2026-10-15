// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StatusBar } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';

// A navigation preview, not the teacher's feature screens. The interface
// language and its catalogue come with #21; the fonts remain bundled offline.
export default function App() {
  return (
    // The insets known when the app starts, so the first frame is drawn at once.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar barStyle="light-content" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
