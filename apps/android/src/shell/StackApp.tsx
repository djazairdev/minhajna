// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The navigator an app builds from its routes (answer 856): one native stack
// in a container, in the interface's direction and the design's colours, under
// the bar the app gives, with light status bar icons unless a screen asks for
// dark ones. Each screen shown is noted by name for a problem report (#249).
// Each navigation action is told to the app as it is sent, before any screen
// it brings is drawn, and each new state after it. On the web, the container
// names the browser's tab after the screen unless the app says otherwise.
// Persistence, URL linking and tracking stay unconfigured.

import {
  NavigationContainer,
  type DocumentTitleOptions,
  type InitialState,
  type NavigationContainerRefWithCurrent,
  type NavigationState,
} from '@react-navigation/native';
import type { createNativeStackNavigator, NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { recordStep } from '../help/steps';
import { theme } from '../navigation/StackBar';
import type { RootStackParamList } from '../navigation/routes';

/** A stack of the app's routes. */
export type AppStack = ReturnType<typeof createNativeStackNavigator<RootStackParamList>>;

export type StackAppProps = {
  readonly Stack: AppStack;
  /** The container's reference, which the app keeps to navigate from outside a screen. */
  readonly navigation: NavigationContainerRefWithCurrent<RootStackParamList>;
  readonly bar: ComponentType<NativeStackHeaderProps>;
  readonly direction: 'rtl' | 'ltr';
  readonly initialRouteName: keyof RootStackParamList;
  readonly initialState?: InitialState;
  readonly onStateChange?: (state: NavigationState | undefined) => void;
  /** Called as each navigation action is sent, before any screen it brings is drawn. */
  readonly onAction?: () => void;
  /** The routes, as `Stack.Screen` entries. */
  readonly children: ReactNode;
  /** Drawn over the stack, inside the container. */
  readonly after?: ReactNode;
  /** How the container names the browser's tab; by the screen when not given. */
  readonly documentTitle?: DocumentTitleOptions;
};

/** The container, the stack and its bar. */
export function StackApp({
  Stack,
  navigation,
  bar: Bar,
  direction,
  initialRouteName,
  initialState,
  onStateChange,
  onAction,
  children,
  after,
  documentTitle,
}: StackAppProps) {
  useEffect(
    () => (onAction === undefined ? undefined : navigation.addListener('__unsafe_action__', onAction)),
    [navigation, onAction],
  );
  return (
    <NavigationContainer
      ref={navigation}
      direction={direction}
      theme={theme}
      documentTitle={documentTitle}
      initialState={initialState}
      onReady={() => recordStep(navigation.getCurrentRoute()?.name)}
      onStateChange={(state) => {
        recordStep(navigation.getCurrentRoute()?.name);
        onStateChange?.(state);
      }}
    >
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ statusBarStyle: 'light', header: (props) => <Bar {...props} /> }}
      >
        {children}
      </Stack.Navigator>
      {after}
    </NavigationContainer>
  );
}
