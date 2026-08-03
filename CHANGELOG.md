# Changelog — ZAIRE Backend

All notable changes to the ZAIRE backend are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `specialists/design_dna.js` — Node port of aesthetic DNA profiles and universal design laws, with `selectDnaKey()` and `buildDnaSystemBlock()` for use in generation prompts
- `specialists/component_library.js` — registry of tested, token-driven section templates (navbar, hero ×2, about, features, pricing, testimonials, social proof, stats, CTA, contact, footer) selected via `renderSection(type, variant, tokens, content)` instead of freehand JSX
- `design_intelligence.js` schema now includes `page_sections: [{ type, variant, content }]`, constrained to registered `COMPONENT_LIBRARY` keys, replacing free-text section descriptions
- `specialists/generation_quality_gate.js` — post-generation validation pass (import resolution, `'use client'` enforcement, default export checks, package-import validation) intended to run before `PACKAGE`
- Reorganized `backend/` root into `daemons/`, `db/`, `security/`, `system/`, `scripts/`, `tests/`, `logs/`, `docs/`, alongside existing `routes/`, `services/`, `middleware/`, `memory/`, `specialists/`

### Fixed
- `buildPageContent` no longer falls back to raw intake text (`intake.what`, `intake.who`) as user-facing hero copy — content is now sourced from the design brief's `page_sections`
- `buildEngineerScaffold` previously generated only `app/page.tsx` regardless of `plan.pages` size — now generates a route file per planned page
- Contrast-safety guard (`ensureReadablePrimary`) added — a design brief resolving a near-invisible accent color (e.g. `#F7F7F7` on a `#fafafa` background) now falls back to a readable default instead of shipping unreadable text
- Escaped-newline bug in `buildPageContent`'s import string (`\\n` instead of `\n`) that produced invalid generated TSX
- Multiple stale `require()`/`import` paths left over from the backend reorg (`machine_id`, `crypto_utils`, `subscription_service`, `vault_service`, `memory_service`, `billing_service`, `system_tools`, `chat_history_service`, `db`)

### Security
- Removed `client_secret.json` and `.env` from full git history via `git filter-repo`; force-pushed rewritten history
- Removed `dist2/` packaged build artifacts (including compiled `.exe` binaries) from tracking
- **Pending confirmation:** production `ENCRYPTION_KEY` fallback-secret behavior, login rate limiting, vault key masking, and chat-history IDOR checks — tracked, not yet verified fixed

### In Progress
- Engineer Mode path traversal hardening — tracking a recurring backslash defect in generated `api/<X>\<Y>` folder names
- Content generation quality pass for `buildGenerationPrompts` — enforcing use of `competitive_analysis` as a hard constraint instead of background context
- Per-page `content_plan` generation (currently only the landing page gets a full brief; other planned pages still receive stub content)
- Capabilities Guard — intercepts and rescopes out-of-capability requests (e.g. 3D/WebGL) before generation begins

---

## [1.4.0] — 2026-07-23

### Added
- `buildDesignNarrative(brief, fullIntake)` in `design_intelligence.js` — generates `assumptions[]` and `agentConsensus{}` deterministically from the LLM-resolved `visual_tokens`, `competitive_analysis`, `content_plan`, and `motion_spec` fields
- `buildDesignNarrative` is now called from all three design-brief code paths: primary success, fallback object, and `/engineer/design-brief/regenerate`
- `buildPageContent()` in `engineer_workflow.js` — generates a complete, multi-section page (Hero / About / Projects / Skills / Contact / Footer for portfolios; Features / Pricing / CTA for SaaS) without depending on an LLM call

### Fixed
- Design brief fallback object (`visual_tokens`, `typography`, etc.) was hardcoded for an industrial-orange portfolio aesthetic — now correctly reads the intake's design style keywords
- `globals.css` fallback in `buildEngineerScaffold` now applies light or dark theme based on resolved design tokens, instead of always producing a dark ZAIRE-branded workspace
- Backend deploy failure caused by a `${primary)` typo (missing closing brace) in the navbar hover inline style inside `buildPageContent`

### Changed
- `POST /engineer/design-brief` and `POST /engineer/design-brief/regenerate` now merge `assumptions` and `agent_consensus` into the JSON response without persisting them to the `design_briefs` table

---

## [1.3.0] — 2026-07-22

### Added
- `buildPageContent` integration — the scaffold now always produces a rich, multi-section page regardless of LLM output availability
- `buildGenerationPrompts` now reads `profile.sections_order`, `profile.hero_pattern`, and `profile.layout_pattern` from the design brief

### Fixed
- Project ID capture in `index.js` — the real, database-assigned ID from `POST /engineer/intake` is now stored immediately and propagated to every subsequent Engineer Mode step
- Local fallback ID now uses `generateProjectId()`, correctly prefixed with `local-`, so it skips database persistence gracefully instead of causing foreign key errors
- A crash (`Cannot read properties of undefined (reading 'includes')`) caused by `null` path values during file tree rendering

---

## [1.2.0] — 2026-07-15

### Added
- `assertSafeRelativePath` in `engineer_qa_repair.js` — rejects paths containing `..` or absolute segments
- `materializeProject` and `qaProject` now split POSIX paths on `/` before passing them to `path.join`, to prevent Windows backslash folder-name bugs
- Automatic secret scanning in `/engineer/export` before the ZIP is created
- Dependency audit integration in the export pipeline — generates a `SECURITY_REPORT.md` inside every exported ZIP

### Changed
- `exportProjectZip` converted from callback-based to Promise-based, so errors are properly caught by the route handler

---

## [1.1.0] — 2026-07-01

### Added
- Full Engineer Mode pipeline: `POST /engineer/plan`, `/engineer/design-brief`, `/engineer/scaffold`, `/engineer/qa`, `/engineer/repair`, `/engineer/export`, `/engineer/materialize`
- Design Intelligence stage with LLM-powered competitive analysis, visual token resolution, and motion specification
- `POST /engineer/design-brief/regenerate` endpoint
- Project persistence via `project_files` and `design_briefs` PostgreSQL tables

### Changed
- LLM provider routing now supports OpenAI, Groq, and OpenRouter with automatic failover between providers

---

## [1.0.0] — 2026-06-01

### Added
- Initial ZAIRE backend with chat, memory, and agent routing
- Clerk-based authentication and license enforcement
- Python agent sidecar (`agent_daemon.py`) for computer-use features
- Socket.IO realtime events
- AWS S3 artifact storage
- Daily briefing system