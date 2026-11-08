// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Join } from '../join/Join';
import type { RootStackParamList } from './routes';

/** Joining the school from Today, or from Settings into `schoolId` or its update; leaving goes back. */
export function JoinScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Join'>) {
  return <Join named={route.params?.schoolId} onDone={() => navigation.goBack()} />;
}
