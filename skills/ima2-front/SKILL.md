---
name: ima2-front
description: "Frontend implementation skill for ima2 users. Use for any frontend, web UI, or visual implementation work — building, styling, or redesigning pages/components, responsive layouts, motion, component architecture, and production-surface polish. Pairs with ima2-uiux: load it first when design direction is vague; this skill implements the chosen direction. Triggers: 'frontend', 'UI', 'component', 'CSS', 'responsive', 'animation', 'React', 'Vue', 'Svelte', 'Tailwind', 'layout', 'styling', 'redesign', 'mockup', 'anti-slop', '프론트엔드', 'UI 작업', '반응형', '디자인 수정'."
metadata:
  last-verified: "2026-07-14"
  short-description: "ima2-powered production-grade frontend implementation with responsive, accessible, anti-slop UI guidance."
  keywords: [frontend, UI, component, CSS, responsive, layout, animation, design implementation]
---

# ima2 Frontend — Domain-Correct Frontend Engineering

## Setup

```bash
npm install -g ima2-gen    # install globally (Node.js >= 20)
ima2 setup                 # first-time auth (GPT OAuth recommended)
ima2 serve                 # start local server
ima2 ping                  # verify
ima2 capabilities --json   # check models, limits, providers
ima2 defaults --json       # inspect default model/reasoning
```

**Agent bootstrap:** `ima2 ping` first. If unreachable: `ima2 serve &`. If not
installed: `npm install -g ima2-gen && ima2 setup`. Use `ima2 skill path` to
locate the skills directory; read `../ima2-uiux/SKILL.md` for design direction
and `../ima2-front/SKILL.md` (this file) for implementation.

Build production-grade frontend implementations from an established product/design direction.
This skill owns HTML/CSS/component/runtime implementation, responsive behavior, accessibility
wiring, visual verification, and frontend platform rules.

> **Role separation:** For design judgment — typography/color/layout direction, UX decision
> gates, product personalities, or vague visual briefs — load `ima2-uiux` first. This
> skill implements the chosen direction; `ima2-uiux` makes the design decisions.
> Implementation anti-slop enforcement stays here; design taste/pattern judgment lives there.

> **C0/C1 work (small local patches):** For small patches, skip the full reference chain.

## Modular References

> **Loading references via CLI:**
> **Recommended: install skills to your agent's skill directory.**
> ```bash
> ima2 skill install --dir <agent-skill-path>   # agent provides its own path
> ima2 skill install --tmp                       # ephemeral fallback
> ```
> The agent determines its own skill directory (e.g. `~/.codex/skills/`,
> `./skills/`, etc.) and passes it via `--dir`. After install, SKILL.md and
> `references/` are on disk — the agent reads them natively via relative paths.
>
> **Ad-hoc reading (without install):**
> ```bash
> ima2 skill front refs              # list all reference modules with line counts
> ima2 skill front ref motion        # print one module (basename match)
> ima2 skill front ref stacks/react  # print a nested module
> ```

| File                                      | When to Read                         | What It Covers                                                                    |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `references/crud-ui.md`              | C2 list/detail/form product screens  | State coverage (loading/empty/error/permission), forms, objective UX gates         |
| `references/anti-slop.md`            | New components or UI redesign        | 2026 AI slop patterns, Korean slop, oversized text, fake assets, default UI smells |
| `references/aesthetics.md`           | Implementing an established visual direction | Domain-correct typography, color, composition, serif three-role system, expressive/functional layers, AI-brand grammar                    |
| `references/product-density.md`      | Apps, tools, dashboards              | Density profiles for landing, consumer app, SaaS, ops, finance, devtools          |
| `references/asset-requirements.md`   | Any public/product/visual surface    | Required screenshots, images, diagrams, charts, generated bitmaps, or 3D assets, mockup production pipeline   |
| `references/visual-verification.md`  | Changes affecting rendered layout    | Screenshot, viewport, text fit, state, asset, and motion verification              |
| `references/korea-2026.md`           | Korean-first or Korea-facing UI      | Korean service patterns, CJK typography, formats, mobile flows, Korean serif/myeongjo display                     |
| `references/ux-writing-ko.md`        | Korean UI copy                       | Natural Korean labels, error messages, tone, spacing, punctuation                  |
| `references/soft-3d-asset-gates.md`  | 3D/miniature/character-like visuals  | Toss-style soft 3D vs generic cute asset slop, domain gates                        |
| `references/motion.md`               | Motion/animation needed              | CSS animations, Framer Motion, CSS scroll-driven timelines, pointer-proximity chip motion (magnetic/dock), View Transitions, domain gates, organic bg + capsule label, product-led hero motion |
| `references/liquid-glass.md`         | Translucent materials, glass chrome, pill-chip surfaces | Liquid Glass layer discipline, named material states (pill-at-top/pill-scrolled/media-overlay/clear), FE-PILL-NEST-01, blur-free pill alternative, perf + a11y gates |
| `references/top-bar.md`              | Top/nav bar composition, sticky chrome | Top-bar grammar: geometry, slots, scroll-state contract (FE-TOPBAR-STATE-01), hover-surface contract (FE-TOPBAR-HOVER-01), domain gate, mobile collapse |
| `references/iterative-design.md`     | Multi-round design                   | LLM convergence problem, Diverge→Kill→Mutate process, upgrade techniques           |
| `references/prototype-variants.md`   | Runnable design variants             | `?variant=` switchers, structurally distinct options, cleanup after winner selection |
| `references/typography-wrapping.md`  | Heading/descriptor text changes      | `text-wrap: balance/pretty`, natural phrase breaks at any width, dynamic-viewport verification, `ch` units, Korean keep-all/orphan rules (verified 2026-07-07) |
| `references/logo-sections.md`        | Integration/partner logo display     | Marquee CSS, static grid, orphan cell fix, grayscale treatment, no individual hover |
| `references/brand-asset-sourcing.md` | Brand logos in UI                    | Simple Icons/SVGL sourcing, AI agent strategy, placeholder hierarchy, legal guide  |
| `references/reference-capture.md`    | Cloning/analyzing other sites        | HTML+asset capture mechanics (pageAssets/curl), analysis-only legal line, provenance manifest, never-ship gate |
| `references/section-level-sourcing.md` | Section-level design work (hero, pricing, testimonials, etc.) | Per-section-type reference sources from Land-book, One Page Love, and Lapa.ninja |
| `../ima2-uiux/references/compositional-patterns.md` | Implementing an award-informed composition | Canonical hero, navigation, motion, and content-structure patterns with implementation gates |
| `../ima2-uiux/references/design-award-sources.md` | Sourcing real-world design references | Tiered award/gallery source guide and search tactics |
| `../ima2-uiux/references/design-trends.md` | Implementing a dated trend or checking whether a technique is stable | 2026-07-14 prevalence, maturity, signature status, risks, and re-crawl rules |
| `references/dropdown-layer.md`       | Dropdowns, selects, menus, pickers   | Unified dropdown design layer (FE-DROPDOWN-LAYER-01): one skin over headless primitives, DS-detection precedence, scope table, mobile sheet |
| `references/layout-discipline.md`    | Landing/marketing pages              | Hero, eyebrow, section repetition, bento, zigzag, per-section responsive transforms, hero composition grammar (2026) |
| `references/consistency-locks.md`    | Any multi-section page               | Color, shape, theme consistency per page                                           |
| `references/responsive-viewport.md`  | Layout or breakpoint changes         | Canonical breakpoints, page containment, container queries, responsive images, safe area, split-screen |
| `references/mobile-ux.md`            | Consumer/landing pages with mobile traffic | Thumb zone, touch targets, sticky CTA, mobile section composition, bottom sheet, portrait media |
| `references/seo-baseline.md`         | Public-facing sites, SSR/SSG         | SEO meta, JSON-LD, robots.txt, GEO strategies, OG/Twitter cards                    |
| `references/a11y-patterns.md`        | Interactive widgets, modals, forms   | ARIA patterns, focus management, keyboard nav, screen reader testing               |
| `references/performance-budget.md`   | Launch / audit                       | CWV targets, bundle budgets, font loading, image optimization, build gates         |
| `references/theme-switching.md`      | Dark mode / theme                    | CSS custom properties toggle, FOWT prevention, transition, component checklist     |
| `references/color-system.md`         | Color tokens, palettes wiring, theme-ready CSS | Token layering, `oklch()` + fallback discipline, `color-mix()`, `light-dark()`, Tailwind v4/shadcn wiring, contrast gates (verified 2026-07-07) |
| `references/i18n-global.md`          | Multi-language / RTL                 | RTL layout, pluralization, Intl API, locale switching, content expansion           |
| See also: `ima2-uiux` skill         | Vague requests, onboarding, UX states | Intent discovery, design isms, product personalities, onboarding/empty/error patterns |
| `references/stacks/react.md`              | React projects                       | Server Components, hooks, state, TanStack Query, shadcn/ui, performance            |
| `references/stacks/nextjs.md`             | Next.js projects                     | App Router, RSC, image optimization, data fetching, middleware                     |
| `references/stacks/vanilla.md`            | HTML+CSS+JS (no framework)           | Zero-dependency, viewport fitting, responsive CSS, progressive enhancement         |
| `references/stacks/svelte.md`             | Svelte/SvelteKit projects            | Svelte 5 Runes, SvelteKit 2 routing/actions, snippets, migration from Svelte 4     |
| `references/stacks/mobile-native.md`      | Native mobile app development        | RN/Expo current pairing, Flutter 3.44, KMP, Swift 6, framework selection           |
| `references/stacks/astro.md`              | Astro projects                       | Islands architecture, multi-framework shell, content collections, SSG/SSR/hybrid   |

Start with `anti-slop.md`, `aesthetics.md`, `responsive-viewport.md`, and `visual-verification.md`. Add domain/locale/stack references only when relevant.
For C2 ordinary app screens (form/table/list/detail), `crud-ui.md` alone suffices; add the style references above for marketing/visual surfaces or C3+ work.

When frontend choices depend on current framework, design-system, browser API,
library behavior, browser-rendered source evidence, or package/source freshness,
read the active `search` skill and follow its source-fetch and evidence-status
rules before treating external material as proof.

### Verification grounding

**STRICT:** For render/executable artifacts (HTML, SVG, games, UI, charts),
run the real renderer: headless browser, screenshot, canvas check, or equivalent.
Observe the actual output yourself, fix what observation reveals, then re-run.
Static parsing confirms well-formed files; it does not prove the artifact is
visually or interactively correct. One clean observation is enough for unchanged
state; do not re-render unchanged output just to repeat evidence.

---

## 0. Frontend Routing

Before designing or coding, classify the work:

| Decision | Options | Why It Matters |
| --- | --- | --- |
| Product surface | landing, app, dashboard, AI tool, public service, education, game, creative | Sets density, typography scale, asset requirements |
| Locale | Korean-first, global/i18n, English-only | Sets CJK typography, copy, date/number formats |
| Density | campaign, consumer app, productivity, SaaS, ops, finance, developer console | Prevents landing-page composition inside repeated-work tools |
| Asset need | none, screenshot, product photo, diagram, chart, illustration, soft 3D, game asset | Prevents asset-free gradient/card UI |
| Soft 3D/character gate | not allowed, subtle, primary | Prevents generic cute 3D/mascot slop |
| Motion intensity | static, feedback-only, expressive, cinematic | Prevents cinematic motion in utility workflows |

Default rules:
- For apps/tools/dashboards, build the actual working surface first, not a marketing hero.
- For Korean-first work, read `korea-2026.md` and `ux-writing-ko.md`.
- For any soft 3D miniature, mascot, chibi, toy-like object, or character-like asset, read `soft-3d-asset-gates.md`.
- For product/brand/object/place/person pages, use concrete visual assets in the first viewport.
- For finance, government, B2B, admin, auth, security, and developer tools, keep visual warmth restrained and subordinate to clarity.
- Every user-facing decision point must justify its existence — defaults first, one primary action per screen, choices demoted to progressive disclosure (`ima2-uiux` UX-LAZY-01 owns the gate).
- For text-heavy surfaces (landing, marketing, editorial, public service), apply typography wrapping defaults — see `typography-wrapping.md`. Dashboard table cells are excluded.

---

## 1. Component Identification

When the user describes UI in vague terms (e.g. "접히는 거", "팝업 같은 거"):
1. Recommend the best-fit component with reasoning: `<Name> — <what it does, why it fits>`
2. Confirm, then proceed

If the user already names a specific component, skip this step.
Reference: [component.gallery/components](https://component.gallery/components/)

For new React/Vue/Svelte/Next UI source files, prefer `.tsx` or typed component files when the repo supports TypeScript. Inherit `dev` TypeScript strict-compatibility rules.
If frontend structure is unclear, read existing source-of-truth docs first, then document pages, components, routes, state stores, and build commands in the repo's existing docs before broad implementation.

---

## 1.5 Objective Gates vs Style Samples

Two different kinds of rules live in this skill (see the work classifier):
- **Objective UX gates (STRICT/DEFAULT)** — accessibility baseline (§7, §11), state coverage
  (loading/empty/error/permission), keyboard operability, visible focus, contrast. Missing
  these are review findings.
- **Style direction (STYLE_SAMPLE)** — design direction intake (§2), aesthetics, density profiles,
  product personalities, preset tokens, and the concrete values in §4-§5 (palettes, font
  choices, pixel max-widths). These illustrate acceptable choices; they are NOT
  requirements, must not override an existing design system (Design System Detection stays
  MANDATORY), and must never be enforced as universal taste (UX-STYLE-01).
## 2. Design Direction Intake

> When the user cannot articulate a clear design direction, load `ima2-uiux` to
> discover intent and choose a direction before implementing here.

Before coding, commit to a domain-correct direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Surface**: Is this a working tool, dashboard, public service, AI workflow, game, landing page, or editorial surface?
- **Tone**: Pick a specific direction. For product tools this often means quiet, dense, trustworthy, and fast rather than loud.
- **Constraints**: Framework, performance budget, accessibility requirements.
- **Signature**: What ONE thing will make this unforgettable? (the signature
  moment; supporting scroll reveals may exist alongside it per
  `motion.md` FE-MOTION-BUCKET-01)

When user intent is vague ("깔끔하게", "모던하게", "just make it look good"), read the `ima2-uiux` skill and run the User Intent Discovery Protocol before making routing decisions.
If the user cannot answer these questions, use the `ima2-uiux` skill's structured preference elicitation flow. Offer product references ("Notion 느낌? Linear 느낌?") and visual comparisons.

**Concept pass before code (stub — canonical: `ima2-uiux` §2.5 UX-CONCEPT-GEN-01):**
for a C2+ new/redesigned expressive or brand-visible surface (page, hero, key
chrome like a top bar) with open design direction — probe `ima2 status`, attempt
`ima2 serve` if down, then run `ima2 models --kind image` and configure
`ima2 defaults set image <lane>/<model>` before any bare `ima2 gen`; use the
native image generator only as a true fallback — then
generate 5 highly specific candidate mockups of ONE locked concept, then SYNTHESIZE the
best elements across all 5 (NOT pick a single winner) into DESIGN.md and implement from
that synthesis — do not start coding the layout blind.

Intentionality over intensity. Bold maximalism, refined minimalism, dense utility, and friendly consumer UI can all work when they match the domain.

---

## 3. Baseline Configuration

Adjust these dials based on what's being built. Present to user if unclear.

| Dial             | Default | Range | Meaning                              |
| ---------------- | :-----: | :---: | ------------------------------------ |
| DESIGN_VARIANCE  |    5    | 1-10  | 1=symmetric utility, 10=asymmetric art |
| MOTION_INTENSITY |    4    | 1-10  | 1=static, 10=cinematic choreography    |
| VISUAL_DENSITY   |    5    | 1-10  | 1=art gallery airy, 10=cockpit dense   |

After Design Read, set dials per `ima2-uiux` §2 Dial Setting.

Product density profile (D1-D8 in `references/product-density.md`) sets component class; VISUAL_DENSITY (1-10) sets spacing within that class. These are orthogonal axes.

Adapt dynamically based on user requests. Dashboard → density up. Portfolio → variance up. Data tool → motion down.
Korean app/tool surfaces usually need higher density and clearer hierarchy, not oversized hero text.

---

## 4. Implementation

Read `references/aesthetics.md` for full guidelines. Summary:

- **Typography**: Use domain-appropriate typography. For Korean-first UIs, prioritize CJK-safe stacks before Latin display fonts. Apply `text-wrap: balance` on all headings **AND short descriptors** (hero subtitle, card description, caption — anything 1-3 lines). Use `text-wrap: pretty` only on body paragraphs (4+ lines). `pretty` has no effect on short text and will leave Korean orphans like "합니다." or "화." on a line alone. See `typography-wrapping.md` for full rules.
- **Color**: Max 1 accent. Use neutral bases (Zinc/Slate) with singular high-contrast accent — avoid purple-on-white.
- **Layout**: Match the product surface. Avoid centered-card/hero patterns in repeated-use tools.
- **Motion**: See `references/motion.md`. One signature moment + a few
  supporting reveals > 10 scattered effects; landing-bucket floor/ceiling per
  FE-MOTION-BUCKET-01.
- **Assets**: Use screenshots, product images, diagrams, charts, illustrations, generated bitmaps, or soft 3D only when they add product meaning. When a real bitmap is needed (icon, hero, illustration), generate it with `ima2` — probe `ima2 status`, attempt `ima2 serve` if down, inspect `ima2 models --kind image`, and set `ima2 defaults set image <lane>/<model>` before using bare generation — falling back to the native `imagegen` tool only when ima2 is truly unavailable; never ship a placeholder. `ima2` is preferred because it supports reference images, multi-candidate generation (`-n N`, multimode, independent CLI parallel — see `asset-requirements.md` FE-ASSET-PARALLEL-01), a backend-selectable prompt builder, raster-to-vector tracing (`ima2 vectorize` and Canvas trace — see `asset-requirements.md` Raster vs real vector), session style sheets, provider routing (GPT/Grok/Gemini — see `asset-requirements.md` FE-ASSET-PROVIDER-01), variant selection with element-ledger synthesis (`asset-requirements.md` FE-ASSET-SELECT-01), cutout asset background strategy (`asset-requirements.md` FE-ASSET-BG-01), and video (`ima2 video` — see `motion.md` FE-MOTION-VIDEO-01) for motion assets. For parallel generation, monitor with `ima2 ps --json` and cancel unwanted jobs with `ima2 cancel <id>`. Write **very explicit long prompts** (subject, composition, palette, lighting, style, aspect) per `asset-requirements.md`; prefer real/generated image or video assets over CSS gradient washes. Read any design reference or captured screenshot back into context with `view_image` before matching it. Third-party captures follow `reference-capture.md` (analysis-only, provenance manifest).
- **Visual verification**: after UI changes, exercise the flow per visual verification (screenshot -> view_image) — `browser:control-in-app-browser` on the dev server, screenshot, `view_image` — instead of claiming visual correctness from code alone.

### Cutout Asset Generation (FE-ASSET-BG-01 surface — STRICT)

GPT Image 2 cannot produce transparent backgrounds. Requesting "transparent
background" or "PNG with alpha" yields checkerboard artifacts or solid fills.
**Every cutout asset** (icons, product shots, 3D objects, illustrations, stickers,
UI elements that float over arbitrary backgrounds) MUST use the solid-background-
then-remove pipeline. Full rules and recipes: `references/asset-requirements.md`
§ Asset Background Strategy.

**Quick reference — generation template:**

```bash
# Reflective/metallic/glass subjects → PURE BLACK bg
ima2 gen "3D render of [subject], [material/style details], [composition]. \
  Floating on a PURE SOLID BLACK background. The background must be 100% flat \
  pure black hex #000000. No checkerboard, no transparency pattern, no gradient, \
  no floor plane, no shadow, no vignette, no ambient glow on the background." \
  --model oauth/luna --quality high --size 1024x1024 --mode direct -o asset.png

# Dark/opaque subjects → PURE WHITE bg
ima2 gen "[subject description], centered, floating. PURE SOLID WHITE background \
  hex #ffffff. No shadow, no gradient, no surface, no reflection plane." \
  --model oauth/luna --quality high --size 1024x1024 --mode direct -o asset.png

# Known destination color → match it exactly
ima2 gen "[subject description], centered. PURE SOLID background hex #[target]. \
  No gradient, no texture, no shadow." \
  --model oauth/luna --quality medium --size 512x512 --mode direct -o asset.png
```

**Quick reference — CSS removal (zero post-processing):**

| Source bg | Target page | CSS rule |
|-----------|-------------|----------|
| Black | Light | `mix-blend-mode: screen` |
| White | Dark | `mix-blend-mode: multiply` |
| Any | Any | `isolation: isolate` on container to prevent bleed |

For programmatic removal (build pipelines): `sharp`, ImageMagick, or `rembg`.
For interactive cleanup: ima2 Canvas Mode. For targeted fix: `ima2 edit`.

---

## 5. Anti-Slop Enforcement

Rule classes (dev §0.2): items below are DEFAULT — deviate with a stated reason; concrete
values and palettes are STYLE_SAMPLE (§1.5); the emoji-as-UI-icon ban is the only STRICT item.

Read `references/anti-slop.md` for full rules. Key standards:

### Hero discipline (FE-HERO-01)

- First viewport must fit: hero content leaves a hint of the next section on mobile and desktop.
- Keep hero copy to ~4 text elements max: headline, subhead, primary CTA, one proof/context line.
- Do not put trust strips, pricing teasers, feature bullets, or mini dashboards inside the hero.
- Logo walls belong below the hero, not as hero filler.
- Plan font scale with image/product scale so neither crushes the other.

- Treat unexamined default typography as a slop signal. Choose a domain-appropriate stack; Korean-first UI should use CJK-safe fonts and system fallbacks deliberately.
- **Gradient budget (FE-GRADIENT-01)**: gradient soup is the 2026 #1 anti-slop signal; max 1 ambient gradient per viewport and no gradients on 3+ sibling cards — see `anti-slop.md § Gradient Budget`
- **One-note theme ban (FE-ONENOTE-01)**: full-page single-hue dark washes (terminal green, cyber cyan, CRT amber) are the current dark-mode tell — see `anti-slop.md § One-Note Theme Ban`
- **No self-describing meta copy (FE-METACOPY-01)**: UI text must explain the product/user job, never narrate the mockup, layout, responsive behavior, or agent process — see `anti-slop.md § Self-Describing Meta Copy`
- Use neutral or intentional color palettes — purple gradients on white are now the old tell; gradient overuse and one-note single-hue themes are the current tell
- Use asymmetric or purposeful layouts — centered-everything reads as template
- Vary card sizes, spans, and groupings — equal 3-card grids read as generic
- **Bento composition (FE-BENTO-01)**: bento grids must read as one interlocking slab with aligned row edges, a dominant cell, content-weighted spans, and no orphan tail — see `layout-discipline.md § Bento Composition`
- Avoid oversized bold hero text inside tools, dashboards, admin, finance flows, and public services
- **Hero composition (FE-HERO-SPLIT-01)**: never build a split hero (left bold headline + right boxed screenshot/mockup card) unless the user explicitly requests one — the product visual is the stage (full-width, background, or interactive demo), never a right-column card; paid-conversion LPs are the one context to propose it — see `layout-discipline.md § Hero Composition Grammar`
- Avoid asset-free UI: abstract blobs/gradients do not replace real visual evidence
- Avoid generic soft 3D icon packs; soft 3D must be semantic, brand-consistent, and restrained
- **NEVER use emoji as UI visual elements** (feature icons, card icons, section markers, buttons) — emoji in production UI is the #1 AI slop signal. Use SVG icons (Lucide/Phosphor/Heroicons). See `anti-slop.md § Emoji Slop`
- Warm beige/cream backgrounds with brass/clay accents are banned as defaults for premium-consumer briefs — see `anti-slop.md § Premium-Consumer Palette Ban`
- Layout monotony (same family repeated, 3+ zigzag sections, overused eyebrows) — see `references/layout-discipline.md`
- Color, shape, and theme must be locked per-page and audited before shipping — see `references/consistency-locks.md`
- Use off-black (`#0a0a0a`, `#111`) — pure `#000000` lacks depth
- **Responsive enforcement**: every multi-column section must declare its mobile/tablet collapse behavior — "it'll work at mobile" is not a plan. See `responsive-viewport.md`
- **Page containment required**: `max-w-[1400px] mx-auto` or equivalent wrapper. Content stretching to viewport edges on wide monitors is a layout bug
- **Mobile is a different product**: section composition, CTA placement, and interaction model change on mobile — it is NOT just "desktop stacked vertically." See `mobile-ux.md`
- Use realistic, specific names and brands in placeholder content
- Write original copy — avoid "Elevate", "Seamless", "Next-Gen" and similar clichés
- Treat uncontrolled heading line breaks (orphaned single word, no `text-wrap`, no `max-width` in `ch`) as a slop signal — see `typography-wrapping.md`
- Treat short descriptors (hero subtitle, card description, caption) using `text-wrap: pretty` instead of `balance` as a slop signal — `pretty` does nothing on 1-3 line text, especially Korean
- Treat Korean orphan fragments ("합니다.", "화.", "입니다." alone on a line) as a slop signal — always verify Korean text breaks at target viewports
- Treat generic stroke icons as brand logo substitutes as a slop signal — use actual brand SVGs from Simple Icons, SVGL, or press kits. See `brand-asset-sourcing.md`
- When NO design brief exists, do not invent a generic default: apply the domain-gated no-brief kit owned by `ima2-uiux` §1 UX-DEFAULT-ISM-01 and state the assumption

### Do not ship these tells (FE-AI-TELL-01)

Version labels in heroes, numbered eyebrows, middle-dot overuse, duplicate image reuse, monospace uppercase card labels, fake social-proof headers, decorative scroll cues, weather/status strips with no product purpose, photo-credit captions in UI chrome, and generic "trusted by teams worldwide" claims are AI-default tells. Full catalog: `references/anti-slop.md` + `references/layout-discipline.md`.

---

## 6. Performance Guardrails

- Animate `transform` and `opacity` only — layout properties (`top`, `left`, `width`, `height`) cause jank
- Grain/noise filters → fixed pseudo-elements only, keep off scrolling containers
- `will-change` sparingly — remove after animation completes
- Z-index only for systemic layers (navbar, modal, overlay)
- Memoize perpetual animations in isolated components

### Browser Connection Limits

| Protocol | Limit |
|---|---|
| HTTP/1.1 | 6 connections per domain (Chrome/Firefox) |
| HTTP/2 | 1 TCP connection, 100 concurrent streams |
| WebSocket | Shares the HTTP/1.1 connection pool |

Rules:
- Never open >2 SSE/WebSocket connections to the same origin from one page
- Use connection multiplexing (single WebSocket with channel/topic routing) over multiple connections
- If >6 parallel requests needed: use HTTP/2, batch API endpoints, or domain sharding (last resort)
- Preflight OPTIONS requests count against the connection limit; consolidate CORS-heavy calls

Banned:
- Opening unbounded WebSocket connections per component instance
- Polling from multiple components independently (centralize into one subscription, fan out via state)
- Creating new SSE connections on every remount without cleanup

---

## 7. Accessibility Baseline

- Semantic HTML (`<button>`, `<nav>`, `<main>`)
- Keyboard navigation for all interactive elements
- WCAG AA minimum (4.5:1 normal text, 3:1 large text)
- Visible focus indicators (`focus-visible:ring-2`)
- `prefers-reduced-motion` support
- Skip link or equivalent bypass for repeated navigation
- Focus must not be hidden by sticky headers, sticky bottom bars, sheets, or overlays
- Icon-only buttons need accessible names (`aria-label`, visible text, or labelled-by)
- Charts, status messages, loading progress, and AI streaming states need screen-reader labels or live regions where appropriate
- Do not encode meaning by color alone
- Modals, menus, comboboxes, bottom sheets, and command palettes must have a complete keyboard path
- Stress-test Korean long labels and screen-reader names; clipped Hangul is a failure
- Pointer targets follow WCAG 2.2 AA target-size rules; 44×44px is a conservative product baseline, not the only legal minimum

### A11y polish (FE-A11Y-POLISH-01)

- CTA text fits on one line at target breakpoints; if it wraps, shorten the label or change the layout.
- Inputs need visible boundaries against their background in default, focus, error, and disabled states.
- Duplicate CTA intent on the same screen should merge or clearly differ by outcome.
- Button contrast is checked during visual review, not left to palette intent.

---

## 8. Custom Hooks

Create a custom hook only when it owns reusable behavior, not just because code is a few lines long.

Good hook candidates: subscription lifecycle, reusable async state machine, form-field behavior shared across components, media/query/observer integration, keyboard/focus behavior, external store wrapper.

Avoid hooks that are merely thin aliases for `useState`, `useToggle`, `useDebounce`, or one-off component logic unless the repo already standardizes them.

Hook rules:
- The hook name describes behavior, not implementation
- Inputs are explicit and stable; return shape is small
- Side effects are justified by an external system; cleanup is correct
- Dependencies are honest; use `useEffectEvent` for non-reactive callbacks inside Effects
- Do not hide server state, router state, or form ownership inside a generic hook

---

## 9. React Performance

Default performance strategy: keep components pure, keep state local, classify state ownership correctly, use server rendering/caching boundaries, split expensive client islands, measure before memoizing.

| Tool | Use when |
|------|----------|
| `memo` | child render is expensive and props are stable |
| `useMemo` | calculation is expensive or identity is required |
| `useCallback` | callback identity is required by memoized child or external API |
| `useTransition` | interaction should stay responsive while non-urgent work completes |
| `useOptimistic` | mutation UX benefits from reversible optimistic state |
| `Activity` | hidden UI should preserve state without active Effects |
| `Suspense` | dynamic/async boundary needs isolated loading behavior |

If React Compiler is enabled, remove defensive memoization unless measurement or semantics justify it. Split at route boundaries and heavy components (charts, editors, 3D).

---

## 10. Form Handling

For simple forms, use controlled components with schema validation (Zod). For complex forms (multi-step, dynamic fields), use `react-hook-form` + Zod resolver. Always show field-level errors with `role="alert"`.

---

## 11. Accessibility Quick-Wins

Beyond the baseline (§7):
- Focus management: trap focus in modals, restore on close, handle Escape
- Arrow keys navigate lists and menus; Enter/Space activate buttons and links
- Tab order follows visual flow
- `aria-expanded`, `aria-haspopup`, `aria-activedescendant` on composite widgets
- Test with screen reader and keyboard-only navigation

---

## 12. 2026 Frontend Platform Rules

Use this section when modernizing or creating React/Next/Vite frontends. Prefer project conventions first.

### React 19.2+

- **Activity**: Use `<Activity>` for state-preserving hidden UI (tabs, drawers, route shells). Do not use for security hiding or active subscriptions.
- **useEffectEvent**: For non-reactive logic inside Effects that needs latest props/state without resubscribing. Never call during render or pass to children.
- **Partial Pre-rendering**: Design pages as static shell + explicit dynamic holes + Suspense boundaries. No `Date.now()`, `Math.random()`, or request-specific data in the pre-rendered shell.
- **React Compiler**: Do not cargo-cult `memo`/`useMemo`/`useCallback`. Measure first unless referential stability is semantically required.

### Next.js 16

- Turbopack is default. Do not add custom webpack config unless proven unsupported.
- **Cache Components** (`cacheComponents: true`): dynamic rendering is default; cache only what you explicitly mark with `use cache` + `cacheLife` + `cacheTag`.
- Never cache user/session-specific data without explicit user-scoped cache key.
- Server Actions: validate input server-side, authorize against the resource, revalidate affected cache tags.

### Modern CSS

Prefer native CSS before JS layout observers or animation libraries:
- **Container queries** for component-level responsive layout (not viewport)
- **`:has()`** for parent/sibling state selection — keep selectors narrow
- **CSS nesting** for modularity — keep shallow, avoid specificity tunnels
- **Subgrid** when nested content must align to outer grid
- **View Transitions** for meaningful state continuity — respect `prefers-reduced-motion`
- **Modern units**: `dvh/svh/lvh` over `100vh`, logical properties over `left/right`
- **Tailwind v4**: CSS-first configuration, use theme variables over hardcoded values

### Build Tools

- **Vite 8** (verified 2026-07-02): Rolldown/Oxc is the integrated default bundler (`rolldown-vite` is only a Vite 7 migration bridge). Node 20.19+/22.12+; Baseline target Chrome/Edge 111, Firefox 114, Safari 16.4. Detect Vite 7 vs 8 before editing config.
- **Agent-visible runtime diagnostics (DEFAULT)**: prefer dev servers that surface browser/runtime errors to the CLI/agent — Vite 8 forwards browser console to the dev server (auto-activates for coding agents); Next 16 ships DevTools MCP. Wire these before debugging rendered behavior.
- Do not introduce Webpack-era config unless the existing app is already Webpack-bound

### State Classification

Before adding state, classify it:

| State type | Owner | Default tool |
|---|---|---|
| render-local UI | nearest component | `useState` / `useReducer` |
| derived | render calculation | expression / `useMemo` if expensive |
| form draft | form boundary | native form, React Hook Form, TanStack Form |
| server/cache | server/cache layer | RSC, Next cache, TanStack Query, SWR |
| URL/navigation | router | path params, search params |
| global client UI | external store | Zustand, Jotai, context |
| optimistic mutation | mutation boundary | `useOptimistic`, mutation library |
| AI stream | conversation boundary | append-only message model + stream status |

Rules: Do not store derived state just to sync with Effect. Do not put server state in Zustand. Do not put URL-shareable state only in component state. Keep optimistic state reversible.

### Design System Detection (MANDATORY — before creating tokens)

Before inventing design tokens, check:
1. Does the project have an installed design system? (`grep -r "material-ui\|@mui\|carbon-components\|@carbon\|@fluentui\|govuk-frontend\|uswds" package.json`)
2. Does the project have existing tokens? (`find . -name "tokens.*" -o -name "theme.*" -o -name "design-system*"`)
3. Does the brief name a specific design system?

If YES to any: use the official package. Do not recreate CSS by hand.

| System | Package | Import |
|--------|---------|--------|
| Material | @mui/material | `import { Button } from '@mui/material'` |
| Carbon | @carbon/react | `import { Button } from '@carbon/react'` |
| Fluent | @fluentui/react | `import { Button } from '@fluentui/react-components'` |
| GOV.UK | govuk-frontend | `import 'govuk-frontend/dist/govuk/all.scss'` |
| USWDS | @uswds/uswds | `import '@uswds/uswds/css/uswds.css'` |

If NO: proceed with `ima2-uiux/references/design-system-bootstrap.md`.

### shadcn/ui and AI-Assisted UI

- Inspect existing installed components before adding new ones
- Use project's `components.json`, aliases, tokens, and registry conventions
- Do not hallucinate design-system components; verify against local source
- Remove demo-only copy and unused variants

For AI-native interfaces (chat, agent, copilot), design explicit states: empty → prompt ready → submitted → streaming → tool call → result → complete → feedback. Never fake streaming, citations, or tool calls.

---

## 13. Error Boundaries

React Error Boundary pattern:
- Wrap each major section (not the entire app) in an Error Boundary
- Error boundary renders: friendly message + retry button + report link
- Log error to monitoring service (Sentry, etc.) in componentDidCatch
- Never show stack traces to end users

Error state hierarchy:
1. Field-level: inline validation message
2. Form-level: summary at top of form
3. Section-level: Error Boundary with retry
4. Page-level: `error.tsx` / error page
5. App-level: root Error Boundary → offline/crash page

---

## 14. Pre-Flight Checklist

Checklist items apply to production surfaces (the work classifier shared definition); prototypes,
spikes, and internal demos are exempt unless the user asks for production polish.

Before delivering:
- [ ] Domain-correct direction chosen and committed
- [ ] Product surface, locale, density, asset need, soft 3D gate, and motion intensity classified
- [ ] Anti-slop patterns enforced (§5)
- [ ] Hero discipline enforced: viewport fit, copy count, no in-hero trust/pricing/feature clutter (§5)
- [ ] Required assets are real, semantic, rendered, and not generic decoration
- [ ] Korean-first UI follows CJK typography and Korean UX writing rules
- [ ] Soft 3D/miniature/character assets pass domain and semantic gates
- [ ] Mobile layout collapse guaranteed with per-section-type rules (see layout-discipline.md § Responsive Transforms)
- [ ] Full-height sections use `min-h-[100dvh]` not `h-screen`
- [ ] Page containment: `max-w-[1400px] mx-auto` wrapper present (see responsive-viewport.md)
- [ ] Tested at 768px (tablet) and 1024px (split-screen) in addition to mobile/desktop
- [ ] Touch targets ≥ 44px on mobile; no hover-only interactions (see mobile-ux.md)
- [ ] Responsive images use `srcset`/`sizes` or `<picture>` for art direction (see responsive-viewport.md)
- [ ] Safe area padding for notched devices: `env(safe-area-inset-*)` on fixed elements
- [ ] Loading, empty, and error states provided
- [ ] State classified before adding store/Context/Effect/cache (§12)
- [ ] Effects sync with external systems; derived state is not Effect-synced
- [ ] Container queries considered before viewport-query or JS layout workarounds
- [ ] View transitions respect reduced motion
- [ ] shadcn components follow local registry and token conventions
- [ ] AI UI states are honest: no fake streaming, citations, or tool calls
- [ ] Forms validate with schema and show field-level errors (§10)
- [ ] A11y polish checked: one-line CTAs, visible input borders, no duplicate CTA intent (§7)
- [ ] Focus management on modals and popovers (§11)
- [ ] Desktop/mobile/narrow screenshots checked for overlap, clipping, and asset rendering
- [ ] Interactive components isolated as Client Components (if RSC)
- [ ] Design Read declared before code generation (see ima2-uiux §2)
- [ ] Eyebrow count ≤ ceil(sectionCount / 3) (see layout-discipline.md)
- [ ] Section layout diversity: ≥4 different families per 8 sections
- [ ] Color/shape/theme locks consistent across all sections (see consistency-locks.md)
- [ ] SEO meta tags present for public pages (`<title>`, `<meta description>`, canonical, OG) — see `seo-baseline.md`
- [ ] JSON-LD structured data matches page type
- [ ] Accessibility: modals trap focus, live regions for dynamic content — see `a11y-patterns.md`
- [ ] Core Web Vitals field metrics are the perf gate (INP ≤200ms); Lighthouse Performance score is advisory smoke only; no JS bundle > 150KB compressed — see `performance-budget.md`
- [ ] Hero image preloaded, below-fold images lazy-loaded
- [ ] Theme toggle works: light/dark/system, no FOWT — see `theme-switching.md`
- [ ] All colors use CSS custom properties (theme-ready)
- [ ] i18n: no hardcoded strings, CSS logical properties, Intl API for dates/numbers — see `i18n-global.md`
- [ ] Error Boundaries wrap major sections, not entire app (§13)
- [ ] Stack-specific rules followed (see `references/stacks/`)

---

## 15. Backend Contract & Security Alignment

Frontend does not operate in isolation. When consuming backend APIs or implementing security-sensitive UI:

### 15.1 Contract Ownership

| Responsibility | Owner |
|---------------|-------|
| Response envelope shape (`success`, `data`, `error`, `meta`) | `dev-backend` defines, `dev-testing` verifies |
| Consumer-side fixture alignment | **Frontend** — keep mocks in sync with `fixtures/contracts/` |
| Contract test triggers | Frontend payload changes → update contract tests BEFORE merging (see `dev-testing` §3) |
| Error display mapping | Frontend maps `error.code` to user-facing messages; never parse `error.message` for logic |

**When a frontend change touches API consumption:**
1. Check if the response shape assumption still holds
2. If changed, update or add a contract test first (see `dev-testing` §3.5)
3. Align frontend mocks/fixtures with backend golden examples

### 15.2 Security Responsibilities

| Control | Policy Owner | Implementation Owner |
|---------|-------------|---------------------|
| CSP directives | `dev-security` §5 | Frontend (no inline scripts, no `eval`, no surprise 3rd-party scripts) |
| CORS | `dev-security` §5 | Backend middleware (`dev-backend` §4) |
| XSS prevention | `dev-security` §5 | Frontend (avoid `dangerouslySetInnerHTML`; if needed, sanitize with DOMPurify + CSP defense) |
| Token storage | `dev-security` §2 | Frontend (`httpOnly` cookies preferred over `localStorage`) |
| Auth state display | `dev-security` §2 | Frontend (loading → check → redirect or render; never flash protected content) |

### 15.3 Testing Integration

- Playwright smoke tests validate rendered flows AFTER backend API + contract tests pass
- Frontend unit tests mock API responses using the **same envelope shape** defined in `dev-backend` §5
- When backend error codes change, frontend error-mapping tests must be updated

## §16 Pre-Flight Checklist

Before shipping a production frontend surface, run through the full pre-flight checklist
at `references/preflight-full.md`. It covers design/composition, responsive/mobile,
states/behavior, Korean-first rules, SEO/theme/i18n, and performance/verification gates.
Use it as the C-phase audit companion for frontend work at C2+.
