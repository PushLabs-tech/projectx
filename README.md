# Project X — AI Execution OS Prototype

A dependency-free, browser-first prototype for an ambition-to-execution platform.

## What is included
- Premium dark SaaS UI
- Ambition-first home screen
- Outcome templates
- Project creation + local persistence
- Living blueprint
- Command center
- Visual builder preview
- Builder prompt / design / logic tabs
- Tasks + milestones
- Asset library and generated-asset previews
- Data layer mock
- Automation/workflow mock
- Analytics + AI insights
- AI Co-Founder with Discuss / Plan / Build / Analyze / Fix / Execute modes
- Project-aware chat memory in localStorage
- Version history / branch prototype
- Pricing / upgrade conversion flow
- Free / Pro / Max plan prototype
- Responsive mobile layout
- Command palette (Ctrl/Cmd + K)
- Settings, reduce motion, compact mode

## Important
This build deliberately does **not** depend on Supabase or any paid API. AI responses are locally simulated so the prototype can be demonstrated while backend quotas are exhausted.

Before production:
1. Move AI calls behind a secure server-side endpoint.
2. Add persistent hosted auth/database.
3. Add server-side usage metering and payment verification.
4. Add real code generation, preview isolation, deployment, integrations and agent permissions.
5. Never put provider secrets/payment secrets in frontend JavaScript.
