import { isCoreProviderId, PROVIDER_SURFACE_SUPPORT } from "../generated/providers";

export type CoreGenerationMode = "image" | "multimode" | "video";

/** Derived execution meaning, shared by dispatch and core composer chrome. */
export function effectiveCoreGenerationMode(input: {
  provider: string;
  uiMode: string;
  multimode: boolean;
  videoModelSelected?: string | false | null;
  comfyVideoWorkflow?: string | null;
}): CoreGenerationMode {
  if ((input.provider === "comfy" && input.comfyVideoWorkflow)
    || ((input.provider === "grok" || input.provider === "grok-api") && input.videoModelSelected)) {
    return "video";
  }
  if (input.uiMode === "classic" && input.multimode && input.provider !== "nai"
    && isCoreProviderId(input.provider) && PROVIDER_SURFACE_SUPPORT[input.provider].multimode.supported) {
    return "multimode";
  }
  return "image";
}
