#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=projectx_migration_test}"
: "${PGPASSWORD:=postgres}"
export PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD

project_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
user_id='11111111-1111-1111-1111-111111111111'
workspace_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

psql --set ON_ERROR_STOP=1 --quiet --command "INSERT INTO auth.users(id) VALUES ('$user_id') ON CONFLICT DO NOTHING;"
psql --set ON_ERROR_STOP=1 --quiet --command "INSERT INTO public.projects(id, owner_id, workspace_id) VALUES ('$project_id', '$user_id', '$workspace_id') ON CONFLICT DO NOTHING;"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

run_enqueue() {
  local out="$1"
  if psql --set ON_ERROR_STOP=1 --tuples-only --no-align --command "SELECT (public.enqueue_project_execution_job('$project_id'::uuid, '$user_id'::uuid, '{}'::jsonb, 3, 120)).id;" >"$out" 2>&1; then
    printf '0\n' >"$out.status"
  else
    printf '1\n' >"$out.status"
  fi
}

run_enqueue "$tmpdir/first.log" &
pid_a=$!
run_enqueue "$tmpdir/second.log" &
pid_b=$!

if wait "$pid_a"; then :; else :; fi
if wait "$pid_b"; then :; else :; fi

status_a="$(cat "$tmpdir/first.log.status")"
status_b="$(cat "$tmpdir/second.log.status")"
if [[ "$status_a" == "$status_b" ]]; then
  echo "FAIL: expected exactly one concurrent enqueue to succeed; statuses were $status_a/$status_b"
  cat "$tmpdir/first.log" "$tmpdir/second.log"
  exit 1
fi

if [[ "$status_a" == "1" ]]; then
  grep -qi "already active" "$tmpdir/first.log" || { cat "$tmpdir/first.log"; exit 1; }
fi
if [[ "$status_b" == "1" ]]; then
  grep -qi "already active" "$tmpdir/second.log" || { cat "$tmpdir/second.log"; exit 1; }
fi

active="$(psql --set ON_ERROR_STOP=1 --tuples-only --no-align --command "SELECT count(*) FROM public.job_queue WHERE project_id='$project_id'::uuid AND kind='execution' AND status IN ('queued','running');")"
if [[ "$active" != "1" ]]; then
  echo "FAIL: expected exactly one active execution job, got $active"
  exit 1
fi

echo "PASS: concurrent duplicate enqueue serialized to exactly one active execution job"
