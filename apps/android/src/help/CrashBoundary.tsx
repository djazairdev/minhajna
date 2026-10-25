// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An error in a screen's render stops the app as it always did, but through
// JavaScript's global handler (#249, answer 483), so that while crash reports
// are on, the report names where in the app's code it failed rather than
// React Native's own Java frames. Nothing is shown in place of the screens.

import { Component, type ComponentType, type ReactNode } from 'react';

type State = { readonly failed: boolean };

/** Stops the app on an error in a screen's render, through the handler that keeps crashes. */
export class CrashBoundary extends Component<{ readonly children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    ErrorUtils.getGlobalHandler()(error, true);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** The app inside the boundary, as AppRegistry registers it. */
export function withCrashBoundary<P extends object>(App: ComponentType<P>): ComponentType<P> {
  return function Bounded(props: P) {
    return (
      <CrashBoundary>
        <App {...props} />
      </CrashBoundary>
    );
  };
}
