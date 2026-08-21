---
name: ima2-uiux
description: "Design direction discovery and UX judgment for ima2 users. Use for UI/UX direction and design judgment — vague visual briefs, onboarding, empty/error/loading states, layout vocabulary, typography breaks, favicons, logos, and brand identity choices. Pairs with ima2-front: this skill decides the design direction, then load ima2-front to implement it. Triggers: make it look good, modern, clean, aesthetic, onboarding, empty state, error state, favicon, logo, design system, 깔끔하게, 모던하게, 감성적으로."
metadata:
  last-verified: "2026-07-14"
  short-description: "ima2-powered design judgment for vague briefs, UX states, typography, layout patterns, logos, and brand vocabulary."
---

# ima2 UI/UX: Intent Discovery, Patterns & Product Vocabulary

## Setup

```bash
npm install -g ima2-gen    # install globally (Node.js >= 20)
ima2 setup                 # first-time auth (GPT OAuth recommended)
ima2 serve                 # start local server
ima2 ping                  # verify
ima2 status                # config and OAuth status
```

**Agent bootstrap:** `ima2 ping` first. If unreachable: `ima2 serve &`. If not
installed: `npm install -g ima2-gen && ima2 setup`. Use `ima2 skill path` to
locate skills; read `../ima2-uiux/SKILL.md` (this file) for design direction,
`../ima2-front/SKILL.md` for implementation assets.

Activates by change surface when:
- User's design direction is vague ("깔끔하게", "모던하게", "just make it look good")
- Building onboarding, empty state, error state, or loading state UI
- User references a product aesthetic ("Notion 느낌", "Linear처럼")
- Starting a new design system or generating a color palette
- Choosing layout patterns or navigation architecture
- Setting up favicons, product logos, or brand identity elements
- Handling logo dark mode variants, OG images, or social sharing meta

Read this before style-specific references when the user cannot articulate a clear design direction.
For anti-slop detection and banned patterns, defer to `ima2 skill front ref anti-slop`, especially the 2026 gradient budget and one-note theme bans.

**Emoji ban (stub):** no emoji as UI visual elements (STRICT). Canonical rule, scope, and exemptions: `ima2-front` §5 / `ima2 skill front ref anti-slop` § Emoji Slop.

**Role separation:** This skill owns design judgment: intent discovery, information architecture, UX state meaning, typography/color/layout direction, product personality, brand vocabulary, anti-slop pattern judgment, and design-system decisions. `ima2-front` owns implementation: HTML/CSS/components, responsive mechanics, accessibility wiring, runtime behavior, and rendered verification. After choosing the design direction here, load `ima2-front` for concrete implementation.

**External/current design evidence:** For live product-reference claims, current
design-system docs, browser API behavior, accessibility guidance that may have
changed, or browser-rendered source evidence, search the web and
follow its query-rewrite, source-fetch, and evidence-status rules. Use browser
fetch/open/text/get-dom/snapshot only after candidate URLs exist.

> **C0/C1 work (small local patches):** For small patches, skip the full reference chain.

> **Rule class note (UX-STYLE-01):** Everything in this skill that expresses taste —
> product personalities, design-isms, preset tokens, aesthetic vocabulary — is
> `STYLE_SAMPLE`: examples to draw from, never universal requirements. Objective UX
> correctness (state coverage, accessibility, readability) is owned by `ima2-front`
> §1.5 and stays STRICT/DEFAULT.

## Modular References

> **Recommended: install skills to your agent's skill directory.**
> ```bash
> ima2 skill install --dir <agent-skill-path>   # agent provides its own path
> ima2 skill install --tmp                       # ephemeral fallback
> ```
> The agent determines its own skill directory and passes it via `--dir`.
> After install, SKILL.md and `references/` are on disk for native reading.
>
> **Ad-hoc reading (without install):**
> ```bash
> ima2 skill uiux refs              # list all reference modules with line counts
> ima2 skill uiux ref design-isms   # print one module (basename match)
> ```

| File | When to Read | What It Covers |
|------|-------------|----------------|
| `references/design-isms.md` | User names a style/movement | 16 design movements with CSS signatures, incl. Liquid Glass + Liquid Editorial default kit (2025-2026) + AI Serif Editorial + Organic Capsule (verified 2026-07-09) |
| `references/design-award-sources.md` | Looking for real-world design references | Tiered sourcing guide: award and gallery sites, what each is best for, and how to search |
| `references/compositional-patterns.md` | Composing hero, navigation, motion, or content structure | Canonical compositional patterns from award research with responsive and accessibility gates |
| `references/design-trends.md` | Checking dated prevalence, emerging techniques, or promotion status | 2026-07-14 axis-frequency snapshot, technique signals, signature ledger, and re-crawl protocol |
| `references/design-read-example.md` | Learning or reviewing Design Read format | Filled-in Design Read + dial setting example |
| `references/product-personalities.md` | User references a product | 10 product DNA profiles with exact tokens, incl. 2026 AI-product pastel + OpenAI warm-sans organic + Anthropic serif bookish |
| `references/layout-macrostructures.md` | Choosing page/component layout | Component layouts + page-level compositions |
| `references/ux-states.md` | Building any stateful UI | Onboarding, empty, error, loading, progressive disclosure |
| `references/color-system.md` | Generating colors/palette | OKLCH-based palette generation, hue budget, tinted neutrals, dark mode, accessibility |
| `references/design-system-bootstrap.md` | New project / design system | Token architecture, component hierarchy, **DESIGN.md format** (google-labs-code/design.md) |
| `references/responsive-nav.md` | Responsive or navigation work | Breakpoints, container queries, nav patterns by density |
| `references/ux-preflight.md` | **Before delivery** | UX state verification checklist |
| `references/typography-line-breaks.md` | **Always for text-heavy UI** | Heading break quality, **short descriptor category** (hero subtitle, card desc — use `balance` not `pretty`), orphan prevention, `ch` units, Korean orphan criteria, `-webkit-line-clamp` conflict |
| `references/favicon-logo.md` | **Favicon, product logo, or brand identity work** | Favicon file set, SVG dark mode, logo in nav/footer, dark mode variants, OG images, brand tokens, common mistakes |
| `references/logo-trust-sections.md` | Integration/partner/client logos | Marquee vs grid decision, anti-patterns, grayscale treatment, placement |
| `references/visual-hierarchy.md` | Any layout / composition decision | 6 levers: size scale, weight contrast, color emphasis, spacing, position, density |
| `references/form-patterns.md` | Forms, wizards, auth, file upload | Validation timing, multi-step, password UX, file upload, search/filter |
| `references/mobile-native-ux.md` | Native mobile app UX decisions | iOS HIG vs Material 3, gestures, deep linking, Korean privacy, app store UX |
| `references/intent-discovery-ladder.md` | UX-INTENT-01 optional deepening (Steps 1-6) | Mood/lightness/density/shape/viewport/reference ladder, vague request disambiguation |
| `references/korean-design-vocabulary.md` | Korean design briefs or Korean-first UI | Korean descriptor → CSS token translation, quick-match table, font selection guidelines |

---

## Lazy-User Gate (UX-LAZY-01, DEFAULT — ponytail discipline applied to UX)

Design for the cognitively frugal user: users don't read, they scan; they satisfice;
they will trade choice for one obvious next action. Before shipping any user-facing
decision point — option, setting, step, confirmation, input field, mode — justify its
existence the ponytail way, in order:

1. **Do nothing**: can a correct default remove this decision entirely?
2. **Delete**: does the step/field earn its completion-rate cost (Hick's law)?
3. **Absorb**: can the system take the complexity instead of the user (Tesler's law)?
4. **Demote**: still needed for some users → progressive disclosure, never a top-level fork.

Every screen has ONE primary action. Surface-conditional: consumer/one-shot flows
minimize DECISIONS; repeated-work tools (dense profiles) minimize repeated MOTIONS —
collapsing expert controls into wizards is the inverse failure. STRICT exemptions:
destructive/irreversible actions, consent/privacy/legal, payments confirmation, and
accessibility affordances are never collapsed into magic defaults.

## UX State Contract (UX-STATE-01)

For onboarding, empty, loading, error, or progressive-disclosure work, the body must answer the state meaning before styling. Deep patterns live in `references/ux-states.md`.

- Onboarding teaches the first meaningful action, not the whole product.
- Empty explains why the state exists and names the next action.
- Loading chooses skeleton for known structure, spinner/progress for short unknown waits, and avoids fake completion.
- Error exposes retry, recovery, or escalation; never dead-end the user.
- Progressive disclosure names what stays hidden, why it stays hidden, and where it becomes available.

## IA Chooser (UX-IA-01)

Default navigation architecture by work shape; read `references/responsive-nav.md` for responsive details.

| Work shape | Default IA |
|------------|------------|
| Dense desktop repeated work | Sidebar + command palette |
| Medium sectioned work | Tabs or segmented navigation |
| Mobile-primary consumer flow | Bottom nav, sheet, or thumb-zone actions |
| Wizard/auth/setup | Stepper or stacked linear flow |

## 1. User Intent Discovery Protocol

When the user's design request is vague ("깔끔하게 해줘", "모던하게", "just make it look good"), do not produce generic output. Run the compact ambiguity flow (UX-INTENT-01):
1. Produce the Design Read from §2 using available signals.
2. If one decision still blocks the direction, ask ONE best clarifying fork with binary/ternary choices.
3. Proceed from the answer; if the user does not answer and the task can continue, choose the most domain-correct default and state the assumption. On EXPRESSIVE surfaces (landing/consumer/creative/AI-product), that default is the No-Brief Default Direction below (UX-DEFAULT-ISM-01); quiet surfaces keep quiet domain-correct defaults.

> Skip this section if the user provided explicit design specs or this is a ≤5-line patch.

### No-Brief Default Direction (UX-DEFAULT-ISM-01, DEFAULT — kit content STYLE_SAMPLE)

This is the UX-INTENT-01 step-3 FALLBACK, never a bypass: it fires only after
the Design Read and after the one blocking fork is resolved or unanswered, and
the applied direction is ALWAYS stated as an explicit assumption in the
deliverable. A named, specific, domain-gated direction replaces generic LLM
defaults; it must NOT reintroduce generic glassmorphism / centered-card /
beige-default taste under a new label.

Default kit for expressive surfaces: **Liquid Editorial** (2026 composite,
decided 2026-07-07 from Tier-2 trend research — see `references/design-isms.md`
§1.14 for the full signature):

- Structure: type-led editorial composition (oversized authored headline
  scale, grotesk default, serif display only with editorial rationale per
  UX-TYPE-01), tactile/photographic texture over flat gradient washes,
  asymmetric content-weighted layout.
- Material accent: Liquid Glass or near-opaque pill chrome ONLY on floating
  functional layers (nav/toolbars/chip clusters); pill-chip content units;
  content layer stays solid (`ima2-front` FE-LIQUID-LAYER-01). Children
  inside pill chrome carry no capsule borders/outlines at rest — emphasis via
  fills/tints only (`ima2-front` FE-PILL-NEST-01); top-bar scroll states per
  `ima2-front/references/top-bar.md` FE-TOPBAR-STATE-01.
- Motion: feedback baseline + one signature moment (pointer-proximity chips or
  scroll-driven reveal) + >= 1 supporting scroll reveal on landing-bucket
  surfaces (floor 2, ceiling ~4 — `ima2-front/references/motion.md`
  FE-MOTION-BUCKET-01); feedback-only elsewhere, per motion domain gates.
- Color: OKLCH-derived single accent + tinted neutrals (hue budget,
  `references/color-system.md`).

Domain gate (STRICT): dashboards, admin, ops, finance, gov, B2B repeated-work
tools NEVER receive this kit by default — "fancy" never overrides domain
correctness (§ IA Chooser + `ima2-front` product-density profiles).

**Optional deepening:** use the ladder below only when the first fork fails or the user explicitly wants guided exploration.
- Use binary/ternary choices, not open-ended questions.
- Reference known products — users recognize what they want faster than they articulate it.
- If the diagram skill is available, offer: "참고로 스타일 비교를 다이어그램으로 보여드릴 수도 있어요."
- If the user names a specific product reference, skip remaining steps and map directly via `references/product-personalities.md`.

For the full 6-step guided ladder (Mood → Lightness → Density → Shape → Viewport →
Reference) and vague-request disambiguation table, read
`references/intent-discovery-ladder.md`. Load it only when the compact flow above
needs deeper guided exploration.

---

## 2. Design Read (MANDATORY for new pages, components, or layouts. Optional for ≤5-line patches — see dev §0.1 Patch Fast-Path.)

Before generating ANY frontend code, produce a Design Read. If the project has a `DESIGN.md` file, read it first — its tokens and prose override everything below.

Native tool support (structure/60): read visual references — existing screens, competitor
captures, design exports — into context with `view_image` before writing the Design Read;
produce needed bitmap assets (icons, illustrations, mock imagery) with `ima2` (probe
`ima2 status`, attempt `ima2 serve` if down; ima2 is the primary tool
only when ima2 is truly unavailable) rather than leaving placeholder boxes; and verify the built
result visually per visual verification (browser screenshot -> `view_image`).

### Output format (mini DESIGN.md)

Filled-in example: `references/design-read-example.md`.

```yaml
---
name: <project-name>
colors:
  primary: "<hex>"
  accent: "<hex>"
  background: "<hex>"
typography:
  heading: { fontFamily: <font>, fontSize: <size> }
  body: { fontFamily: <font>, fontSize: <size> }
---
```

Reading this as: <page kind> for <audience>, with a <vibe> language.
<1-2 sentences: specific reference, not adjectives. "1970s lecture handout" > "modern and clean">

Do's: <context-specific positive from brief>
Don'ts: <context-specific ban from brief>

### Signals to read
1. Page kind — landing (SaaS/consumer/agency/event), portfolio, redesign, editorial, app UI, tool UI
2. Vibe words — what the user said or implied
3. Reference signals — URLs, screenshots, brands named
4. Audience — B2B procurement vs design-conscious consumer vs recruiter
5. Existing brand assets — logo, color, type, photography
6. Quiet constraints — accessibility-first, public-sector, regulated, kids

### Dial Setting (MANDATORY — immediately after Design Read)

From the Design Read, derive and declare three dials before any code:

```
DESIGN_VARIANCE: <1-10>
MOTION_INTENSITY: <1-10>
Product density profile: <D1-D8> (see `ima2 skill front ref product-density`)
Reasoning: <one sentence explaining why these values match the brief>
```

Inference rules:
- Corporate/gov/utility → VARIANCE 2-4, MOTION 1-3, density D2-D3
- Marketing/landing → VARIANCE 4-7, MOTION 5-7 (scroll-motion floor applies, FE-MOTION-BUCKET-01), density D2-D3
- Creative/portfolio/editorial → VARIANCE 6-9, MOTION 5-7 (landing-bucket scroll floor applies, FE-MOTION-BUCKET-01), density D1-D3
- Dashboard/SaaS/admin → VARIANCE 2-4, MOTION 1-2 (scroll-driven = 0), density D4-D5
- "Complex" in brief → increase density profile (functional depth), NOT VARIANCE or MOTION
- "Simple" in brief → decrease all three proportionally

"복잡하다" = high DESIGN_VARIANCE is WRONG. Complexity means more features/data/flows, not more visual tricks (carousels, parallax, animations).

### Anti-Default Discipline
Do not default to: warm beige backgrounds, centered hero, three equal feature cards, generic glassmorphism, Inter + slate-900, card-based everything. These are LLM defaults. Reach past them BASED ON the design read.
When no brief exists at all, the sanctioned replacement for these generic
defaults is the named kit in §1 UX-DEFAULT-ISM-01 — deliberate, domain-gated,
and stated as an assumption; it is not an exemption from this discipline.

If the brief is ambiguous, follow UX-INTENT-01: Design Read → ONE clarifying fork → proceed.

### DESIGN.md persistence
If the project needs persistent design tokens across sessions, save the Design Read as a full `DESIGN.md` in the project root. Format spec: `references/design-system-bootstrap.md § DESIGN.md Format`.

---

## 2.5 Visual Concept Exploration (UX-CONCEPT-GEN-01, DEFAULT)

Before implementing a C2+ NEW/redesigned expressive or brand-visible UI surface
(landing page, hero, key chrome such as a top bar, or major visual redesign),
generate visual concept candidates BEFORE frontend code. C0/C1 patches and
utility CRUD/dashboard screens are exempt.

0. **Probe, start, then choose the generator.** Run `ima2 status` first. If the
   server is down, attempt `ima2 serve` in the background, then re-run
   `ima2 status`, then inspect `ima2 models --kind image` and configure
   `ima2 defaults set image <lane>/<model>` before a bare CLI generation.
   Use the native image generator only when `ima2` is truly unavailable after
   that serve attempt. State the chosen
   generator in the deliverable; if generation is skipped, state the exact skip
   reason and persist it in the devlog.
0.5. **If the ism/direction is unclear, go IMAGE-FIRST (UX-IMAGE-FIRST-01, DEFAULT).**
   When the user's brief does not name a specific ism, product reference, or
   design direction — "make me a website for X", "landing page for Y",
   vague aesthetic words without concrete reference — do NOT guess a direction
   from text alone. Instead, let generated images DISCOVER the direction:

   **Round 1 — Ism exploration (5 images, broad).** Write 5 maximally detailed
   prompts, each expressing a DIFFERENT plausible ism/direction for the brief.
   Vary: layout family (editorial vs product-led vs bento vs asymmetric), palette
   temperature (warm vs cool vs monochrome), typography stance (serif editorial vs
   grotesk minimal vs geometric bold), material (glass vs matte vs textured), and
   hero grammar (full-bleed photo vs device mockup vs type-only). Every prompt must
   be detailed enough that a reader can reconstruct the layout — pin domain, audience,
   specific hex palette, font direction, hero composition, section hint, and density.
   Vague prompts ("modern clean landing page") are banned.

   ```bash
   # Launch 5 different ism directions in parallel
   ima2 gen "Use case: landing page. Editorial serif direction. Full-bleed hero with \
     oversized light-weight serif headline 'Artisan Coffee', warm stone palette \
     #f5f0eb/#2c2420/#c4956a, asymmetric layout, editorial photography of pour-over \
     coffee, generous whitespace, matte paper texture at 3% opacity. No icons, no \
     cards. Dense footer with serif nav." --model oauth/luna --quality high --size 1536x1024 \
     -o ./concepts/01_editorial_serif.png &
   ima2 gen "Use case: landing page. Geometric grotesk direction. ..." \
     --model oauth/luna -o ./concepts/02_geometric_grotesk.png &
   ima2 gen "Use case: landing page. Product-led device mockup direction. ..." \
     --model oauth/luna -o ./concepts/03_product_mockup.png &
   ima2 gen "Use case: landing page. Dark premium minimal direction. ..." \
     --model oauth/luna -o ./concepts/04_dark_premium.png &
   ima2 gen "Use case: landing page. Warm organic capsule direction. ..." \
     --model oauth/luna -o ./concepts/05_warm_capsule.png &
   ima2 ps --json   # monitor all 5
   wait
   ```
   ```bash
   # Round 1: 5 ism directions in parallel (each prompt must be maximally detailed)
   ima2 gen "Use case: landing page. Editorial serif direction. Full-bleed hero, \
     oversized light-weight serif 'Artisan Coffee', warm stone #f5f0eb/#2c2420, \
     asymmetric layout, editorial pour-over photo, matte paper 3%." \
     --model oauth/luna --quality high --size 1536x1024 -o ./concepts/01_editorial.png &
   ima2 gen "Use case: landing page. Geometric grotesk direction. ..." --model oauth/luna -o ./concepts/02_grotesk.png &
   ima2 gen "Use case: landing page. Product-led mockup direction. ..." --model oauth/luna -o ./concepts/03_product.png &
   # ... (2 more ism directions)
   ima2 ps --json  # monitor
   wait
   ```
   Inspect all 5 with `view_image`. Build a quick-scorecard (which ism has the
   strongest: hero composition, palette coherence, typographic voice, density fit
   for the domain). Pick the WINNING ISM — not the winning image.

   **Round 2 — Ism refinement (3-4 images, focused).** Lock the chosen ism.
   Write 3-4 new prompts that all express THIS ism but vary execution details:
   accent color temperature, hero image subject, section layout hints, CTA
   treatment, stat/proof-bar placement. Use `--ref` with the best Round 1 image
   as a style anchor.

   ```bash
   # Round 2: 3-4 refinements of the winning ism, anchored to Round 1 best
   ima2 gen "Same editorial direction. Vary: latte art hero, accent #b8860b gold, \
     proof bar below fold." --model oauth/luna --ref ./concepts/01_editorial.png --quality high -o ./concepts/06_a.png &
   ima2 gen "Same direction. Vary: weight 300 headline, ..." --model oauth/luna --ref ./concepts/01_editorial.png -o ./concepts/07_b.png &
   # ... (1-2 more refinement variations)
   wait
   ```

   Synthesize Round 2 into the element ledger (step 3 below). Lock DESIGN.md.

   **`ima2 gen` fallback:** generate 2-3 ism candidates sequentially (one per
   call), inspect each with `view_image`, pick the ism, then generate 2 refinement
   candidates sequentially. Slower but the same two-round logic applies.

   **Auto loop (HOTL) behavior:** this entire 0.5 step runs autonomously when a
   goal is active. The agent picks the ism from Round 1 with stated reasoning
   (recorded in devlog), then proceeds to Round 2 and step 3 synthesis without
   user confirmation. The ism choice rationale is persisted so the user can
   review it post-hoc.

   Skip step 0.5 when: the user named a specific ism ("Notion feel", "Linear style",
   a product reference mapped via `references/product-personalities.md`), the user
   provided a reference screenshot or design file, or UX-INTENT-01 already resolved
   the direction to a concrete ism.

1. **Lock ONE concept, write maximally specific prompts for it.** Decide the
   single design concept first (domain, audience, palette family, hero/chrome
   grammar, density, signature visual). Page-level surfaces get 5 prompts that
   all express that SAME concept but vary the execution: emphasis points, fine
   layout choices, accent treatment, type nuance, secondary-section hints.
   Component-level surfaces get about 3 prompts that render the component INSIDE
   its top-viewport context (for example top bar plus hero together), never as
   an isolated component strip. Reference captures collected to ground mockups
   are generation inputs (`--ref`), not skip reasons. Each prompt still pins:
   domain + audience, layout family and hero/chrome grammar (FE-HERO-SPLIT-01
   applies -- no split hero unless the user asked), palette with concrete hues
   (color-system bans apply), typography direction, material, motion/asset
   intent, and density. Vague prompts ("modern clean landing page") are banned:
  a reader must be able to reconstruct the layout from the prompt alone.
2. **Generate into the active devlog unit assets directory.** For page-level
   surfaces, keep the 5-render process: run `ima2 gen <prompt> --model <lane>/<model> -n 1 -o <path>`
   five times concurrently (or `ima2 gen <prompt> --model <lane>/<model> -n 5 -d <dir>` for a single
   request) and monitor with `ima2 ps --json`. For component-level surfaces,
   generate about 3 context-strip renders of the component within its top
   viewport context. If the mockup needs motion material, use `ima2 video`.
   Asset prompts inside mockups/builds should be VERY EXPLICIT LONG prompts;
   prefer real/generated photographic, texture, illustration, or motion assets
   over CSS gradient washes.
   **Parallel strategy selection** (see `ima2 skill front ref asset-requirements`
   FE-ASSET-PARALLEL-01): for the 5-render process, prefer `ima2 gen -n 5 -d <dir>`
   (single-request batch) when all 5 share the same locked concept prompt. Use
   `ima2 multimode "<prompt>" --max-images 5` when you want SSE streaming to inspect
   candidates as they arrive and cancel early if a strong candidate lands. For
   structurally different concept directions (e.g. 3 editorial + 2 product-led),
   launch independent `ima2 gen` commands in parallel and monitor with `ima2 ps --json`.
   Cancel unwanted jobs with `ima2 cancel <requestId>` once a strong direction emerges.
   **`ima2 gen` fallback**: generate candidates sequentially (one per call), inspect
   each with `view_image` before the next. No multimode or parallel equivalent;
   compensate with more targeted prompt refinement between rounds.
3. **Read the renders side by side and SYNTHESIZE -- do not pick one winner.**
   Each render usually nails some elements and fumbles others. The output is not
   "which variant is best"; it is "which elements are best across all of them."
   For pages, build an element ledger for palette, hero composition, type
   treatment, signature visual, stat row, bottom-section hint, and every other
   design token. For components, shrink the ledger to the component tokens:
   material, radius, fills, type, icon/logo treatment, state treatment, and
   immediate context fit. For every token, note WHICH variant did it best and
   WHY. Show the user the images (markdown image tags with absolute paths) with
   the synthesis ledger and let them confirm/adjust the per-token picks; in
   autonomous/goal mode make the picks with stated reasoning and record it.
   Use the selection scorecard from `ima2-front/references/asset-requirements.md` FE-ASSET-SELECT-01
   (subject fidelity, composition, palette, text render, asset-type fit,
   technical quality) as a structured rubric for per-token evaluation.
4. **Make the SYNTHESIZED DESIGN.md the Design Read basis.** Extract palette,
   layout family, type direction, material, asset/motion intent, and every other
   token from the element ledger into DESIGN.md, with each token citing its
   source variant. Never pixel-copy any single render (generated text/logos are
   unreliable) -- the synthesis is a direction lock assembled from the best
   parts, not one asset. A mockup is not render verification; visual verification
   remains owned by `ima2-front/references/visual-verification.md`.

Precedence: UX-CONCEPT-GEN-01 governs the PRE-CODE concept stage. After code
exists, `ima2-front/references/iterative-design.md` Alive/Dead governs POST-CODE iteration rounds.
When structural variants are still needed, `ima2-front/references/prototype-variants.md` runs AFTER
the concept lock.

Skip (state the skip): user handed a FINISHED design to implement; an existing
design system governs the surface; the work is a C0/C1 patch; the surface is a
utility CRUD/dashboard screen; or `ima2` is truly unavailable after `ima2 status`,
an attempted `ima2 serve`, and a failed re-check, with `ima2 gen` also
unavailable or inappropriate. Captured/collected reference material to ground
mockups is NOT a skip; it becomes generation input via `--ref`.
---

## 2.6 Asset Generation Templates for Concept Passes (UX-ASSET-GEN-01, DEFAULT)

When concept exploration (UX-CONCEPT-GEN-01) or image-first ism discovery
(UX-IMAGE-FIRST-01) generates component/element mockups that need to float
over arbitrary backgrounds — icons, 3D objects, product shots, stickers,
UI chrome elements — use the cutout asset pipeline. GPT Image 2 CAN produce
real transparent backgrounds: pass `--bg transparent` and the asset comes back
as an RGBA PNG, no keying pass required.

```bash
ima2 gen "3D render of [subject], [material], [composition]" \
  --bg transparent --quality high --mode direct -o concept-01.png
```

Fall back to solid-bg-then-remove when you need a matte for a chroma-key
pipeline, or when a subject refuses to isolate cleanly.

**Cutout asset prompt template (concept pass):**

```bash
# Reflective/metallic/glass → PURE BLACK bg
ima2 gen "3D render of [subject], [material], [composition]. \
  Floating on a PURE SOLID BLACK background hex #000000. \
  No checkerboard, no transparency pattern, no gradient, \
  no floor plane, no shadow, no vignette, no ambient glow." \
  --model oauth/luna --quality high --size 1024x1024 --mode direct -o concept-asset.png

# Dark/matte subjects → PURE WHITE bg
ima2 gen "[subject], centered, floating. PURE SOLID WHITE background \
  hex #ffffff. No shadow, no gradient, no surface." \
  --model oauth/luna --quality high --size 1024x1024 --mode direct -o concept-asset.png

# Known destination color → match it
ima2 gen "[subject], centered. PURE SOLID background hex #[target]. \
  No gradient, no texture, no shadow." \
  --model oauth/luna --quality medium --size 512x512 --mode direct -o concept-asset.png
```

**CSS removal (zero post-processing):**
- Black bg on light page: `mix-blend-mode: screen`
- White bg on dark page: `mix-blend-mode: multiply`
- Wrap in `isolation: isolate` container to prevent bleed
- Programmatic: `sharp`, ImageMagick, `rembg`. Interactive: ima2 Canvas Mode.

**Anti-pattern:** hand-writing "transparent background" or "PNG with alpha"
into the prompt WITHOUT `--bg transparent` — bare wording can bake a fake
checkerboard into an opaque image. Verify alpha (`channels: 4`) rather than
trusting the preview.

Full pipeline reference: `ima2-front/references/asset-requirements.md`
§ Asset Background Strategy (FE-ASSET-BG-01).

## 3. Korean Design Vocabulary + Quick-Match + Font Selection

Korean descriptor → CSS token translation, quick-match table (user word → starting
point), clarifying questions per term, and font selection guidelines (UX-TYPE-01,
Pretendard for Korean-first, Inter avoidance) are extracted to
`references/korean-design-vocabulary.md`. Read it when the brief uses Korean
aesthetic words or when choosing fonts for Korean-first UI.
