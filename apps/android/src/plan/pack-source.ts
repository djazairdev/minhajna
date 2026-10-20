// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where a pack comes from (#225, R-4.2-10): the pages of its source file and
// the address it was found at. A pack is read as untrusted, so its address
// opens only when it is a plain https address on a named host, in printable
// ASCII with no user name or password, and only after the teacher confirms
// the host it names; the item's page goes after `#page=`, which PDF viewers
// follow, and nothing else is added (answer 289).

import type { PackItem, PlanPack } from '@minhajna/core';

const ADDRESS = /^https:\/\/((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})(:[0-9]{1,5})?(\/[!-"$-?A-~]*)?$/;

/** The first and last source pages the pack's items name, or null. */
export function sourcePages(pack: PlanPack): { readonly from: number; readonly to: number } | null {
  const pages = pack.items.flatMap((item) => (item.sourcePage === undefined ? [] : [item.sourcePage]));
  return pages.length === 0 ? null : { from: Math.min(...pages), to: Math.max(...pages) };
}

/** The address to open for the pack or one of its items, or null when it is not a plain https address. */
export function sourceAddress(pack: PlanPack, item?: PackItem): string | null {
  const found = pack.provenance.foundAt?.trim();
  if (found === undefined || found.length > 500 || !ADDRESS.test(found)) return null;
  return item?.sourcePage === undefined ? found : `${found}#page=${item.sourcePage}`;
}

/** The host an address opens, to name in the confirmation. */
export function sourceHost(address: string): string {
  return ADDRESS.exec(address.split('#')[0])?.[1] ?? address;
}
