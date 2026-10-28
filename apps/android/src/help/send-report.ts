// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sending a report's text (#249, #451): on the phone through Android's share
// menu, which never says where it went. On a PC through the browser's share
// menu where it has one, else copied to the clipboard, so the screen can say it
// was copied, or that it was not and how to copy it by hand (#250, answer 523).
// Android's share sheet never says it was closed, so the phone counts it as
// handed over; a browser does, so on a PC a closed menu hands nothing.

import { Share } from 'react-native';
import browser from '../native/NativeMinhajnaBrowser';

export type Sent = 'shared' | 'cancelled' | 'copied' | 'failed';

export async function sendReport(message: string, title: string): Promise<Sent> {
  if (!browser) {
    Share.share({ message, title }).catch(() => undefined);
    return 'shared';
  }
  const how = await browser.sendText(title, message).catch(() => 'failed');
  return how === 'cancelled' || how === 'copied' || how === 'failed' ? how : 'shared';
}
