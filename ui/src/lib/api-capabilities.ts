import { jsonFetch } from "./api-core";

export type Ima2Capabilities = {
  limits?: {
    maxRefCount?: number;
    maxGeneratedImages?: number;
  };
  valid?: {
    videoModels?: {
      referenceAudio?: {
        maxVoices?: number;
        models?: string[];
        /** xAI owns this roster and also accepts custom ids, so it is a starting
         *  point rather than an allowlist. Read from the server so a roster change
         *  does not require a UI release. */
        knownPresets?: string[];
        presetsAreAuthoritative?: boolean;
        customVoiceApi?: string;
      };
    };
  };
  defaults?: {
    /** Display only — the client never re-sends an untouched value, so the
     *  server keeps resolving these from config for absent fields. */
    nai?: {
      sampler?: string;
      noiseSchedule?: string;
      steps?: number;
      scale?: number;
    };
  };
};

export function getCapabilities(): Promise<Ima2Capabilities> {
  return jsonFetch<Ima2Capabilities>("/api/capabilities");
}
