# x.ai Official News / Blog / Changelog — Source Evidence

**Scope:** official xAI/SpaceXAI announcement + changelog surfaces, window **2026-07-28 → 2026-09-08**.
**Research date:** 2026-09-08 (KST). All pages fetched live that day unless noted.
**Nature of this document:** source evidence only — exact quotes, dates, URLs. Interpretive findings are deliberately excluded.

**Out of scope (parent agent owns):** video editing/extension capability doc pages; docs llms/sitemap enumeration; REST API reference model endpoint documentation.
**Excluded as unusable:** `x.ai/news/grok-bot-procurement` — the fetch returned an unrelated system-prompt body; treated as unreliable and not cited anywhere in this report.

---

## 1. Correction notice (supersedes prior draft)

The prior draft (`FINDINGS.superseded-2026-09-08.md`) contained overclaims. Corrections applied:

1. **The 14-reference claim is substantiated.** Independently verified live on X (§2). The prior draft's "no evidence of such a change" and its "likely conflation with images 3→5" speculation are **removed entirely**. The image 3→5 change is reported in §6 as its own separate fact with no relation asserted to the video reference count.
2. **The @imagine announcement is mixed product references** ("Images, voices, character references, and more"), **not an explicit public-API image count.** It therefore does not contradict, and cannot disprove, a live measurement of 14. The API docs figure of 7 (§4) and the X figure of 14 (§2) are recorded as separate observations on separate surfaces; no reconciliation is asserted.
3. **Dated-alias inferences removed.** The prior draft claimed `grok-imagine-video-1.5-2026-05-30` showed "same weights", "serving-stack features", and "no new checkpoint". An alias string establishes none of those. §5 now lists alias strings as strings only.
4. **"Rendered model pages show blank aliases" was false** and is removed. Parent confirms the rendered page shows aliases plainly via buttons.
5. **"Editing/extension never announced" softened** to *not found on the news/changelog surfaces I searched*, with the surfaces named.
6. **"Undocumented endpoints" section removed.** Parent confirms model endpoints are in the REST docs, and optional-I2V-prompt appears in both the guide and OpenAPI. "Not in the nav I read" is not the same as undocumented. Skills/legacy endpoints are out of scope and excluded.

---

## 2. Independent live X verification — @imagine, Sep 2, 2026

Verified directly against the X API on 2026-09-08, not via search snippet.

- **URL:** `https://x.com/imagine/status/2095249317875622255`
- **Tweet ID:** `2095249317875622255`
- **Account:** `@imagine` — display name **"Grok Imagine"**, verified: **true**, bio "Unlock your imagination with Grok Imagine.", 79,899 followers
- **createdAt (UTC):** `2026-09-02T20:35:39.000Z` → **2026-09-03 05:35:39 KST**
- **Engagement at read time:** 1,363 likes / 164 RT / 148 replies / 286 bookmarks / 199,619 views
- **Media:** one 1920×1080 video
- **Thread:** single post, no self-reply chain

**Exact full text:**

> You can now use up to 14 references in your videos.
>
> Images, voices, character references, and more.
>
> Use "@" to tag each reference in your prompt.

Three observations, stated without inference:
- The count **14** applies to "references", enumerated as "**Images, voices, character references, and more**" — a mixed set. The post does not give a public-API image-only count.
- The tagging mechanism named is **`@`** ("Use "@" to tag each reference in your prompt").
- This is an official verified xAI product account. It is **not** a `x.ai/news` post and does not appear on any `x.ai` or `docs.x.ai` surface enumerated in §3.

**Adjacent @imagine posts in/near window** (same account, for date context):
| Date (UTC) | ID | Text |
|---|---|---|
| 2026-09-01 | 2094584370791411802 | "Segmentation for easier image editing" |
| 2026-08-26 | 2092675531057885288 | "A guide on how to get the most cinematic outcomes with Grok Imagine." |
| 2026-08-25 (RT) | 2092399433493426627 | RT @karaebel: "When making a video in @imagine, you can now choose whether your uploaded image is a first frame or just guides the video…" |
| 2026-08-19 | 2090167345738129805 | "Resize any picture, graphic, ad. One click to any other ratio." |
| 2026-08-09 | 2086574880175137190 | "Auto-segmentation makes it easy for you to edit precise elements of any image" |
| 2026-08-08 | 2086142677481930861 | "With Image 2.0 you can create and precisely edit images. Try it for free for a limited time" |

---

## 3. Changelog / release-note surfaces located

Five separate, independently-dated official surfaces. No unified changelog was found.

| # | Surface | URL | Covers | Latest entry as of 2026-09-08 |
|---|---------|-----|--------|-------------------------------|
| 1 | News / blog | `https://x.ai/news` | Company + product announcements | Sep 3, 2026 |
| 2 | API docs Release Notes | `https://docs.x.ai/developers/release-notes` | xAI API changes | September 2026 section (month-bucketed) |
| 3 | Console Changelog | `https://x.ai/api/changelog` | console.x.ai web UI | Aug 24, 2026 |
| 4 | Grok Build Changelog | `https://x.ai/build/changelog` | Grok Build CLI, per version | Aug 28, 2026 (v1.0.13) |
| 5 | Grok consumer Release Notes | `https://grok.com/changelog` → `https://grok.com/release-notes` | grok.com / Imagine web + app | **Aug 15, 2026** |

Discovery: `https://x.ai/sitemap.xml` lists `x.ai/api/changelog` and `x.ai/build/changelog`, neither linked from `/news`. `https://docs.x.ai/llms.txt` lists `https://docs.x.ai/developers/release-notes.md`.
Non-existent paths verified: `docs.x.ai/docs/changelog` (404), `docs.x.ai/developers/changelog` (404), `x.ai/bot/changelog` (404), `x.ai/grok/changelog` (404 body), `x.ai/changelog` (403).

**Sitemap-lists-but-`/news`-index-omits** (dates are sitemap `lastmod`): `designing-grok-bot` (2026-09-03), `biosafety-at-the-frontier` (2026-09-01), `grok-bot-and-x` (2026-08-29). (A fourth, `grok-bot-procurement`, is excluded per the header note.)

---

## 4. Imagine Video 1.5 with References — Jul 31, 2026 news post, exact quotes

**URL:** `https://x.ai/news/grok-imagine-video-1-5-references`
**Date printed on post:** **Jul 31, 2026**
**Sitemap `lastmod`:** `2026-07-31T00:00:00.000Z`

Subhead:
> "Our best video model, now with text, image, and voice references — generating up to 1080p."

Opening:
> "When we launched Imagine Video 1.5 last month, it was our best video model yet — better motion, better physics, and better audio. Today it goes further: image and voice references, video from a prompt alone, and native 1080p generation."

Availability:
> "Image and voice references start today in the US for SuperGrok Heavy and SuperGrok Plus on grok.com/imagine and iOS, rolling out to all tiers over the next few days."

Section "Text-to-Video and native 1080p":
> "Describe the shot — no starting image needed. Text-to-video pairs our image generation with image-to-video. Native 1080p is now supported with text-to-video and image-to-video. Text-to-video and native 1080p are generally available on grok.com/imagine, iOS, and Android."

Section "Voice consistency":
> "Pass in a character image and a voice reference, and both hold — the same face and the same voice in every scene."

Section "Multi-Reference" — **full text**:
> "Each reference image locks one thing in place — a face, a product, a location. Keep a character and swap the scene, keep the scene and swap the character, or hold both and change only the action. **Up to seven references per generation.**"

Section "In the API":
> "Image references, text-to-video, and native 1080p are live in the xAI API with our best video model, `grok-imagine-video-1.5`. Voice reference support is available on request."

Code sample as published:
```python
import os
import xai_sdk

client = xai_sdk.Client(api_key=os.getenv("XAI_API_KEY"))

response = client.video.generate(
    prompt="Slow cinematic push-in as embers drift across the battlefield and the helmet's crest stirs in the wind",
    model="grok-imagine-video-1.5",
    reference_image_urls=["https://example.com/helmet.jpg"],
    duration=6,
    aspect_ratio="16:9",
    resolution="720p",
)

print(response.url)
```

**Scope note:** this post covers references, text-to-video, native 1080p, and voice consistency. Video editing and video extension are not mentioned in it.

### Reference-count figures on other surfaces (recorded separately, no reconciliation asserted)

| Surface | Date on surface | Figure | Exact quote |
|---|---|---|---|
| `x.ai/news/grok-imagine-video-1-5-references` | Jul 31, 2026 | 7 "references" | "Up to seven references per generation." |
| `docs.x.ai/developers/model-capabilities/video/reference-to-video` | footer "Last updated: August 20, 2026" | 7 reference **images** | "A maximum of **7 reference images** can be provided per request." |
| `x.com/imagine/status/2095249317875622255` | Sep 2, 2026 | **14** mixed "references" | "You can now use up to 14 references in your videos. Images, voices, character references, and more." |

Additional limits from the same docs page (rendered), same Aug 20 footer:
> "Up to **3** optional preset voices on **grok-imagine-video-1.5**, selected by `voice_id`. Voice references with your own audio files are available to trusted partners on request."
> "At least one reference image or voice is required. On **grok-imagine-video-1.5**, max **duration** is **15 seconds**."
> "The maximum **resolution** for reference-to-video is **720p**."
> "Reference-to-video cannot be combined with image-to-video or video editing. Only one mode can be active per request, determined by the parameters on the request."

Note: the docs `.md` variant of this page strips the limits callout; the quotes above are from the rendered HTML page.
Note: `docs.x.ai/openapi.json` (fetched 2026-09-08) carries no `maxItems` on `GenerateVideoRequest.reference_images`; the only Imagine `maxItems` in that spec is `reference_audios: 3`. Recorded as a spec observation only — no limit is inferred from its absence.

---

## 5. Model identifier strings (live 2026-09-08)

Alias strings as published, from `https://docs.x.ai/developers/models/<slug>.md`. **These are identifier strings only.** No claim is made here about weights, checkpoints, serving stack, or whether any release did or did not ship a new model.

| Model slug | Alias strings listed |
|---|---|
| `grok-imagine-video-1.5` | `grok-imagine-video-1.5-preview`, `grok-imagine-video-1.5-2026-05-30` |
| `grok-imagine-image-2.0` | *(none listed)* |
| `grok-imagine-image` | `grok-imagine-image-2026-03-02` |
| `grok-imagine-image-quality` | `grok-imagine-image-quality-20260403`, `grok-imagine-image-quality-latest`, `grok-imagine-image-pro` |
| `grok-imagine-video` | *(none listed)* |
| `grok-4.6` | *(none listed)* |
| `grok-4.5` | `grok-4.5-latest`, `grok-build-latest` |
| `grok-4.3` | `grok-4.3-latest` |
| `grok-build-0.1` | `grok-code-fast-1`, `grok-code-fast`, `grok-code-fast-1-0825` |
| `grok-voice-think-fast-2.0` | `grok-voice-latest` |

Dated/point ids also appearing in the pricing table (`docs.x.ai/developers/models.md`): `grok-4.20-0309-reasoning`, `grok-4.20-0309-non-reasoning`, `grok-4.20-multi-agent-0309`.

Alias convention, exact quote from `docs.x.ai/developers/models` (footer "Last updated: August 21, 2026"):
> "`<modelname>` is aliased to the latest stable version. `<modelname>-latest` is aliased to the latest version. This is suitable for users who want to access the latest features. `<modelname>-<date>` refers directly to a specific model release. This will not be updated and is for workflows that demand consistency."

Imagine pricing rows from the same page: `grok-imagine-image` $0.02/image; `grok-imagine-image-quality` $0.05/image; `grok-imagine-image-2.0` $0.04/image; `grok-imagine-video-1.5` $0.080/sec; `grok-imagine-video` $0.050/sec. Per-resolution video pricing on the model page: 480p $0.08, 720p $0.14, 1080p $0.25 per second.

---

## 6. API docs Release Notes — in-window entries

**URL:** `https://docs.x.ai/developers/release-notes`. **This page is month-bucketed with no day-level dates.**

**September 2026 — "grok-imagine-image-quality retirement on November 2":**
> "On November 2, 2026, `grok-imagine-image-quality` is retired. Requests to the slug will be served by `grok-imagine-image-2.0` with `quality` set to `low`, with no change to the request or response shape and at a lower per-image price. `grok-imagine-image` (1.0) is not affected."

**August 2026 — "Imagine image API updates"** (three bullets, verbatim):
> "**Auto quality.** The `quality` parameter on `grok-imagine-image-2.0` now accepts `auto`, and the default when `quality` is omitted has moved from `medium` to `auto`. Auto currently uses `low` for image generation and `medium` for image editing. Images are billed at the quality they are served at. Pass `low` or `medium` explicitly to pin a specific quality."
> "**Five reference images.** Image editing now accepts up to 5 source images per request (was 3)."
> "**New aspect ratios.** Image generation and editing accept `21:9` (cinematic widescreen) and `5:2` (wide banners)."

*(This bullet concerns image editing. No relationship to the video reference count is asserted.)*

**August 2026 — Grok 4.6:**
> "Grok 4.6, SpaceXAI's frontier model for coding, agentic tasks, and knowledge work, is now available on the xAI API. It has a 500k context window, text and image inputs with text-only output, and no text output limit. Pricing is $2 / $0.50 / $6 per 1M tokens (input / cached input / output) below 200k prompt tokens, and $4 / $1 / $12 above. Reasoning effort supports low, medium, high (default), and xhigh."

**July 2026 — "grok-imagine-video-1.5 modalities":**
> "`grok-imagine-video-1.5` now supports text-to-video, image-to-video, and reference-to-video (including optional preset voices), with native 1080p for T2V and I2V. Text-to-video on this model runs as text-to-image then image-to-video under the hood."

Also July 2026: `grok-voice-think-fast-2.0` availability; `vad_threshold` for Speech to Text; Grok 4.5 available in the EU.

---

## 7. Grok consumer Release Notes — reference & agent entries

**URL:** `https://grok.com/changelog` → `https://grok.com/release-notes`.
**Latest entry as of 2026-09-08: Aug 15, 2026.** Re-checked live on 2026-09-08; **no entry exists for the Sep 2 @imagine 14-reference announcement on this surface.**

### All "reference" entries (full page history, dated)
| Date | Entry (verbatim) | Section |
|---|---|---|
| **Aug 15, 2026** | "Drag to reorder a reference's cells." | Imagine |
| **Aug 01, 2026** | "Attach saved reference images from the reworked toolbox — with rename and delete, hover previews, and full-screen input previews." | Imagine |
| Apr 04, 2026 | "Fixed the displayed reference image for image-to-video on the post page." | Imagine |
| Feb 24, 2026 | "Fixed image edit sending wrong reference for non-first images" | Imagine |

### All "agent" entries (full page history, dated)
| Date | Entry (verbatim) |
|---|---|
| Jun 13, 2026 | "Report Issue is always available on the agent canvas." |
| Jun 06, 2026 | "Fixed pasting an image on an empty agent page." |
| Jun 06, 2026 | "Clear notices when your usage pool runs out in Imagine and Voice, plus a credit gauge in agent chat." |
| May 30, 2026 | "Fixed pasting an image into the agent chat query bar." |
| May 27, 2026 | "Grok is now available in Kilo Code, an open-source agentic coding platform." |
| May 23, 2026 | "The agent query bar no longer pastes a stale image alongside your text." |
| May 23, 2026 | "Agent thinking steps now display as separate steps instead of one block." |
| May 21, 2026 | "Grok is now available in OpenCode, an open-source coding agent." |
| May 16, 2026 | "Fixed dictation in the agent chat panel and broken multi-select movement on the canvas." |
| May 14, 2026 | "Grok Build is now in beta for SuperGrok Heavy users. Use the interactive TUI, run headlessly in scripts, or build apps and orchestrators with the Agent Client Protocol." |
| **Apr 30, 2026** | **"Imagine Agent Mode"** (headline entry — full text below) |
| Apr 04, 2026 | "Added touch support for reordering agent customizations on mobile." |
| Mar 03, 2026 | "Agent library — browse and select specialized agents" |
| Feb 24, 2026 | "Multiagent notetaker bullets in responses" |
| Feb 17, 2026 | "Agent customizations settings — customize agent behavior" |

**Apr 30, 2026 — "Imagine Agent Mode", full verbatim block:**
> "Imagine now has an AI-powered creative canvas. Enter Agent Mode to brainstorm with your agent, generate and edit images, turn them into videos, and stitch videos together to create longer videos — all in one place.
>
> Conversational canvas — Describe what you want in natural language and Grok generates, edits, and iterates on images directly on an interactive canvas.
> Image to video — Turn any generated image into a video, extend clips, and stitch multiple videos together.
> Projects — Save and revisit past Agent Mode sessions. Pick up where you left off or start fresh with a new canvas."

### Other in-window Imagine entries (verbatim)
- **Aug 15, 2026** — "Remove Background action on the post page extracts the subject from an image." / "Generations from uploaded photos now explain when moderation blocks them." / "Redesigned the saved-page toolbar and added a 5:2 Banner aspect ratio."
- **Aug 08, 2026** — "Tags are back: organize saved assets with per-asset collections." / "Aspect-ratio menus show a preview of each option." / "Fixed share links 404ing for teammates, lightbox arrows landing on unfinished generations, and "Generate More" ignoring a changed image count."
- **Aug 01, 2026** — "Videos you generate at 720p can be upscaled to 1080p from the canvas." / "Broken images in the lightbox show a fallback, and switching video quality keeps the play state." / "Video generation failures now show the server's actual message instead of silently retrying."
- **Jul 25, 2026** — "New audio on/off toggle when generating videos." / "Redesigned prompt bar with unified controls, instant mode switching, and dictation." / "Redesigned search dialog (Cmd+K)." / "Fixed the gallery stalling while loading more, blank grids after refresh, and video redos ignoring your resolution choice."
- **Jul 18, 2026** — "New three-way video resolution selector." / "Failed video generations no longer leave empty posts behind, and stuck image feeds recover on their own." / "Image generation errors show the actual reason instead of a generic toast." / "The Precise Edit magic-wand brush paints on the first try."

---

## 8. In-window announcements index (2026-07-28 → 2026-09-08)

From `/news` index plus `x.ai/sitemap.xml`, newest first. Dates as printed on posts, or sitemap `lastmod` where marked †.

| Date | Title | URL |
|------|-------|-----|
| Sep 3, 2026 | Grok Bot for Enterprise | `/news/grok-bot-for-enterprise` |
| Sep 3, 2026 † | Designing Grok Bot | `/news/designing-grok-bot` (sitemap-only) |
| Sep 1, 2026 | Biosecurity at the frontier | `/news/biosafety-at-the-frontier` (sitemap-only) |
| Aug 29, 2026 | Grok Bot now works with X | `/news/grok-bot-and-x` (sitemap-only) |
| Aug 26, 2026 | Grok 4.6 on Microsoft Foundry | `/news/grok-4-6-microsoft-foundry` |
| Aug 26, 2026 | Grok Bot is now included with more plans | `/news/grok-bot-more-plans` |
| Aug 21, 2026 | Grok 4.6 on Gemini Enterprise Agent Platform | `/news/grok-4-6-vertex-ai` |
| Aug 19, 2026 | Grok 4.6 on Amazon Bedrock | `/news/grok-4-6-amazon-bedrock` |
| Aug 19, 2026 | Grok Build on web and mobile | `/news/grok-build-for-everyone` |
| Aug 14, 2026 | Grok 4.6 in GitHub Copilot | `/news/grok-4-6-github-copilot` |
| **Aug 12, 2026** | **Introducing Grok 4.6** | `/news/grok-4-6` |
| Aug 11, 2026 | Introducing Grok Bot | `/news/introducing-grok-bot` |
| **Aug 7, 2026** | **Imagine Image 2.0** | `/news/grok-imagine-image-2` |
| **Jul 31, 2026** | **Imagine Video 1.5 with References** | `/news/grok-imagine-video-1-5-references` |
| Jul 29, 2026 | Introducing Grok Voice Think Fast 2.0 | `/news/grok-voice-think-fast-2` |
| Jul 28, 2026 | Introducing Build Mode | `/news/grok-build-mode` |
| Jul 28, 2026 | Grok 4.5 in GitHub Copilot | `/news/grok-github-copilot` |

Pre-window Imagine lineage, for date reference: **Jun 16, 2026** "Grok Imagine Video 1.5" (`/news/grok-imagine-video-1-5`); **Jun 3, 2026** "Grok Imagine 1.5 Preview" (`/news/grok-imagine-1-5`).

**Imagine Image 2.0, Aug 7, 2026** (`/news/grok-imagine-image-2`), editing quotes:
> "The magic wand edits the region you point at and leaves the rest untouched. Segmentation selects precise areas of the image to change. Background removal exports any subject with a transparent background, ready to drop into other work. Multi-ref editing accepts up to 5 input images in a single generation, removing the need for manual compositing."
> "Image 2.0 is available in the API as `grok-imagine-image-2.0`."
> "Overall Elo. Source: Arena Image Edit and Text-to-Image leaderboards (as of Aug 7, 2026). xAI models are listed on Arena under SpaceXAI."

**Console changelog** (`x.ai/api/changelog`), in-window:
- **Aug 24, 2026** — latest entry on that surface.
- **Aug 21, 2026** — "Image and video model pages show the tier rate-limit ladder, same as text models" / "Model details show whether the Batch API is supported"
- **Aug 13, 2026** — "The Console now has a public changelog covering new features, improvements, and fixes"
- **Jul 30, 2026** — "Generate video with Imagine Video 1.5" / "Clearer moderation feedback: a dedicated banner explains content-moderation rejections"

**Grok Build changelog** (`x.ai/build/changelog`), Imagine-relevant dated entries:
- **Aug 10, 2026** — "Video generation from references supports preset voices, single-image input, 1–15 s durations, and 4:3 / 3:4 aspect ratios"
- Jun 3, 2026 — "Add `image_to_video` and `reference_to_video` tools" / "Add bundled imagine skill"
- Jul 7, 2026 — "Image edits now use the higher-quality Imagine model for better output"

---

## 9. Video editing / extension — search result

**Statement of what was searched, not a claim about what exists.**

I searched these surfaces for a dated announcement of video editing or video extension: `x.ai/news` rendered index (full, back to 2023), `x.ai/sitemap.xml` news entries, `docs.x.ai/developers/release-notes`, `x.ai/api/changelog`, `x.ai/build/changelog`, and `grok.com/release-notes`.

**Result: not found on the news/changelog surfaces I searched.** This is a search result, not evidence of absence — I did not exhaustively read every post body, and per scope I did not open the video editing/extension capability doc pages, which the parent owns.

Dated entries that do reference these capabilities on surfaces I did read:
- `grok.com/release-notes`, **Apr 30, 2026**, Imagine Agent Mode: "Image to video — Turn any generated image into a video, **extend clips, and stitch multiple videos together**."
- `x.ai/build/changelog`, **Jun 3, 2026**: "Add `image_to_video` and `reference_to_video` tools."
- `docs.x.ai/developers/model-capabilities/video/reference-to-video` (Aug 20, 2026): "Reference-to-video cannot be combined with image-to-video or **video editing**."

---

## 10. Coverage and limitations

**Covered:** `/news` full index; in-window news post bodies; `x.ai/sitemap.xml`; `x.ai/api/changelog`; `x.ai/build/changelog` (full 107 KB); `grok.com/release-notes` (full 41 KB, authenticated, re-verified live 2026-09-08); `docs.x.ai/developers/release-notes`; `docs.x.ai/developers/models` + per-model `.md`; `docs.x.ai/llms.txt`; `docs.x.ai/openapi.json`; `x.ai/api/imagine`; **live X API verification of `@imagine` status 2095249317875622255 and the account's recent timeline.**

**Limitations:**
1. `docs.x.ai/developers/release-notes` has **no day-level dates**; August/September items can only be bucketed to a month.
2. The reference-count figures differ across surfaces (7 in Jul 31 news and Aug 20 docs; 14 in the Sep 2 X post). The X post describes a **mixed** reference set, not a public-API image count. **These are recorded as separate observations. I did not make a live authenticated API call, so I cannot state what the API currently accepts, and nothing here disproves a live measurement of 14.**
3. `grok.com/release-notes` latest entry is Aug 15, 2026 — it has **no** entry covering the Sep 2 announcement, so the consumer changelog cannot corroborate or date that change.
4. `status.x.ai` returned 403; incident/deployment history unchecked.
5. Charts and benchmark bars in news posts render as images or JS-driven elements; some numeric values were not readable as text.
6. `x.ai/news/grok-bot-procurement` returned unrelated content and is excluded entirely as unusable.
7. Per scope, video editing/extension capability docs, the llms/sitemap enumeration, and REST API reference endpoint docs were not examined — parent owns those.

---

## Raw extracts
Under `/Users/jun/.aside/u/0/ima2-xai-docs2/news-research/raw/`:
- `docs-x-ai_developers_release-notes.md` — API release notes, full
- `docs-x-ai_developers_models.md` — models + pricing tables
- `docs-x-ai_model_grok-imagine-video-1.5.md`, `docs-x-ai_model_grok-imagine-image-2.0.md`
- `docs-x-ai_reference-to-video.md` — R2V page markdown (limits callout stripped in `.md`; quoted in §4 from rendered HTML)
- `docs-x-ai_llms.txt`, `docs-x-ai_openapi.json`
- `x-ai_build_changelog_full.txt` — Grok Build changelog, full
- `grok-com_release-notes.txt` — consumer release notes, full

Superseded prior draft retained at `FINDINGS.superseded-2026-09-08.md`.
