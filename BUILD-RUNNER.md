# ProjectX Isolated Build Runner

ProjectX can send an exact generated snapshot to a connected GitHub repository and trigger a dedicated GitHub Actions verification workflow.

## Execution boundary

The workflow runs on an ephemeral GitHub-hosted runner. It checks out the exact commit SHA supplied by ProjectX, installs dependencies when a package manifest exists, runs the project's build plus test/check/E2E scripts when present, performs a basic static check otherwise, and writes a machine-readable `projectx-build-evidence.json` artifact.

The workflow has no application secrets, uses read-only repository permissions, clears common GitHub token environment variables for arbitrary project commands, disables checkout credential persistence, and has a ten-minute job bound.

## ProjectX lifecycle

1. ProjectX pushes the current project files to the chosen repository.
2. ProjectX ensures `.github/workflows/projectx-build.yml` exists on the repository default branch.
3. ProjectX dispatches `projectx_build` with the exact commit SHA and a durable ProjectX build-run ID.
4. GitHub Actions executes the snapshot in its isolated hosted runner.
5. ProjectX polls the workflow run, records job conclusions and artifact metadata, and exposes the run URL/evidence in the workspace.

This is a real build/test runner, not a browser iframe and not a claim that Supabase Edge Functions are general-purpose containers.
