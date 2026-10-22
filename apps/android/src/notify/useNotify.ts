// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The notifications set ahead, from the app (#234, answers 403 and 406):
// once setup is done, the next 14 days are planned again a moment after
// each change and each time the app comes back to the front, with the
// teacher's choices. Android 13 and later ask for the permission once,
// when the digest or the preview is on. A tapped notification opens the
// digest or Today, once the app is unlocked and on its tabs, also when the
// tap reaches the app while it is open.

import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, DeviceEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import type { RootStackParamList } from '../navigation/routes';
import face from '../native/NativeMinhajnaInterface';
import notify from '../native/NativeMinhajnaNotify';
import { useNotifyPrefs } from '../settings/notify-prefs';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { notifyItems, wallNow } from './notify-items';

const ASKED = 'notify-asked';

/** Counts the times the app came back to the front, so effects run again then. */
function useFronts(): number {
  const [fronts, setFronts] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setFronts((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);
  return fronts;
}

/** Whether Android asks the teacher for the notification permission. */
export function asksPermission(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= 33;
}

/** Asks Android for the permission; true when granted. */
export async function askPermission(): Promise<boolean> {
  if (!asksPermission()) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** Plans the notifications again after a change, and asks for the permission once. */
export function useNotifyPlan(): void {
  const t = useText();
  const data = useAppData();
  const prefs = useNotifyPrefs();
  const fronts = useFronts();
  const context = useMemo(() => coreContext(data), [data]);
  const setUp = data.state.setupFinished;
  useEffect(() => {
    if (!setUp) return undefined;
    const timer = setTimeout(() => {
      try {
        const now = { day: data.today(), minutes: wallNow(new Date()).minutes };
        notify.plan(notifyItems(t, context, data, now, prefs));
      } catch (error: unknown) {
        if (__DEV__) console.warn('Notifications not planned', error);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [t, context, data, prefs, setUp, fronts]);
  useEffect(() => {
    if (!setUp || !(prefs.digest || prefs.preview) || !asksPermission() || face.setting(ASKED) === 'true') return;
    face.setSetting(ASKED, 'true');
    askPermission().catch(() => undefined);
  }, [setUp, prefs.digest, prefs.preview]);
}

/** Opens the screen a tapped notification asks for: on the tabs, on return, and on a tap while open. */
export function useNotifyOpen(): void {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const fronts = useFronts();
  const [taps, setTaps] = useState(0);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('minhajnaNotifyOpened', () => setTaps((count) => count + 1));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const open = notify.takeOpened();
    if (open === 'digest') navigation.navigate('Digest');
    if (open === 'today') navigation.navigate('Home', { screen: 'Today' });
  }, [navigation, fronts, taps]);
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const subscription = AppState.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    subscription.remove();
  };
}

/** Reads Android's notification switch again, after the teacher answers or comes back from its settings. */
export function recheckEnabled(): void {
  for (const listener of listeners) listener();
}

/** Whether Android lets the app notify, read again whenever the app comes back to the front. */
export function useNotifyEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => notify.enabled());
}
