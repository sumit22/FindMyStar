#!/usr/bin/env bash
# Sets CARGO_TARGET_*_LINKER environment variables for local Android cross-compilation.
# Source this file before running cargo build for Android targets:
#   source scripts/setup-ndk-env.sh

set -e

# Auto-detect NDK path
if [ -z "$ANDROID_NDK_HOME" ]; then
  if [ -d "$ANDROID_HOME/ndk" ]; then
    # Pick the latest installed NDK version
    ANDROID_NDK_HOME=$(ls -d "$ANDROID_HOME"/ndk/*/ 2>/dev/null | sort -V | tail -1)
    ANDROID_NDK_HOME="${ANDROID_NDK_HOME%/}"
  elif [ -d "$HOME/Android/Sdk/ndk" ]; then
    ANDROID_NDK_HOME=$(ls -d "$HOME"/Android/Sdk/ndk/*/ 2>/dev/null | sort -V | tail -1)
    ANDROID_NDK_HOME="${ANDROID_NDK_HOME%/}"
  fi
fi

if [ -z "$ANDROID_NDK_HOME" ] || [ ! -d "$ANDROID_NDK_HOME" ]; then
  echo "ERROR: Cannot find Android NDK. Set ANDROID_NDK_HOME and re-source this script."
  return 1 2>/dev/null || exit 1
fi

# Detect platform prebuilt directory
case "$(uname -s)" in
  Linux*)   PREBUILT="linux-x86_64"; EXT="";;
  Darwin*)  PREBUILT="darwin-x86_64"; EXT="";;
  MINGW*|MSYS*|CYGWIN*) PREBUILT="windows-x86_64"; EXT=".cmd";;
  *)        echo "ERROR: Unsupported OS"; return 1 2>/dev/null || exit 1;;
esac

TOOLCHAIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/$PREBUILT/bin"

export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="$TOOLCHAIN/aarch64-linux-android24-clang$EXT"
export CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER="$TOOLCHAIN/armv7a-linux-androideabi24-clang$EXT"
export CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER="$TOOLCHAIN/x86_64-linux-android24-clang$EXT"

echo "NDK linkers configured from: $ANDROID_NDK_HOME"
echo "  aarch64: $CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER"
echo "  armv7:   $CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER"
echo "  x86_64:  $CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER"
