#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Publishes the release from the files and notes in release/ (releases.md,
# item 13); run by the release workflow from the repository's root, once the
# tag is pushed. The release is made as a draft, given every file, then
# published, so a re-run after a failure finishes it. A release already
# published is never changed. Environment: VERSION, PRERELEASE, LATEST,
# GH_TOKEN, GITHUB_REPOSITORY.

set -euo pipefail

tag="v$VERSION"
files=(release/minhajna-* release/SHA256SUMS.txt)
draft=$(gh release view "$tag" -R "$GITHUB_REPOSITORY" --json isDraft --jq .isDraft 2> /dev/null || echo missing)
if [[ $draft == false ]]; then
  echo "$tag is already published; it is left as it is"
  exit 0
fi
if [[ $draft == missing ]]; then
  gh release create "$tag" -R "$GITHUB_REPOSITORY" --draft --verify-tag --title "$tag" \
    --notes-file release/release-notes.md
fi
gh release upload "$tag" -R "$GITHUB_REPOSITORY" --clobber "${files[@]}"
flags=(--draft=false --title "$tag" --notes-file release/release-notes.md)
if [[ $PRERELEASE == true ]]; then flags+=(--prerelease); else flags+=(--prerelease=false); fi
if [[ $LATEST == true ]]; then flags+=(--latest); else flags+=(--latest=false); fi
gh release edit "$tag" -R "$GITHUB_REPOSITORY" "${flags[@]}"
gh release view "$tag" -R "$GITHUB_REPOSITORY" --json url,isDraft,assets \
  --jq '"\(.url) draft=\(.isDraft) files=\(.assets | length)"'
