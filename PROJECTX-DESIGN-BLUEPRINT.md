# ProjectX — Product and Visual Design Blueprint

**Product:** ProjectX — The Universal Creation Engine  
**Design baseline:** Locked public experience and Project Brain foundations  
**Status:** Design decisions locked; implementation in progress

## 1. Product definition

ProjectX turns almost any human intention into a real, working, measurable outcome. It is not limited to code generation, websites, or chat. It adapts the process and workspace to the outcome being created.

Core lifecycle:

`USER INTENTION → UNDERSTAND → DISCUSS → PLAN → CREATE → EDIT → TEST → VERIFY → SECURE → OPTIMIZE → SHIP → OPERATE → IMPROVE`

Creation types include websites, applications, mobile experiences, games, AI agents, automations, APIs, dashboards, data applications, documents, presentations, research projects, business systems, internal tools, creative projects, and custom creations.

## 2. Product areas

1. Landing
2. Authentication
3. Dashboard
4. Projects
5. Workspace
6. Creation interface
7. AI assistant and specialist agents
8. Preview
9. Files and resources
10. Project Brain
11. Runs and activity
12. Settings
13. Mobile experience

Implementation order: appearance → frontend → backend → database → AI → integrations → execution engine → testing → deployment → authentication/security → billing → infrastructure and monitoring.

## 3. Global visual system

- Pure white foundation.
- Infrared coral primary accent: `#FF5A4F`.
- Clean, modern sans-serif typography.
- Generous whitespace and editorial section composition.
- Thin neutral borders and restrained shadows.
- Extremely subtle static coral atmosphere.
- Coral represents active/selected state, not a category palette.
- Motion is purposeful, not decorative.
- Respect keyboard focus, responsive layouts, and reduced-motion preferences.

Avoid generic AI dashboard styling, neon, rainbow modules, unnecessary gradients, excessive glassmorphism, fake statistics, fabricated workspace screenshots, and decorative motion without a product purpose.

## 4. Public landing — eight sections

### 01. Hero — locked

Keep the approved composition unchanged:
- White background and ProjectX logo.
- Navigation: Product, Pricing, Docs, Resources, Log in, Get Started.
- Badge: The Universal Creation Engine.
- Heading: **Turn any idea into a real product.**
- Coral emphasis on “real product.”
- Supporting text and centered creation composer.
- Capability chips: Website, App, Agent, Automation.
- Small shuffle control and circular coral send button.
- Subtle static coral atmosphere behind the composer.
- No 3D object in the hero.

The composer must continue into the existing ProjectX `beginCreation()` path.

### 02. Purpose

Heading: **Your idea is only the beginning.**

Explain that ProjectX turns human intent into working, measurable outcomes. Interactive lifecycle:
Intent → Understand → Plan → Create → Verify → Ship → Improve.

### 03. What You Can Create

Heading: **One engine. Almost any creation.**

Interactive capability tiles:
Websites, Applications, AI Agents, Automations, APIs, Dashboards, Games, Business Systems, Research, Documents, Presentations, Custom Projects.

Tiles expand in place to explain the kind of work they contain.

### 04. Why ProjectX Is Different

Heading: **It doesn’t just generate. It understands.**

Contrast a common flow (Prompt → Generate → Done) with the ProjectX direction:
Intent → Understand → Plan → Create → Test & Verify → Ship → Improve.

This communicates the product philosophy; it must not imply every stage is already deployed.

### 05. Product Experience

A future video placeholder only. Do not insert a fabricated logged-in workspace screenshot. The eventual video should show the real product:
Idea → ProjectX → Conversation/planning → Creation → Testing → Finished result.

The video is created after the actual product is ready.

### 06. Project Brain

Heading: **One project. One persistent brain.**

The Brain has three physical Core layers:
- Outer: Intention.
- Middle: Knowledge.
- Inner: Execution.
- Center: ProjectX X.

Core material: white/translucent architectural glass, soft ceramic surfaces, hairline geometry, restrained coral activation, and soft studio lighting. No sphere, generic brain, neon blob, cyberpunk lighting, or constant spinning.

Seven surrounding physical modules:
- Requirements — stacked plates: goals, constraints, acceptance criteria, priorities.
- Decisions — branching junction: choices, reasons, alternatives, consequences.
- Architecture — nested geometric framework: structure and relationships.
- Capabilities — connected nodes: what the project can actually do.
- Resources — linked objects: files, APIs, GitHub, models, integrations.
- Context — translucent information field: intent, preferences, constraints, research, confirmed facts.
- History — spatial timeline: idea, requirement, decision, version, build, test, fix, current state.

Modules are physical objects, not flat cards. Interaction states:
- Idle: quiet and translucent.
- Hover: selected module lifts slightly, sharpens, and receives a restrained coral edge.
- Selected: module approaches the camera, other modules retreat, Core layers separate, and detail opens.
- Architecture drill-down: Architecture → Frontend → Landing → Hero → Composer. Related levels may also include Backend, AI, and Database.

Use lightweight rendering and responsive fallbacks suitable for lower-powered devices. Mobile uses tap-to-expand and simplified depth.

### 07. Execution Loop

Heading: **Build it. Test it. Make it better.**

Interactive stages:
Build → Test → Diagnose → Fix → Retest → Verify → Ship → Improve.

Users may select a stage or play one guided pass. Do not imply remote execution has occurred merely because the visual loop animates.

### 08. Final CTA and Footer

Heading: **Turn it into something real.**

Get Started, Pricing, product/resource links, and legal links. Keep the ending calm and uncluttered.

## 5. Motion system

Three levels:
1. Micro-interactions: hover, press, focus, small lifts, icon movement, composer response.
2. Interactive storytelling: capability tiles, lifecycle, comparison, execution path, future video.
3. Flagship experience: Project Brain spatial exploration.

Prefer transforms and opacity. Respect reduced motion. Avoid unnecessary continuous rendering and equal-intensity movement throughout the page.

## 6. Technical implementation boundary

The current canonical browser flow is:

`index.html → px-final.js → px-ui.js / projectx-core.js`

Supabase remains the backend. Do not replace it with an AppDeploy mock backend. The current public landing should keep using ProjectX's existing `beginCreation()` path and existing authentication/workspace routing.

The public landing is presentation and product storytelling. It must not claim that a diagram, placeholder, or animation represents a live customer project unless it is connected to the project's real data and runtime.

## 7. Current implementation status

The first implementation pass introduces the eight-section public landing, responsive white/coral styling, interactive capability cards, lifecycle explanations, an interactive Project Brain model, and an execution-loop explainer. The existing authenticated workspace and Supabase data model are preserved.

The Project Brain data model can map to the existing Supabase project structures, including `projects`, `project_requirements`, `project_decisions`, `project_capabilities`, `project_resources`, `project_memory`, and `project_versions`.

A table existing in Supabase does not prove that every associated background service or autonomous runtime is deployed. Keep UI, schema, and live service status distinct.
