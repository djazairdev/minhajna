// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's reference page (N-Reference, answers 805 and 809): its
// edit-code gate, then the desk. Locking forgets the code and shows the gate
// again.

import type { CountryProfile } from '@minhajna/core';
import { useState } from 'react';
import { useDeviceText } from '../text/device-text';
import { CodeGate } from './CodeGate';
import { DashboardFrame } from './DashboardFrame';
import { claimReference, referenceClaimed, referenceState, type ReferenceState } from './directory-api';
import { PageTitle } from './page-parts';

/** The Ministry's page, from its gate to its desk. */
export function ReferencePage({ onBack }: { profile: CountryProfile; onBack: () => void }) {
  const t = useDeviceText();
  const [opened, setOpened] = useState<{ code: string; state: ReferenceState } | null>(null);
  return (
    <DashboardFrame
      who={t('dashboard.who.ministry')}
      onLock={opened === null ? undefined : () => setOpened(null)}
      onBack={onBack}
    >
      {opened === null ? (
        <CodeGate
          title={t('dashboard.home.reference')}
          claimed={referenceClaimed}
          claim={claimReference}
          read={referenceState}
          onOpen={(code, state) => setOpened({ code, state })}
        />
      ) : (
        <PageTitle>{t('dashboard.home.reference')}</PageTitle>
      )}
    </DashboardFrame>
  );
}
