#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Signs the release's tag with the release manager's SSH key (answer 536),
# then verifies and pushes it; run by the release workflow from the
# repository's root. The key, from RELEASE_TAG_KEY, is held by an agent for
# this script only: its file is removed once loaded, and its passphrase, if
# any, reaches ssh-add through the environment, never a file. The key's
# fingerprint must be TAG_KEY_FINGERPRINT. A tag left by an earlier attempt is
# kept when it names this commit; on another commit, the script stops.
# Environment: VERSION, GITHUB_SHA, GH_TOKEN, TAG_KEY, TAG_KEY_PASSPHRASE,
# TAG_KEY_FINGERPRINT, TAGGER_NAME, TAGGER_EMAIL, RUNNER_TEMP.

set -euo pipefail

tag="v$VERSION"
basic=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)
echo "::add-mask::$basic"
pushed=$(git ls-remote --tags origin "refs/tags/$tag^{}" | cut -f1)
if [[ -n "$pushed" ]]; then
  if [[ "$pushed" != "$GITHUB_SHA" ]]; then
    echo "::error title=Tag::$tag already names another commit, $pushed"
    exit 1
  fi
  echo "$tag was pushed by an earlier attempt; it is kept"
  exit 0
fi
if [[ -z "$TAG_KEY" || -z "$TAGGER_NAME" || -z "$TAGGER_EMAIL" ]]; then
  missing="RELEASE_TAG_KEY, RELEASE_TAGGER_NAME or RELEASE_TAGGER_EMAIL"
  echo "::error title=Tag::release-signing has no $missing (releases.md#setting-it-up)"
  exit 1
fi

umask 077
keys="$RUNNER_TEMP/tag-key"
mkdir "$keys"
eval "$(ssh-agent -s)" > /dev/null
trap 'ssh-agent -k > /dev/null; rm -rf "$keys"' EXIT
printf '%s\n' "$TAG_KEY" > "$keys/key"
printf '#!/bin/sh\nprintf "%%s\\n" "$TAG_KEY_PASSPHRASE"\n' > "$keys/askpass"
chmod 700 "$keys/askpass"
SSH_ASKPASS="$keys/askpass" SSH_ASKPASS_REQUIRE=force DISPLAY=none ssh-add -q "$keys/key" < /dev/null
rm -f "$keys/key"
ssh-add -L > "$keys/key.pub"
fingerprint=$(ssh-keygen -lf "$keys/key.pub" | cut -d' ' -f2)
if [[ "$fingerprint" != "$TAG_KEY_FINGERPRINT" ]]; then
  echo "::error title=Tag::RELEASE_TAG_KEY is $fingerprint, not the release manager's $TAG_KEY_FINGERPRINT"
  exit 1
fi

printf '%s namespaces="git" %s\n' "$TAGGER_EMAIL" "$(cut -d' ' -f1,2 "$keys/key.pub")" > "$keys/allowed"
git -c user.name="$TAGGER_NAME" -c user.email="$TAGGER_EMAIL" -c gpg.format=ssh \
  -c user.signingkey="$keys/key.pub" tag -s "$tag" -m "Minhajna $VERSION" "$GITHUB_SHA"
git -c gpg.ssh.allowedSignersFile="$keys/allowed" tag -v "$tag"
git -c http.extraheader="AUTHORIZATION: basic $basic" push origin "refs/tags/$tag"
