# 011 — wp2 check evidence (NAI dual prompt)

Commits: 8610f31b (test contracts), dc97f8b5 (dual panes), dfcdb2e6 (style contracts).
Verifiers (worker run, exit 0 each): typecheck, typecheck:tests, test (skipped 2), test:inventory, ui build. Re-run by main at C: see receipt.
`ui/src/components/PromptComposer.tsx` = 498 lines.

## Render grounding (fresh `IMA2_PORT=3461 node bin/ima2.js serve --force`, agbrowse CDP)

| Screenshot | Observed |
|---|---|
| `evidence/010-nai-classic-1280x720.png` | right panel collapsed: composer 904px, wrapper `grid-template-columns: 435px 435px`; two equal panes, labels "Positive prompt"/"Undesired content", char hints, no clipping |
| `evidence/010-nai-home-1280x720.png` | two equal panes (460px each), same textarea height, footer below both |
| `evidence/010-oauth-classic-1280x720.png` | 1 textarea, `.negative-prompt` count 0, original placeholder |
| `evidence/010-nai-mobile-sheet-390x844.png` | CDP device metrics 390x844; sheet Prompt tab; wrapper `342px` single column, positive (y=1066) above negative (y=1297); `scrollWidth` 390 (no horizontal overflow); Generate reachable |

Container-query activation (NAI-DUAL-02 / narrow classic): with the right panel OPEN at
1440 wide the same wrapper measures 632px and resolves to `grid-template-columns: 632px`
(stacked), proving the `@container (max-width: 719px)` branch fires on the container,
not the viewport.

## Activation grounding

| Path | Trigger | Observation |
|---|---|---|
| provider gate | provider oauth | 1 textarea, no negative shell |
| @-mention only positive | type `x @` in each pane | positive: menu open; negative: no menu (baseline false) |
| Cmd+Enter from negative | keydown Enter+meta on `#negative-prompt-classic` (fetch stubbed) | exactly 1 `/api/generate` call with `provider:"nai"` |
| Ctrl+Enter from positive | keydown Enter+ctrl on `#positive-prompt-bottom` | call count 2 (one more) |
| DOM vs visual order | compareDocumentPosition + rects | positive precedes negative in DOM and layout |

Side note: the worker's keyboard smoke accidentally submitted one real NAI generation
(`nai-diffusion-5-full_13x19_20260901_portrait,-dramatic-l_0.png`) before fetch stubbing
was in place; main's re-run stubbed `fetch` so no provider call left the machine.

