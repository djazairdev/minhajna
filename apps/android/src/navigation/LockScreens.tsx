// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock's screens inside the app, as navigation routes (#210):
// «القفل والأمان» from Help, and the PIN pages it opens, which come back to
// it saying what changed. The route forgets what changed once it is said, so
// a lock and unlock on the screen does not say it again.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { LockPin } from '../lock/LockPin';
import { useLockStorage } from '../lock/lock-storage';
import { Security } from '../lock/Security';
import type { RootStackParamList } from './AppNavigator';

/** «القفل والأمان». */
export function SecurityScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Security'>) {
  const at = route.params?.at;
  useEffect(() => {
    if (at !== undefined) navigation.setParams({ done: undefined, at: undefined });
  }, [navigation, at]);
  return (
    <Security
      storage={useLockStorage()}
      done={route.params?.done}
      doneAt={route.params?.at}
      onChangePin={() => navigation.navigate('LockPin', { mode: 'change' })}
      onTurnOnPhone={() => navigation.navigate('LockPin', { mode: 'biometric' })}
    />
  );
}

/** Changing the PIN, or the PIN before turning on the fingerprint or face. */
export function LockPinScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'LockPin'>) {
  const { mode } = route.params;
  return (
    <LockPin
      storage={useLockStorage()}
      mode={mode}
      onDone={() => navigation.popTo('Security', { done: mode === 'change' ? 'pin' : 'biometricOn', at: Date.now() })}
      onCancel={() => navigation.goBack()}
    />
  );
}
