# 040 — Packaged skill, README, site, and SoT upgrade (wp5)

## Loop specification

- Loop archetype: spec-satisfaction.
- Goal: make the three coordinated studio features discoverable and accurate across
  the packaged agent skill, frontend asset guidance, README, English/Korean Astro docs,
  and code-owned structure documents.
- Non-goals: translating the entire README/site into new languages, rewriting generic
  UI/UX design doctrine, changing production behavior, regenerating MCP catalog prose,
  or documenting an implementation contract that wp2-wp4 did not actually land.
- Verifier: docs source contracts, generated-skill determinism, packaged `ima2 skill`
  output, Astro check/build, devlog citation check, and the parent repository gates.
- Stop condition: vectorize CLI/route/Assets/AssetGen/Canvas coverage, NovelAI positive
  plus negative panes, and Prompt Builder backend selection/resolution are each
  findable from README, core skill, and both site languages; structure SoT matches code.
- Escalation: wp3 has fixed `promptBuilder.backend` / `promptBuilder.model`, the backend
  enum `auto | oauth | api | grok | grok-api`, and `GET/PUT
  /api/prompt-builder/config`. If implementation diverges from that approved diff,
  amend this document before wp5 rather than publishing stale names. Locale scope is
  the four runtime locales (000_plan.md "Locale correction"); Japanese is a non-goal.

This is a docs-only wp1 artifact. wp5 executes the diffs only after wp2-wp4 land, then
re-reads the final code and confirms the planned backend identifiers match the landed
symbols. Dependency order is defined at
`devlog/_plan/260902_studio_surfaces/000_plan.md:132-144`.

## 1. Audit method and product truth

### 1.1 Shipped vectorize truth

- Local CLI: `bin/commands/vectorize.ts`; the package skill already documents its full
  workflow at `skills/ima2/SKILL.md:390-425`.
- Server: `POST /api/assets/derived?kind=vector-svg`, already documented in
  `structure/03-server-api.md:189-201`.
- GUI: existing `VectorizePanel` is mounted in AssetGen and Assets
  (`ui/src/components/assetgen/AssetGenWorkspace.tsx:278-280`,
  `ui/src/components/assets/AssetsWorkspace.tsx:149-152`).
- Planned Canvas entry: `devlog/_plan/260902_studio_surfaces/030_canvas_vectorize.md`.
- Important distinction: Canvas's current `svg` embeds a raster
  (`ui/src/lib/canvas/svgExport.ts:107-129`); vectorize emits real paths.

### 1.2 NovelAI dual-prompt truth

- Current core skill documents `--nai-negative-prompt` and provider-native controls
  (`skills/ima2/SKILL.md:103-173`).
- Current README says the browser and CLI expose negative prompt
  (`README.md:153-160`) but does not explain the UI shape.
- Current frontend SoT describes a single `NegativePromptField`
  (`structure/04-frontend-architecture.md:66-68`).
- Planned behavior from wp2: when provider is `nai`, Classic, Home, and mobile compose
  surfaces show positive and negative prompt panes of comparable weight; non-NAI keeps
  the normal single prompt. The final docs must cite the landed component names from
  `010_nai_dual_prompt.md`, not this summary.

### 1.3 Prompt Builder backend truth

- Today `lib/promptBuilder/client.ts:21-51` always waits for and calls the OAuth proxy.
- Today the UI model menu is GPT-only
  (`ui/src/components/prompt-builder/PromptBuilderModelMenu.tsx:5-20`).
- README and site incorrectly present `gpt-5.6-luna` as the unconditional Prompt
  Builder default (`README.md:173-179`,
  `site/src/pages/docs/concepts/providers.astro:52-64`, and
  `site/src/pages/ko/docs/concepts/providers.astro:52-64`).
- wp3 will add a settings-level backend choice, persisted config, server routing, an
  explicit `auto` fallback, and a visible answering-backend badge. The wording below
  deliberately explains selection semantics without promising a backend whose adapter
  does not land.

## 2. Coverage audit

Legend: Complete = currently sufficient; Partial = feature exists but one of the three
requested surfaces is missing; Missing = no useful coverage; N/A = wrong document owner.

| File/surface | Vectorize | NAI dual prompt | Builder backend | Decision |
|---|---|---|---|---|
| `skills/ima2/SKILL.md` | Partial: CLI + AssetGen/Assets, no Canvas (`skills/ima2/SKILL.md:390-425`) | Partial: CLI negative option, no two-pane GUI (`skills/ima2/SKILL.md:123-153`) | Missing | MODIFY |
| `skills/ima2-front/SKILL.md` | Missing; only generic brand SVG language (`skills/ima2-front/SKILL.md:219-230`) | Missing | Names Prompt Builder but not backend semantics (`skills/ima2-front/SKILL.md:229`) | MODIFY concise routing sentence |
| `skills/ima2-front/references/asset-requirements.md` | Missing real-vector production step (`skills/ima2-front/references/asset-requirements.md:29-46`) | N/A | N/A | MODIFY with raster/vector boundary |
| `skills/ima2-uiux/SKILL.md` | N/A | N/A | N/A | NO CHANGE: role separation says runtime implementation belongs to Front (`skills/ima2-uiux/SKILL.md:35-40`) |
| `README.md` What It Does | Missing | Missing two-pane behavior | Missing | MODIFY |
| `README.md` Workflows | Canvas export is generic (`README.md:209-223`) | Missing | Settings generic (`README.md:237-244`) | MODIFY |
| `README.md` CLI Commands | `vectorize` and `prompt build` omitted (`README.md:262-280`) | Native NAI flags omitted from summary | Missing | MODIFY |
| `README.md` Configuration | N/A | NAI env covered (`README.md:321-324`) | Missing | MODIFY |
| `README.md` API Reference | Links only (`README.md:351-365`) | Links only | Links only | MODIFY one capability pointer, keep full schemas in API docs |
| `site/src/pages/docs/index.astro` + Korean | Missing all three in overview (`site/src/pages/docs/index.astro:44-54`) | Missing | Missing | MODIFY |
| `site/src/pages/**/quickstart.astro` | N/A for an install-only page (`site/src/pages/docs/quickstart.astro:15-69`) | N/A | N/A | NO CHANGE |
| `site/src/pages/**/concepts/modes.astro` | Canvas lacks trace (`site/src/pages/docs/concepts/modes.astro:40-46`) | Classic lacks NAI panes (`site/src/pages/docs/concepts/modes.astro:18-23`) | Prompt Builder mode absent | MODIFY |
| `site/src/pages/**/concepts/providers.astro` | N/A | NovelAI lane absent entirely (`site/src/pages/docs/concepts/providers.astro:22-32`) | Hardcoded GPT claim | MODIFY |
| `site/src/pages/**/concepts/architecture.astro` | Module-level only | Module-level only | Prompt Builder route already named (`site/src/pages/docs/concepts/architecture.astro:39-47`) | NO CHANGE; structure SoT owns detailed topology |
| `site/src/pages/**/reference/cli.astro` | Missing local command (`site/src/pages/docs/reference/cli.astro:40-75`) | Missing NAI flags in summary | `prompt build` only a footer mention (`site/src/pages/docs/reference/cli.astro:160-164`) | MODIFY |
| `site/src/pages/**/reference/config.astro` | N/A | NAI env vars missing | Missing | MODIFY |
| `site/src/pages/**/reference/api.astro` | Derived route missing (`site/src/pages/docs/reference/api.astro:88-96`) | NAI request fields missing | Route row too shallow (`site/src/pages/docs/reference/api.astro:114-130`) | MODIFY |
| Astro content collections | None exist; `site/src` contains direct `.astro` pages only | — | — | NO CHANGE |
| `structure/00-07` | Core/CLI/route mostly current; frontend Canvas entry missing | Backend/options current; dual UI missing | Route exists but routing/config ownership missing | MODIFY owners listed in §7 |

## 3. Packaged skills — diff-level changes

### 3.1 MODIFY `skills/ima2/SKILL.md`

#### A. NovelAI UI wording

Insert after the CLI example ending at `skills/ima2/SKILL.md:132`:

```diff
 ima2 gen "1girl, blue hair, city at night" \
   --provider nai --model nai-diffusion-5-full \
   --nai-negative-prompt "lowres, watermark" \
   --nai-steps 28 --nai-scale 5 \
   --nai-auto-smea --nai-decrisper --nai-variety-plus
 ```
+
+In the web app, selecting NovelAI changes the composer into two explicit panes:
+Positive prompt and Negative prompt. Write what should appear in the positive pane
+and undesired content in the negative pane. Other providers keep the normal single
+prompt because they do not share NovelAI's dedicated negative-prompt contract.
```

#### B. Prompt Builder backend section

Insert a new `## Prompt Builder` between NovelAI and Prompting Guidance, before
`skills/ima2/SKILL.md:175`:

````markdown
## Prompt Builder

The right-sidebar Prompt Builder refines prompts without generating an image. Open
Settings > Providers > Prompt Builder backend to choose where its text request runs.
`Auto` is the default: it tries GPT OAuth, Grok, OpenAI API, then Grok API and selects
the first ready backend. The Builder badge shows the backend that actually answered.
Choose an explicit backend when cost, credentials, or model behavior must be stable;
if that backend is unavailable, the request fails visibly. Only Auto performs a
readiness fallback, and it never retries after an upstream accepts a request.

The CLI wrapper is:

```bash
ima2 prompt build --message "Turn this rough idea into a production image prompt"
```

Run `ima2 config get promptBuilder.backend` to inspect the persisted server preference.
The Builder's model choices depend on the selected backend; do not assume the GPT-only
model list applies to Grok.
````

Before implementation, compare `promptBuilder.backend` and the Settings path to the
landed wp3 code. If wp3 names them differently, amend this plan and all exact strings in
one pass.

#### C. Canvas vectorize wording

Replace `skills/ima2/SKILL.md:423-425`:

```diff
-In the app, the same operation is the "Convert to SVG" action on any image
-asset (generation grid tile or Assets library preview), which saves the SVG
-into the current project.
+In the app, the same operation is "Convert to SVG" on an AssetGen tile or Assets
+library preview. Canvas Mode also exposes "Trace to SVG (vector)" in Export: it
+flattens the current canvas composition to PNG, then opens the same preset and
+fine-tuning panel. Do not confuse it with "SVG (embedded raster)", which keeps the
+base image as bitmap data and vectorizes only Canvas annotations.
```

### 3.2 MODIFY `skills/ima2-front/SKILL.md`

Replace only the capability clause in the long Assets bullet at
`skills/ima2-front/SKILL.md:229`; do not reflow the whole paragraph:

```diff
-because it supports reference images, multi-candidate generation (`-n N`, multimode, independent CLI parallel — see `asset-requirements.md` FE-ASSET-PARALLEL-01), prompt builder, session style sheets, provider routing
+because it supports reference images, multi-candidate generation (`-n N`, multimode, independent CLI parallel — see `asset-requirements.md` FE-ASSET-PARALLEL-01), a backend-selectable prompt builder, raster-to-vector tracing (`ima2 vectorize` and Canvas trace — see `asset-requirements.md` Raster vs real vector), session style sheets, provider routing
```

This skill should not duplicate the full NovelAI pane or backend enum. It routes agents
to operational capability; the core skill owns exact commands.

### 3.3 MODIFY `skills/ima2-front/references/asset-requirements.md`

Insert after the source-priority table ending at
`skills/ima2-front/references/asset-requirements.md:40-46`:

````markdown
### Raster vs real vector

An image prompted as “flat vector style” is still a raster bitmap. When the shipped
asset must contain scalable paths (logo mark, icon, simple sprite, stencil), generate a
clean flat or transparent raster first, then run:

```bash
ima2 vectorize input.png -o output.svg --preset auto --json
```

The same tracer is available in AssetGen, Assets, and Canvas Mode. In Canvas Export,
choose “Trace to SVG (vector)”; “SVG (embedded raster)” is self-contained but is not a
pixel trace. Inspect path count and render the SVG back to PNG before shipping. Tracing
works best for flat color, strong edges, cutouts, and logos; photographs, gradients,
and small text are not acceptable vectorization targets.
````

### 3.4 NO CHANGE `skills/ima2-uiux/SKILL.md`

Audit verdict: this file owns intent discovery, information architecture, and UX-state
judgment, while runtime behavior belongs to `ima2-front`
(`skills/ima2-uiux/SKILL.md:35-40`). Adding command, provider, and route details here
would create a third operational source of truth. Its existing Lazy-User and UX State
contracts (`skills/ima2-uiux/SKILL.md:97-123`) already govern the three features.

## 4. README — exact insertion plan

### 4.0 MODIFY `README.md` — opening capability sentence

Replace the stale eight-lane sentence at `README.md:17-20`:

```diff
-Install globally and generate images and videos from eight core lanes: OpenAI OAuth/API, Grok OAuth/API, Antigravity CLI, Gemini API, AtlasCloud, and MiniMax.
+Install globally and generate images and videos through the core registry: OpenAI OAuth/API, Grok OAuth/API, Antigravity CLI, Gemini API, AtlasCloud, MiniMax, NovelAI, and registered ComfyUI workflows.
```

This removes a numeric count that already drifted when NovelAI and Comfy joined the
registry (`structure/00-structure-hub.md:25-29`).

### 4.1 MODIFY `README.md` — What It Does

Insert after the Canvas bullet at `README.md:109`:

```diff
 - **Canvas Mode**: zoom, pan, annotate (with hover highlighting), erase, clean backgrounds, keep transparent previews, and export either alpha or matte-backed versions. A one-click **GPT transparency** button sends the current image through the i2i edit lane and reports honestly whether the result carries real pixel alpha — verified on the server, never trusted from provider metadata.
+- **Raster-to-vector SVG**: trace flat raster art into real SVG paths with `ima2 vectorize`, from AssetGen/Assets, or from Canvas Export. Canvas labels its older self-contained wrapper as **SVG (embedded raster)** so it cannot be mistaken for a trace.
+- **NovelAI dual prompt**: when NovelAI is selected, Classic, Home, and mobile composers show separate positive and negative prompt panes; other providers keep the normal single prompt.
+- **Prompt Builder backend choice**: Settings can keep Builder routing on **Auto** or pin a supported text backend, and the Builder badge shows which backend actually answered.
```

### 4.2 MODIFY `README.md` — Model Guidance

Replace `README.md:175-179`:

```diff
-The app defaults to **`gpt-5.6-luna`** for image generation and Prompt Builder planning. Older supported models remain explicit compatibility choices.
+Image generation defaults to **`gpt-5.6-luna`** on the GPT lane. Prompt Builder backend selection is separate: **Auto** chooses the first ready supported text backend, while Settings can pin one explicitly. The Builder badge reports the backend that actually answered.
 
- - `gpt-5.6-luna` — current image and Prompt Builder default.
+- `gpt-5.6-luna` — current default image model on the GPT lane and the default GPT Builder model when that backend is selected.
```

### 4.3 MODIFY `README.md` — Workflows

Add after Classic step 1 at `README.md:189-193`:

```diff
 1. Write a prompt.
+   With NovelAI, use the positive pane for desired content and the negative pane for undesired content.
 2. Attach or paste references if needed.
```

Add after the alpha/matte export bullet at `README.md:216`:

```diff
 - Detect transparent images and show a checkerboard preview; export with preserved alpha or with a chosen matte color.
+- Choose **SVG (embedded raster)** for a self-contained canvas document, or **Trace to SVG (vector)** to flatten the composition and open the shared real-vector tracing panel.
```

Add after Settings paragraph `README.md:239-240`:

```diff
 The settings workspace keeps account, model, appearance, and language controls away from the generation sidebar.
+Prompt Builder backend lives here too: Auto tries GPT OAuth, Grok, OpenAI API, then Grok API and uses the first ready lane; an explicit choice pins routing, and the Builder surface displays the backend that actually answered.
```

### 4.4 MODIFY `README.md` — CLI Commands

Insert in the Client table after `ima2 edit` at `README.md:271-274`:

```diff
 | `ima2 edit <file> --prompt <text>` | Edit an existing image |
+| `ima2 vectorize <input.png> [-o output.svg]` | Trace PNG/JPEG/WebP into a real SVG locally; no server or provider required |
+| `ima2 prompt build --message <text>` | Refine prompt intent through the configured Prompt Builder backend; requires the local server |
```

Add a NovelAI example and vectorize example after `README.md:285-293`:

```diff
 ima2 gen "poster" --model oauth/gpt-5.6-luna --reasoning-effort high
+ima2 gen "1girl, blue hair" --model nai/nai-diffusion-5-full --nai-negative-prompt "lowres, watermark"
+ima2 vectorize logo.png -o logo.svg --json
+ima2 prompt build --message "Make this prompt production-ready"
```

### 4.5 MODIFY `README.md` — Configuration

Insert after `IMA2_IMAGE_MODEL_DEFAULT` at `README.md:313-316`:

```diff
 | `IMA2_IMAGE_MODEL_DEFAULT` | `gpt-5.6-luna` | Server fallback image model |
+| `IMA2_PROMPT_BUILDER_BACKEND` | `auto` | Prompt Builder text backend. Auto selects the first ready supported backend; the Settings choice persists as `promptBuilder.backend` |
+| `IMA2_PROMPT_BUILDER_MODEL` | `auto` with Auto backend | Prompt Builder model for the selected backend; the Settings choice persists as `promptBuilder.model` |
```

wp3 also adds `IMA2_PROMPT_BUILDER_MODEL` / `promptBuilder.model`; add the adjacent
configuration row when documenting the backend-scoped model default.

### 4.6 MODIFY `README.md` — API Reference

Insert after the opening sentence at `README.md:351-354`:

```diff
 The endpoint list moved to [docs/API.md](docs/API.md) so this README can stay focused on first-run use.
+The relevant feature groups are `POST /api/assets/derived` (`kind=vector-svg`), NovelAI's `negativePrompt` generation field, and `POST /api/prompt-builder/chat` plus its backend-setting endpoint.
```

## 5. Astro site — English/Korean exact wording

There are no content collections or Markdown content entries. `find site/src` shows
direct Astro pages only, so every English/Korean pair must change together.

### 5.1 MODIFY overview pages

In `site/src/pages/docs/index.astro`, insert after the Canvas item at
`site/src/pages/docs/index.astro:49`:

```html
<li><strong>Raster-to-vector SVG</strong> — trace flat raster art from the CLI, Assets, AssetGen, or Canvas into real SVG paths.</li>
<li><strong>NovelAI dual prompt</strong> — separate positive and negative panes appear only when NovelAI is selected.</li>
<li><strong>Prompt Builder routing</strong> — keep backend selection on Auto or pin a supported backend, with the answering backend visible in Builder.</li>
```

In `site/src/pages/ko/docs/index.astro`, insert after
`site/src/pages/ko/docs/index.astro:48`:

```html
<li><strong>래스터를 SVG 벡터로</strong> — CLI, Assets, AssetGen, Canvas에서 단순한 래스터 그림을 실제 SVG 패스로 변환합니다.</li>
<li><strong>NovelAI 듀얼 프롬프트</strong> — NovelAI를 고르면 긍정·부정 프롬프트 창이 나란히 열리고, 다른 프로바이더에서는 기존 입력창 하나만 보입니다.</li>
<li><strong>Prompt Builder 라우팅</strong> — 백엔드를 자동 선택에 맡기거나 직접 고정할 수 있고, 실제로 응답한 백엔드가 Builder에 표시됩니다.</li>
```

### 5.2 MODIFY mode pages

Append to Classic paragraph before its closing `</p>` at
`site/src/pages/docs/concepts/modes.astro:18-23`:

```html
When NovelAI is selected, the composer splits into Positive prompt and Negative prompt panes; other providers keep one prompt field.
```

Append to Canvas paragraph at `site/src/pages/docs/concepts/modes.astro:40-46`:

```html
Export “SVG (embedded raster)” when the bitmap base should remain intact, or choose “Trace to SVG (vector)” to open the shared path-tracing panel.
```

Insert a new section before Prompt library at
`site/src/pages/docs/concepts/modes.astro:88`:

```html
<h2>Prompt Builder</h2>
<p>
  Prompt Builder improves and discusses prompts without generating an image. Choose its backend in
  Settings. Auto selects the first ready supported backend; an explicit selection pins routing, and
  the Builder badge shows which backend actually answered.
</p>
```

Korean equivalents in `site/src/pages/ko/docs/concepts/modes.astro`:

```html
NovelAI를 고르면 컴포저가 긍정 프롬프트와 부정 프롬프트 두 창으로 나뉩니다. 다른 프로바이더에서는 기존 입력창 하나만 보입니다.
```

```html
비트맵 바탕을 그대로 둔 자체 포함 문서가 필요하면 “SVG (래스터 포함)”, 실제 패스로 변환하려면 “SVG로 추적 (벡터)”을 고르세요. 벡터 추적은 기존 변환 패널에서 세부 값을 조정합니다.
```

```html
<h2>Prompt Builder</h2>
<p>
  Prompt Builder는 이미지를 만들지 않고 프롬프트를 다듬고 검토합니다. 백엔드는 설정에서 고릅니다.
  자동 선택은 준비된 백엔드 가운데 하나를 고르고, 직접 선택하면 그 경로로 고정합니다. 실제로 응답한
  백엔드는 Builder 배지에서 확인할 수 있습니다.
</p>
```

### 5.3 MODIFY provider pages

First remove the stale eight-lane count in both page descriptions/leads. English at
`site/src/pages/docs/concepts/providers.astro:11-19` becomes:

```diff
-description="Choose among eight core provider lanes, pick a model, and set quality, moderation, and reasoning defaults."
+description="Choose an ima2-gen provider lane, pick a model, and set quality, moderation, and reasoning defaults."
@@
-The core registry contains eight provider lanes: OpenAI OAuth and API, Grok OAuth and API,
-Gemini/Antigravity CLI, direct Gemini API, AtlasCloud API, and MiniMax API.
+The core registry includes OpenAI OAuth and API, Grok OAuth and API,
+Gemini/Antigravity CLI, direct Gemini API, AtlasCloud, MiniMax, NovelAI, and registered
+ComfyUI workflows.
```

Korean at `site/src/pages/ko/docs/concepts/providers.astro:11-19` becomes:

```diff
-description="8개 core provider lane 선택, 모델 선택, 품질·moderation·reasoning 기본값 설정."
+description="ima2-gen 프로바이더 레인 선택, 모델 선택, 품질·moderation·reasoning 기본값 설정."
@@
-core registry에는 OpenAI OAuth/API, Grok OAuth/API, Gemini/Antigravity CLI,
-Gemini 직접 API, AtlasCloud API, MiniMax API로 구성된 provider lane 8개가 있습니다.
+core registry에는 OpenAI OAuth/API, Grok OAuth/API, Gemini/Antigravity CLI,
+Gemini 직접 API, AtlasCloud, MiniMax, NovelAI, 등록된 ComfyUI 워크플로가 있습니다.
```

Add NovelAI to the provider list after MiniMax at
`site/src/pages/docs/concepts/providers.astro:22-32`:

```html
<li><code>provider: "nai"</code> — calls NovelAI with a persistent token. It is text-to-image only and exposes a dedicated negative prompt plus native sampling controls; references and edits fail closed.</li>
```

Insert before Models at `site/src/pages/docs/concepts/providers.astro:52`:

```html
<h2>Prompt Builder backend</h2>
<p>
  Prompt Builder routing is independent from the current image provider. Settings offers Auto plus
  every supported text backend (GPT OAuth, OpenAI API, Grok, Grok API). Auto chooses the first ready
  backend in that order; an explicit selection pins routing and fails with a typed error (for example
  a missing API key) instead of falling back. The Builder badge reports the answering backend, so a
  fallback never masquerades as the selected lane.
</p>
```

Replace the hardcoded default sentence and Luna row at
`site/src/pages/docs/concepts/providers.astro:52-64` with:

```diff
-The app defaults to <code>gpt-5.6-luna</code> for image generation and Prompt Builder planning.
+The GPT image lane defaults to <code>gpt-5.6-luna</code>. Prompt Builder has a separate backend preference; when its backend resolves to GPT, Luna is the default GPT Builder model.
@@
-<tr><td><code>gpt-5.6-luna</code></td><td>Current image and Prompt Builder default.</td></tr>
+<tr><td><code>gpt-5.6-luna</code></td><td>Current GPT image default and default GPT Builder model when the Builder uses a GPT backend.</td></tr>
```

Natural Korean additions in `site/src/pages/ko/docs/concepts/providers.astro`:

```html
<li><code>provider: "nai"</code> — 저장된 토큰으로 NovelAI를 호출합니다. 텍스트 생성만 지원하며 부정 프롬프트와 고유 샘플링 옵션을 제공합니다. 레퍼런스와 편집 요청은 조용히 버리지 않고 실패 처리합니다.</li>
```

```html
<h2>Prompt Builder 백엔드</h2>
<p>
  Prompt Builder의 라우팅은 현재 이미지 프로바이더와 별개입니다. 설정에는 자동 선택과 현재 환경에서
  준비된 텍스트 백엔드가 표시됩니다. 자동 선택은 사용 가능한 경로 하나를 고르고, 직접 선택하면 그
  경로로 고정합니다. 폴백이 일어나도 실제 응답 백엔드가 Builder 배지에 드러납니다.
</p>
```

```diff
-이미지 생성과 Prompt Builder는 <code>gpt-5.6-luna</code>를 기본값으로 씁니다.
+GPT 이미지 레인의 기본 모델은 <code>gpt-5.6-luna</code>입니다. Prompt Builder는 별도 백엔드 설정을 따르며, GPT 백엔드를 쓸 때 Luna가 기본 Builder 모델입니다.
```

### 5.4 MODIFY CLI reference pages

Add two rows after `ima2 edit` in the Generation table at
`site/src/pages/docs/reference/cli.astro:40-75`:

```html
<tr><td><code>ima2 vectorize &lt;input&gt; [-o output.svg]</code></td><td>Trace PNG/JPEG/WebP into real SVG paths locally. No server or provider is required.</td></tr>
<tr><td><code>ima2 prompt build --message &lt;text&gt;</code></td><td>Refine a prompt through the configured Prompt Builder backend. Requires <code>ima2 serve</code>.</td></tr>
```

Add a paragraph after the generation flag paragraph:

```html
<p>
  NovelAI generation accepts <code>--nai-negative-prompt</code> and native sampling flags. The web
  composer presents the same positive/negative split when NovelAI is selected.
</p>
```

Korean rows and paragraph in `site/src/pages/ko/docs/reference/cli.astro`:

```html
<tr><td><code>ima2 vectorize &lt;input&gt; [-o output.svg]</code></td><td>PNG/JPEG/WebP를 로컬에서 실제 SVG 패스로 변환. 서버와 프로바이더가 필요 없습니다.</td></tr>
<tr><td><code>ima2 prompt build --message &lt;text&gt;</code></td><td>설정된 Prompt Builder 백엔드로 프롬프트를 다듬습니다. <code>ima2 serve</code>가 필요합니다.</td></tr>
```

```html
<p>
  NovelAI 생성은 <code>--nai-negative-prompt</code>와 고유 샘플링 옵션을 받습니다. 웹 컴포저에서도
  NovelAI를 고르면 같은 의미의 긍정·부정 프롬프트 창이 따로 열립니다.
</p>
```

### 5.5 MODIFY config reference pages

Insert in the environment table after `IMA2_IMAGE_MODEL_DEFAULT` at
`site/src/pages/docs/reference/config.astro:32-35`:

```html
<tr><td><code>IMA2_PROMPT_BUILDER_BACKEND</code></td><td><code>auto</code></td><td>Prompt Builder text backend; Auto selects the first ready supported backend.</td></tr>
<tr><td><code>IMA2_PROMPT_BUILDER_MODEL</code></td><td><code>auto</code> with Auto backend</td><td>Backend-scoped Builder model. Changing backend resets this to that backend's default.</td></tr>
```

Add `promptBuilder.backend` and `promptBuilder.model` to the writable-key block at
`site/src/pages/docs/reference/config.astro:65-73`.

Korean:

```html
<tr><td><code>IMA2_PROMPT_BUILDER_BACKEND</code></td><td><code>auto</code></td><td>Prompt Builder 텍스트 백엔드. 자동 선택은 준비된 지원 경로 가운데 하나를 고릅니다.</td></tr>
<tr><td><code>IMA2_PROMPT_BUILDER_MODEL</code></td><td>자동 백엔드에서는 <code>auto</code></td><td>선택한 백엔드 전용 Builder 모델. 백엔드를 바꾸면 해당 경로의 기본 모델로 함께 바뀝니다.</td></tr>
```

Add the same two keys to `site/src/pages/ko/docs/reference/config.astro:62-70`.

### 5.6 MODIFY API reference pages

Add an Assets subsection between History and Sessions in
`site/src/pages/docs/reference/api.astro:88-98`:

```html
<h2>Assets &amp; vectorize</h2>
<table>
  <thead><tr><th>Endpoint</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td><code>POST /api/assets/derived</code></td><td><code>kind=vector-svg</code> traces a stored PNG/JPEG/WebP with <code>source</code>, <code>preset</code>, and optional tuning query parameters. The request body is empty.</td></tr>
  </tbody>
</table>
```

Replace the Prompt Builder row at `site/src/pages/docs/reference/api.astro:128` with:

```html
<tr><td><code>POST /api/prompt-builder/chat</code></td><td>Prompt-builder assistant (<code>ima2 prompt build</code>). The response returns <code>requestedBackend</code>, the answering <code>backend</code>, and <code>model</code>.</td></tr>
```

Add the wp3 config GET/PUT row immediately after it:

```html
<tr><td><code>GET · PUT /api/prompt-builder/config</code></td><td>Read or update the persisted Prompt Builder backend/model pair; GET returns the backend/model catalogs, Auto order, and environment-lock bits.</td></tr>
```

Add a NovelAI note after the generate request paragraph at
`site/src/pages/docs/reference/api.astro:63-73`:

```html
<p>
  NovelAI requests use <code>provider: "nai"</code> and may include
  <code>negativePrompt</code> plus provider-native sampling controls. NovelAI is text-to-image only;
  references and edits return explicit <code>NAI_*_UNSUPPORTED</code> errors.
</p>
```

Korean section and rows in `site/src/pages/ko/docs/reference/api.astro`:

```html
<h2>에셋 &amp; 벡터 변환</h2>
<table>
  <thead><tr><th>엔드포인트</th><th>설명</th></tr></thead>
  <tbody>
    <tr><td><code>POST /api/assets/derived</code></td><td><code>kind=vector-svg</code>로 저장된 PNG/JPEG/WebP를 추적합니다. <code>source</code>, <code>preset</code>, 선택 세부 값을 쿼리로 보내며 요청 본문은 비웁니다.</td></tr>
  </tbody>
</table>
```

```html
<tr><td><code>POST /api/prompt-builder/chat</code></td><td>설정된 백엔드로 Prompt Builder 요청을 보내고 실제 응답 백엔드와 모델을 반환합니다. CLI는 <code>ima2 prompt build</code>.</td></tr>
<tr><td><code>GET · PUT /api/prompt-builder/config</code></td><td>Prompt Builder 백엔드·모델 설정을 읽거나 저장합니다. GET은 선택 가능한 백엔드·모델, 자동 선택 순서, 환경 변수 잠금 상태를 함께 반환합니다.</td></tr>
```

```html
<p>
  NovelAI 요청은 <code>provider: "nai"</code>와 <code>negativePrompt</code>, 고유 샘플링 옵션을
  받을 수 있습니다. 텍스트 생성만 지원하므로 레퍼런스·편집은 명시적인
  <code>NAI_*_UNSUPPORTED</code> 오류로 끝납니다.
</p>
```

## 6. Public Markdown API/CLI docs

The task's named audit surfaces do not require a new manual, but the linked canonical
Markdown references must not contradict the site:

- `docs/CLI.md` already documents NovelAI flags and vectorize (guarded by
  `tests/cli-feature-parity-contract.test.js:23-38` and the existing vectorize unit).
  MODIFY its Prompt Builder rows at `docs/CLI.md:365-366` by inserting this paragraph
  immediately after the table and before `## Card News (gated)`:

```diff
 | `ima2 prompt build --messages <file\|@file\|-> [--json]` | Build from a message transcript file or stdin |
+
+Prompt Builder uses the server's persisted `promptBuilder.backend` preference. `auto`
+chooses the first ready supported text backend; an explicit value pins routing. The
+result identifies `requestedBackend`, the answering `backend`, and `model`, so callers
+can detect Auto fallback.
 
 ## Card News (gated)
```

- `docs/API.md` already documents every route and the complete NovelAI field set
  (`tests/api-docs-contract.test.js:37-81`). Insert a new `## Prompt Builder` section
  immediately before `## Endpoint → CLI Mapping` at `docs/API.md:813`:

```markdown
## Prompt Builder

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/prompt-builder/chat` | `{ messages, model?, context? }` | `{ provider, backend, requestedBackend, model, message, usage }` |
| `GET` | `/api/prompt-builder/config` | none | `{ backend, model, options: { backends, models, autoOrder }, locked }` |
| `PUT` | `/api/prompt-builder/config` | `{ backend, model? }` | same config payload after atomic persistence |

`backend=auto` tries `oauth -> grok -> api -> grok-api` and selects the first ready lane.
An explicit backend stays pinned. Chat responses separate `requestedBackend` from the
answering `backend`; invalid or unavailable explicit backends return the wp3 error code
instead of silently reporting GPT OAuth. Environment-locked config writes return 409
`PROMPT_BUILDER_CONFIG_ENV_LOCKED`.
```

Add `GET/PUT /api/prompt-builder/config` to the mapping table beside
`POST /api/prompt-builder/chat` at `docs/API.md:864` as Settings/web-UI config.
- `docs/PROMPT_STUDIO.md` should add one short UI paragraph for NovelAI dual panes and
  the right-panel Builder backend badge. It is the control-by-control manual linked by
  README and site (`README.md:195-197`,
  `site/src/pages/docs/concepts/modes.astro:88-94`).

Insert immediately after the Feature Map table at `docs/PROMPT_STUDIO.md:10-23` and
before `## Multimode Prompting`. Exact wording:

```markdown
### Provider-specific prompt surfaces

NovelAI shows Positive prompt and Negative prompt as separate panes in Classic, Home,
and the mobile compose sheet. Switching away from NovelAI restores the single prompt
without deleting the saved negative prompt. Prompt Builder routing is configured in
Settings; its badge shows the backend that actually answered, including an Auto
selection or fallback.
```

## 7. Structure SoT synchronization

### 7.1 MODIFY `structure/00-structure-hub.md`

Insert a dated snapshot after the NovelAI tuning note at
`structure/00-structure-hub.md:25-27`:

```markdown
Snapshot note, 2026-09-02: studio surfaces now expose NovelAI positive/negative prompt
panes across desktop/home/mobile, configurable Prompt Builder backend routing with a
visible answering backend, and real Canvas raster-to-vector tracing through the shared
Assets vectorize panel. Canvas's self-contained embedded-raster SVG remains a separate
export. Unit: `devlog/_plan/260902_studio_surfaces/`.
```

### 7.2 MODIFY `structure/01-file-function-map.md`

After implementation, run `npm run docs:refresh-line-counts` rather than hand-editing
counts. Add/refresh responsibilities for:

- `routes/promptBuilder.ts` — chat plus config endpoint if wp3 owns both.
- new prompt-builder router/adapter modules from wp3, if any.
- `ui/src/components/NegativePromptField.tsx` and mobile/home composer owners.
- `ui/src/components/canvas-mode/CanvasExportMenu.tsx` and
  `useCanvasModeSession.ts` — embedded SVG vs trace staging.
- `ui/src/components/assetgen/VectorizePanel.tsx` — shared Assets/Canvas trace modal.

Do not invent exact line counts in this plan; the script reads the final files. The
current map already owns `bin/commands/vectorize.ts` and `lib/vectorizeImage.ts`
(`structure/01-file-function-map.md:103-112`,
`structure/01-file-function-map.md:262`).

### 7.3 MODIFY `structure/02-command-reference.md`

Vectorize is already complete at `structure/02-command-reference.md:92`. In the
Prompt Builder command/config section, add:

```markdown
`ima2 prompt build` sends its request through the server-selected Prompt Builder
backend. `promptBuilder.backend=auto` chooses the first ready supported text backend;
an explicit value pins routing. The response exposes `requestedBackend` and answering
`backend`; the UI badge renders the latter.
```

### 7.4 MODIFY `structure/03-server-api.md`

The vector route is already complete at `structure/03-server-api.md:189-201`. Replace
the shallow Prompt Builder paragraph at `structure/03-server-api.md:417-424` with the
final wp3 request/response table, including:

- chat body backend/model semantics;
- configuration GET/PUT route;
- configured `backend`/`model` versus chat `requestedBackend`/answering `backend`;
- Auto order and no-ready-backend error;
- fallback activation and logging boundary.

Provisional exact paragraph:

```markdown
`/api/prompt-builder/chat` powers the UI and `ima2 prompt build`. It routes through
`config.promptBuilder.backend`; `auto` selects the first ready supported text backend,
while an explicit backend stays pinned. Responses expose configured and resolved
backend separately so the UI never presents a fallback as the user's selection.
```

### 7.5 MODIFY `structure/04-frontend-architecture.md`

Replace the NovelAI controls row at `structure/04-frontend-architecture.md:68`:

```diff
-| NovelAI controls | `settings/NaiControlsPanel.tsx`, `NegativePromptField.tsx`, `ui/src/lib/naiOptions.ts`, `naiPayload.ts` | Sparse provider-native overrides and undesired-content input for classic/multimode/node. Auto SMEA and Decrisper apply to V5/V4.5; Quality Preset and Alpha render only for V5. Effective node provider/model gates payloads so global state cannot leak. |
+| NovelAI controls | `settings/NaiControlsPanel.tsx`, `NegativePromptField.tsx`, `PromptComposer.tsx`, `home/HomePromptComposer.tsx`, `MobileComposeSheet.tsx`, `ui/src/lib/naiOptions.ts`, `naiPayload.ts` | Provider-gated positive/negative panes across desktop, home, and mobile plus sparse native overrides. Non-NAI providers keep one prompt; saved negative state is retained but omitted from their payloads. |
```

Insert a Prompt Builder row after Right panel at
`structure/04-frontend-architecture.md:63-64`:

```markdown
| Prompt Builder | `RightPanel.tsx`, `components/prompt-builder/*`, `settings/PromptBuilderSettings.tsx`, `promptBuilderStore.ts` | Conversational prompt refinement with persisted backend/model, backend-scoped model catalogs, deterministic Auto order, and a badge sourced from the successful response's answering backend. |
```

The vectorize row is owned by wp4 §3.10 of
`devlog/_plan/260902_studio_surfaces/030_canvas_vectorize.md`; wp5 verifies it rather
than adding a duplicate.

### 7.6 MODIFY `structure/06-infra-operations.md`

Add the landed Prompt Builder environment variable/config key after the OpenAI key row
at `structure/06-infra-operations.md:98-105`, with default `auto` and accepted values
copied from wp3's validator. Do not list a backend that lacks an executable adapter.

### 7.7 MODIFY `structure/07-devlog-map.md`

Add under active work, not Completed Work:

```markdown
| `260902_studio_surfaces` | NovelAI dual-prompt UI, configurable Prompt Builder backend, Canvas vectorize entry, docs upgrade, and release train |
```

Move that row to Completed Work only when wp6 archives the whole unit.

## 8. Tests and docs verifiers

### 8.1 NEW `tests/studio-surface-docs-contract.test.ts`

This source contract reads only documentation and pins the user-visible claims that
have drifted before. Exact assertions:

1. `skills/ima2/SKILL.md` contains `ima2 vectorize`, `Trace to SVG (vector)`,
   `SVG (embedded raster)`, Positive/Negative prompt, `promptBuilder.backend`, Auto,
   and answering-backend wording.
2. `skills/ima2-front/SKILL.md` mentions raster-to-vector and routes to
   `asset-requirements.md`; that reference contains the local vectorize command and the
   photo/small-text quality boundary.
3. `README.md` includes both CLI commands, all three GUI surfaces for vectorize,
   NovelAI dual panes, and configured/resolved Builder semantics.
4. Every English/Korean site pair contains equivalent anchors: `vector-svg`,
   `negativePrompt`, `prompt-builder/chat`, and the landed config key.
5. `structure/03-server-api.md` names the vector route and
   `/api/prompt-builder/config`; `structure/04-frontend-architecture.md` names dual
   panes, shared vector modal, and the successful-response backend badge.

Do not assert full translated sentences byte-for-byte; assert stable code identifiers
and one language-specific phrase per page. That catches omission without making copy
edits artificially expensive.

### 8.2 MODIFY `tests/cli-skill-command-contract.test.js`

Extend the first packaged-skill test after `tests/cli-skill-command-contract.test.js:24-40`:

```js
assert.match(skill, /ima2 vectorize/);
assert.match(skill, /Trace to SVG \(vector\)/);
assert.match(skill, /Positive prompt/);
assert.match(skill, /Negative prompt/);
assert.match(skill, /promptBuilder\.backend/);
assert.match(skill, /backend that actually answered/i);
```

### 8.3 Existing validators and what they read

| Command/test | Reads changed docs? | Notes |
|---|---|---|
| `node scripts/check-devlog-citations.mjs devlog/_plan/260902_studio_surfaces` | Yes, plan docs only | Rejects bare `file:line` citations; implementation docs outside this unit are not scanned. Script behavior: `scripts/check-devlog-citations.mjs:15-49`. |
| `node scripts/generate-contract-docs.mjs --check` | Yes, `skills/ima2/SKILL.md` | Verifies the generated MCP marker block is current; manual edits outside markers survive (`tests/contract-docs-projection.test.ts:10-22`). |
| `node bin/ima2.js skill` | Yes, core skill | `bin/commands/skill.ts:93-104` reads `SKILL.md` at invocation time. Markdown changes need no command-code update. |
| `node bin/ima2.js skill front` | Yes, front skill | Same dynamic read; references are discovered recursively (`bin/commands/skill.ts:116-143`). |
| `node bin/ima2.js skill front ref asset-requirements` | Yes, changed reference | Proves the CLI exposes the updated reference without changing `bin/commands/skill.ts`. |
| `npm run docs:refresh-line-counts` | Yes, `structure/01-file-function-map.md` | Mechanical line-count refresh after wp2-wp4 code lands; inspect diff before commit. |
| `tests/api-docs-contract.test.js` | Yes, `docs/API.md`; no site/README | Ensures every registered route is named and NovelAI fields/codes remain documented (`tests/api-docs-contract.test.js:37-81`). |
| `tests/cli-feature-parity-contract.test.js` | Yes, `docs/CLI.md`; no site/README | Already guards NovelAI native CLI coverage. |
| `tests/package-smoke.test.js` | Indirect, skill presence only | Checks packaged paths, not new prose (`tests/package-smoke.test.js:28-32`). |
| `npm --prefix site run check` | Yes, all site Astro | Astro type/content check. |
| `npm --prefix site run build` | Yes, all site Astro | Production-render compilation for English and Korean routes. |

### 8.4 Parent-required verifier matrix

“Reads target” means wp5's documentation diff.

| Command | Reads wp5 targets? | Honest scope |
|---|---|---|
| `npm run typecheck` | No | Root TS production check does not compile Markdown/README/Astro or docs-only tests. It protects the already-landed wp2-wp4 code. |
| `npm run typecheck:tests` | Yes, new `.test.ts`; not prose directly | Compiles `tests/studio-surface-docs-contract.test.ts`, which reads prose at runtime. |
| `npm test` | Yes | Runs the new docs contract, packaged skill contracts, generated projection test, API docs contract, and CLI docs parity. |
| `npm run test:inventory` | Indirect | Classifies the new test; does not validate docs wording. |
| `cd ui && npm run build` | No for README/skills/site/structure | Protects the landed UI features but does not read wp5 docs. Use the site build separately. |

Required wp5 command set:

```bash
node scripts/check-devlog-citations.mjs devlog/_plan/260902_studio_surfaces
node scripts/generate-contract-docs.mjs --check
node bin/ima2.js skill > /tmp/ima2-core-skill.md
node bin/ima2.js skill front ref asset-requirements > /tmp/ima2-asset-requirements.md
npm run docs:refresh-line-counts
npm run typecheck
npm run typecheck:tests
npm test
npm run test:inventory
cd ui && npm run build
cd ../site && npm run check && npm run build
```

`npm run docs:refresh-line-counts` is a writer, so run it only in wp5 after reviewing
the final code and keep only intended structure-map changes.

## 9. Render and link grounding for docs

The site is a rendered artifact. After `npm --prefix site run build`, serve
`site/dist` on a spare local port and inspect at 1280x720:

1. `/docs/concepts/modes` and `/ko/docs/concepts/modes` — dual prompt, Canvas SVG
   distinction, and Prompt Builder section.
2. `/docs/concepts/providers` and Korean pair — NovelAI lane and Builder backend.
3. `/docs/reference/cli`, `/docs/reference/config`, `/docs/reference/api` and Korean
   pairs — code blocks/tables do not overflow and links resolve.

Persist one English and one Korean screenshot under
`devlog/_plan/260902_studio_surfaces/evidence/` and read them back. Also run a local
link crawl over `site/dist`; no new page is added, so nav topology should remain stable.

## 10. Acceptance and open questions

- Core skill is the operational source for CLI/provider/prompt behavior.
- Front skill/reference adds only production-asset routing and real-vector judgment.
- UI/UX skill remains unchanged because product command duplication violates its role.
- README provides discovery; site modes/providers/reference pages provide depth in
  natural English and Korean; structure docs map code ownership.
- `ima2 skill` needs no implementation update when Markdown changes because it reads
  the packaged file dynamically (`bin/commands/skill.ts:93-104`,
  `bin/commands/skill.ts:292-300`). Tests still execute the built CLI to prove it.
- Locale scope is LOCKED to the four runtime locales (`ui/src/i18n/index.ts:1-9`,
  `tests/i18n-coverage-contract.test.ts:53-65`) per
  `devlog/_plan/260902_studio_surfaces/000_plan.md` "Locale correction"; the parent
  objective's "five" was an error and a Japanese locale is a non-goal of this unit.
