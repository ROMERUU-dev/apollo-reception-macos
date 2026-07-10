#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen 2.38.0 or newer is required to regenerate ApolloReception.xcodeproj." >&2
  exit 1
fi

cd "$SCRIPT_DIR"
xcodegen generate --spec project.yml
