#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
if [[ ! -f config.js ]]; then
  cp config.example.js config.js
fi
