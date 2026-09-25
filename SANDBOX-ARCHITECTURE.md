# ProjectX Runtime Sandbox

ProjectX now validates generated software inside a dedicated browser iframe sandbox.

## Boundary

The runtime frame uses the browser `sandbox="allow-scripts"` boundary and `referrerpolicy="no-referrer"`. It deliberately does not grant same-origin, form, popup, or top-navigation capabilities.

Strict verification adds a Content Security Policy that disables arbitrary network connections, nested frames, workers, plugins, and form actions.

## Evidence

The sandbox emits structured runtime events for:

- uncaught runtime errors
- unhandled promise rejections
- console errors and warnings
- failed resources
- network attempts during strict verification
- popup attempts
- form submissions
- external-navigation attempts
- readiness and basic DOM/runtime metrics

The existing verification pipeline stores this evidence with the affected files. Failure evidence continues into the bounded self-healing repair loop.

## Rollback

File changes are still committed transactionally. Each execution stores inverse operations, so a later rollback can restore prior content only when the affected files have not changed since the transaction.

## Current scope

This layer is for generated browser/software artifacts. It is not a general-purpose server container or arbitrary backend code runner. Supabase Edge Functions provide isolated V8 execution, but their hosted runtime does not expose Node `vm` or Web Worker APIs and has strict CPU and wall-clock limits. A future external runner can provide full package/build/test execution when ProjectX needs that capability.
