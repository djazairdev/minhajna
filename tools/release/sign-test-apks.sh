#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Signs a hosted test's APKs (answer 757, docs/demo-host.md), run by its
# workflow from the repository's root. The key is made here and thrown away, so
# an APK under it can't update a teacher's app, and a new run's can't update
# this run's. Each APK must then be its own app, TEST_APP, and must not carry
# the project's certificate. Writes them to test-apks/. Environment:
# ANDROID_HOME, BUILD_TOOLS, CERTIFICATE, TEST_APP, GITHUB_SHA, RUNNER_TEMP.

set -euo pipefail

tools="$ANDROID_HOME/build-tools/$BUILD_TOOLS"
built=apps/android/android/app/build/outputs/apk/release
keystore="$RUNNER_TEMP/throwaway.p12"
umask 077
trap 'rm -f "$keystore"' EXIT
KSPASS=$(openssl rand -hex 24)
export KSPASS
echo "::add-mask::$KSPASS"
keytool -genkeypair -keystore "$keystore" -storetype PKCS12 -storepass:env KSPASS -alias test \
  -keyalg RSA -keysize 2048 -validity 60 -dname 'CN=Minhajna hosted test'
mkdir test-apks
for abi in universal armeabi-v7a arm64-v8a; do
  apk="test-apks/minhajna-hosted-test-${GITHUB_SHA::8}-$abi.apk"
  "$tools/apksigner" sign --ks "$keystore" --ks-pass env:KSPASS --ks-key-alias test \
    --alignment-preserved --v1-signing-enabled false --v4-signing-enabled false \
    --out "$apk" "$built/app-$abi-release-unsigned.apk"
  badging=$("$tools/aapt2" dump badging "$apk")
  if ! grep -q "^package: name='$TEST_APP'" <<< "$badging"; then
    echo "::error title=Test APK::$apk is not $TEST_APP"
    exit 1
  fi
  certificates=$("$tools/apksigner" verify --print-certs "$apk")
  if grep -q "certificate SHA-256 digest: $CERTIFICATE\$" <<< "$certificates"; then
    echo "::error title=Test APK::$apk carries the project's certificate"
    exit 1
  fi
done
