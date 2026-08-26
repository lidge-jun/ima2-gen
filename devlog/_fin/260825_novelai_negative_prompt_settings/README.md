# 260825_novelai_negative_prompt_settings

NovelAI lane: undesired-content (negative prompt) input + a provider-native
settings panel, ported against CLIsu's NovelAI surface.

**The finding:** `/api/generate` already forwards seven NAI parameters to the
adapter and no client code sends a single one. This unit connects a lane that
was built half-way, rather than adding a new feature.

## Documents

| Doc | Content |
|---|---|
| `000_plan.md` | Objective, constraints, work-phase map, verifier reality check |
| `001_parity_gap_table.md` | CLIsu ↔ ima2-gen parameter diff, gap classes G1-G4, deliberate divergences |
| `002_design_decisions.md` | One normalizer / alphabet validation / persistence shape / negative prompt is composer state |
| `003_ux_decision_panel.md` | Which controls the panel shows and which inert ones it hides |
| `004_audit_round1_synthesis.md` | Round 1: 8 blockers, all accepted |
| `005_audit_round2_synthesis.md` | Round 2: sparse-override redesign, three-layer V5 gating |
| `010_wp1_server_option_contract.md` | `lib/naiOptions.ts` + adapter completion + request-driven pipeline parity + `defaults.nai` |
| `020_wp2_client_state.md` | Sparse `naiOptionOverrides`, server-default resolution, payload emission |
| `030_wp3_ui_surface.md` | `NegativePromptField` + `NaiControlsPanel` |
| `040_wp4_i18n_contracts.md` | Four locales + contract test closure |
| `050_wp5_verification.md` | Gate sweep, render grounding, wire-body proof, audit |

## Status

wp0 (docs-only roadmap) complete. Implementation begins at wp1.

Baseline measured on `dev` @ `7e504f32`: `npm run typecheck` = 0,
`npm test` = 2580 tests / 2578 pass / **0 fail** / 2 skip.
