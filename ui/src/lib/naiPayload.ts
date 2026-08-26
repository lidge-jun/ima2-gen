import { isNaiV5Model, type NaiOptionOverrides } from "./naiOptions";

/** The four state fields the payload builder reads. Declared narrowly so this
 *  module stays importable from a plain node test runner. */
export type NaiPayloadSource = {
  provider: string;
  imageModel: string;
  naiOptionOverrides: NaiOptionOverrides;
  negativePrompt: string;
};

/**
 * The NovelAI fields a request carries.
 *
 * Sends the OVERRIDES, not the resolved options: a field the user never touched
 * is absent, so lib/naiImageAdapter.ts resolves it from config.naiProvider —
 * whether or not /api/capabilities has answered yet. That dissolves the
 * hydration race instead of racing it (devlog 020).
 *
 * For any other provider this returns nothing, so their payloads are
 * byte-identical to what they were before this lane had controls.
 */
export function naiPayloadFields(
  s: NaiPayloadSource,
  // Node variants carry a per-node provider/model that can disagree with the
  // global one. Gating on global state would either starve a NAI node or leak
  // NAI fields into another lane's request (wp5 audit). Callers with an
  // effective lane pass it; classic and multimode fall through to global state.
  lane: { provider?: string; imageModel?: string } = {},
): Record<string, unknown> {
  const provider = lane.provider ?? s.provider;
  const imageModel = lane.imageModel ?? s.imageModel;
  if (provider !== "nai") return {};

  const o: NaiOptionOverrides = { ...s.naiOptionOverrides };
  // straight_alpha and qualityPresetId are V5-only. Model and options hydrate
  // from independent persisted keys, so a V4.5 model can arrive alongside a
  // flag the user set while on V5. The adapter guards this too; stripping here
  // keeps the wire body honest about intent.
  if (!isNaiV5Model(imageModel)) {
    delete o.straightAlpha;
    delete o.qualityPresetId;
  }
  if (o.seed === null) delete o.seed;   // null means "let the server pick"

  const negativePrompt = s.negativePrompt.trim();
  return { ...o, ...(negativePrompt ? { negativePrompt } : {}) };
}

