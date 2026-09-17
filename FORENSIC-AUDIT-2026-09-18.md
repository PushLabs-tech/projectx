# ProjectX forensic findings — 2026-09-18

## FORENSIC FINDINGS

| Severity | File | Function | Data flow | Bug | Why it matters | Reproduction | Expected | Actual | Root cause | Architectural fix |
|---|---|---|---|---|---|---|---|---|---|---|
| P0 | projectx-core.js | applySpecChange / mergeSpec | mutation → spec → version → invalidation | `{features:{add:[...]}}` was silently ignored | canonical state could claim a mutation without changing state | apply add delta | feature added and version increments | old main stayed at version 1 | mergeSpec only accepted raw arrays | unified `applyProjectMutation` + `mergeSpecDelta` |
| P0 | px-final.js | aiJson / aiText | project → browser AI | guest AI did not receive canonical project state | AI could act without authoritative context | ask AI to modify current project | full project context | history/system only | old runtime serialized no project context | one v2 context contract |
| P0 | supabase/functions/ai/index.ts | projectContext / chat | client → Edge → provider | authenticated context omitted files and several derived states | provider could build against stale/incomplete state | chat after file mutation | server reloads authoritative project | partial project payload | old context contract | reload project by ID and include bounded canonical state |
| P1 | px-final.js | project creation/persistence | browser project → PostgreSQL | browser-generated IDs could conflict with UUID DB IDs | first cloud save could fail | create then persist | server ID adopted | old client ID persisted | ID ownership split | server-generated UUID becomes canonical |
| P1 | CI | apply-forensic-fix.yml + forensic_fix.py | push → patcher → source → push | self-modifying CI obscured what was actually deployed | source on main could differ from intended patch | inspect main after failed workflow | source is directly reviewable | patch existed only in runner after failure | patcher was not itself product source | remove self-modifying patcher |
| P1 | core | validation | interview → spec | validation was structural only | contradictions could pass discovery | no backend + cloud sync | clarification required | structurally valid | no semantic contradiction layer | contradiction-aware validation |
| P1 | workspace | section routing | section name → renderer | human names drove behavior | renaming could change semantics | rename section | stable kind | regex/name routing | UI labels doubled as type | `section.kind` + capability metadata |
| P1 | output | artifact build | project type → artifact | non-software projects were forced toward HTML | business/research became prose theater | research project | domain deliverable | software-shaped output | single artifact assumption | software vs document artifact kind |

## Current patch boundary

The canonical core has now been directly patched on `main`. The self-modifying forensic workflow and patcher were removed. The regression suite explicitly proves the new core mutation contract while documenting that the browser runtime and Edge Function still need their direct v2 integration.

## Do not mark complete yet

P0 production-path integration is not complete until `px-final.js` and `supabase/functions/ai/index.ts` directly consume the v2 canonical contract and the 10 scenario suite passes against the real UI/data flow.
