#!/usr/bin/env bash
set -euo pipefail

# Parse every Supabase Edge Function TypeScript file without bundling or resolving
# remote Deno/npm imports. This catches syntax errors that browser/build tests miss.
mapfile -d '' files < <(find supabase/functions -type f -name '*.ts' -print0 | sort -z)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No Supabase Edge Function TypeScript files found" >&2
  exit 1
fi

for file in "${files[@]}"; do
  echo "Syntax-checking $file"
  ./node_modules/.bin/esbuild "$file" --loader=ts --outfile=/tmp/projectx-edge-syntax-check.js >/dev/null
done

echo "PASS: parsed ${#files[@]} Supabase Edge Function TypeScript files"
